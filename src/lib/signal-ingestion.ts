// Universal signal ingestion core — Sprint S1 batch 4.
//
// This module is the *single source of truth* for ingesting an
// IntentSignal or MarketSignal row. It is consumed by:
//   - the HTTP entry point /api/signals/route.ts (with auth + Zod
//     validation + HTTP response mapping wrapped around it)
//   - server-side callers like /api/webhooks/clay-enrichment that
//     need to emit signals as a side-effect of a larger workflow,
//     without paying the HTTP / re-auth roundtrip
//
// Design contract:
//   - Input is the validated SignalIngestionPayload (from
//     `src/app/api/signals/_schemas.ts`).
//   - The function looks up the SignalTypeRegistry strictly (returns
//     a structured error if the code is unknown / inactive / wrong
//     category for the scope), computes the decay lifecycle anchor,
//     and persists the row. No HTTP layer involvement, no logging
//     side effects — callers handle those.
//   - Errors are returned as discriminated `{ ok: false, status, code,
//     error, details? }` so the HTTP route can map cleanly to status
//     codes and internal callers can pattern-match on `code` for
//     decision-making (skip, retry, alert, etc.).
//
// Refs: PRD-001 §4.2 Signal Universal Ingestion (Sprint S1)

import { Prisma, type IntentSignal, type MarketSignal } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { SignalIngestionPayload } from "@/app/api/signals/_schemas"

// ─────────────────────────────────────────────────────────────────────
// Result types — discriminated union for safe pattern-matching by
// HTTP route handlers and other internal callers.
// ─────────────────────────────────────────────────────────────────────

export type IngestSignalSuccess =
  | { ok: true; scope: "contact" | "company"; signal: IntentSignal }
  | { ok: true; scope: "market"; signal: MarketSignal }

export type IngestSignalErrorCode =
  | "UNKNOWN_SIGNAL_TYPE"
  | "INACTIVE_SIGNAL_TYPE"
  | "CATEGORY_MISMATCH"
  | "CONTACT_NOT_FOUND"
  | "COMPANY_NOT_FOUND"
  | "PERSIST_FAILED"

export interface IngestSignalError {
  ok: false
  status: number // HTTP status this maps to (400 / 404 / 500)
  code: IngestSignalErrorCode
  error: string
  details?: Record<string, unknown>
}

export type IngestSignalResult = IngestSignalSuccess | IngestSignalError

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the SignalTypeRegistry entry by code. Returns the entry on
 * success or a structured error result. Splits out the `findUnique`
 * + isActive + category-mismatch checks so the entry point flow stays
 * readable.
 */
async function resolveRegistryEntry(
  code: string,
  scope: SignalIngestionPayload["scope"],
): Promise<
  | { ok: true; entry: NonNullable<Awaited<ReturnType<typeof prisma.signalTypeRegistry.findUnique>>> }
  | IngestSignalError
> {
  const entry = await prisma.signalTypeRegistry.findUnique({
    where: { code },
  })
  if (!entry) {
    return {
      ok: false,
      status: 400,
      code: "UNKNOWN_SIGNAL_TYPE",
      error: "Unknown signal type code",
      details: {
        signalTypeCode: code,
        hint: "Register the code via scripts/db/seed-signal-types.ts before ingesting.",
      },
    }
  }
  if (!entry.isActive) {
    return {
      ok: false,
      status: 400,
      code: "INACTIVE_SIGNAL_TYPE",
      error: "Signal type is inactive",
      details: { signalTypeCode: code },
    }
  }

  // Category guard — INTENT registry can only back contact/company
  // scopes; MARKET registry can only back market scope.
  const isMarketScope = scope === "market"
  if (isMarketScope && entry.category !== "MARKET") {
    return {
      ok: false,
      status: 400,
      code: "CATEGORY_MISMATCH",
      error: "Signal type category mismatch",
      details: {
        scope,
        signalTypeCategory: entry.category,
        expected: "MARKET",
      },
    }
  }
  if (!isMarketScope && entry.category !== "INTENT") {
    return {
      ok: false,
      status: 400,
      code: "CATEGORY_MISMATCH",
      error: "Signal type category mismatch",
      details: {
        scope,
        signalTypeCategory: entry.category,
        expected: "INTENT",
      },
    }
  }

  return { ok: true, entry }
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Compute (occurredAt, expiresAt, points, metadataInput) from the
 * payload + registry. Pure derivation — no DB touch.
 */
function deriveLifecycle(
  payload: SignalIngestionPayload,
  registry: { defaultPoints: number; decayDays: number },
): {
  occurredAt: Date
  expiresAt: Date
  points: number
  metadataInput: Prisma.InputJsonValue | typeof Prisma.DbNull
} {
  const occurredAt = payload.occurredAt
    ? new Date(payload.occurredAt)
    : new Date()
  const expiresAt = new Date(
    occurredAt.getTime() + registry.decayDays * MS_PER_DAY,
  )
  const points = payload.customPoints ?? registry.defaultPoints
  // metadata is `unknown` post-Zod — narrow to Prisma's input shape.
  const metadataInput =
    payload.metadata === undefined
      ? Prisma.DbNull
      : (payload.metadata as Prisma.InputJsonValue)
  return { occurredAt, expiresAt, points, metadataInput }
}

// ─────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────

/**
 * Ingest a validated signal payload into the database.
 *
 * Returns an explicit success/error discriminated union — callers
 * decide whether to map errors to HTTP status codes (route handler),
 * log + continue (Clay enrichment webhook), or alert (future
 * intelligence pipeline).
 *
 * Does NOT validate the input shape — callers are expected to have
 * already run the payload through `signalIngestionSchema` (Zod).
 * Pre-validated input means this function can be confidently called
 * from internal contexts where the source already guarantees the
 * shape (e.g. the webhook just parsed its own schema and constructed
 * a SignalIngestionPayload from it).
 */
export async function ingestSignal(
  payload: SignalIngestionPayload,
): Promise<IngestSignalResult> {
  // Step 1 — registry lookup + validation
  const registryResolution = await resolveRegistryEntry(
    payload.signalTypeCode,
    payload.scope,
  )
  if (!registryResolution.ok) return registryResolution
  const registry = registryResolution.entry

  // Step 2 — derive lifecycle
  const { occurredAt, expiresAt, points, metadataInput } = deriveLifecycle(
    payload,
    registry,
  )

  // Step 3 — persist (branch by scope)
  try {
    if (payload.scope === "contact") {
      // Denormalize companyId from CrmContact.companyId so company-
      // scoped scoring queries don't have to join through CrmContact.
      const contact = await prisma.crmContact.findUnique({
        where: { id: payload.contactId },
        select: { id: true, companyId: true },
      })
      if (!contact) {
        return {
          ok: false,
          status: 404,
          code: "CONTACT_NOT_FOUND",
          error: "Contact not found",
          details: { contactId: payload.contactId },
        }
      }
      const signal = await prisma.intentSignal.create({
        data: {
          contactId: contact.id,
          companyId: contact.companyId,
          signalTypeId: registry.id,
          source: "api/signals",
          signalType: registry.code,
          title: registry.label,
          detail: payload.notes ?? null,
          points,
          expiresAt,
          metadata: metadataInput,
          sourceUrl: payload.sourceUrl ?? null,
          notes: payload.notes ?? null,
          // Sprint 3a categorical axes — denormalized from the registry onto
          // the row. computeIntentScore filters `intentCategory != null` ON
          // THE ROW (not via a join to signalTypeRef), so a signal written
          // without this stays NULL-category and contributes 0 to the Intent
          // score forever. Placeholders (registry.intentCategory === null)
          // correctly stay null and remain excluded.
          intentCategory: registry.intentCategory,
          signalLevel: registry.signalLevel,
          createdAt: occurredAt, // anchor decay on event time, not insert time
        },
      })
      return { ok: true, scope: "contact", signal }
    }

    if (payload.scope === "company") {
      const company = await prisma.company.findUnique({
        where: { id: payload.companyId },
        select: { id: true },
      })
      if (!company) {
        return {
          ok: false,
          status: 404,
          code: "COMPANY_NOT_FOUND",
          error: "Company not found",
          details: { companyId: payload.companyId },
        }
      }
      const signal = await prisma.intentSignal.create({
        data: {
          contactId: null,
          companyId: company.id,
          signalTypeId: registry.id,
          source: "api/signals",
          signalType: registry.code,
          title: registry.label,
          detail: payload.notes ?? null,
          points,
          expiresAt,
          metadata: metadataInput,
          sourceUrl: payload.sourceUrl ?? null,
          notes: payload.notes ?? null,
          // Sprint 3a categorical axes — see the contact branch above for why
          // this denormalization is load-bearing for computeIntentScore.
          intentCategory: registry.intentCategory,
          signalLevel: registry.signalLevel,
          createdAt: occurredAt,
        },
      })
      return { ok: true, scope: "company", signal }
    }

    // payload.scope === "market"
    const signal = await prisma.marketSignal.create({
      data: {
        signalTypeId: registry.id,
        country: payload.country,
        vertical: payload.vertical ?? null,
        points,
        metadata: metadataInput,
        sourceUrl: payload.sourceUrl ?? null,
        occurredAt,
        expiresAt,
        notes: payload.notes ?? null,
      },
    })
    return { ok: true, scope: "market", signal }
  } catch (err) {
    return {
      ok: false,
      status: 500,
      code: "PERSIST_FAILED",
      error: "Failed to persist signal",
      details: {
        message: err instanceof Error ? err.message : String(err),
        scope: payload.scope,
      },
    }
  }
}
