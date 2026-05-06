import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { Prisma } from "@prisma/client"
import type pino from "pino"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import {
  signalIngestionSchema,
  type SignalIngestionPayload,
} from "./_schemas"

/**
 * POST /api/signals — universal signal ingestion endpoint
 * (Sprint S1 batch 2 of PRD-001).
 *
 * Single entry point for all signal sources (internal automation,
 * external integrations, manual operator input from the UI). Routes
 * the incoming payload to either IntentSignal (scope=contact|company)
 * or MarketSignal (scope=market) based on the discriminator. Looks
 * up the SignalTypeRegistry by `signalTypeCode`, computes the decayed
 * lifecycle (`expiresAt = occurredAt + decayDays`), and persists the
 * row.
 *
 * Auth (fail-closed):
 *   - `Authorization: Bearer <SIGNALS_INGESTION_SECRET>` for
 *     server-to-server integrations (preferred for webhooks / cron),
 *     OR
 *   - Authenticated session with CRM page access (UI calls).
 *
 * The endpoint refuses to start if SIGNALS_INGESTION_SECRET is unset
 * (matches the pattern of /api/webhooks/lemlist).
 */
export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({ route: "signals" })

  // ── Auth (fail-closed bearer + session fallback) ──────────────────
  const ingestionSecret = process.env.SIGNALS_INGESTION_SECRET
  if (!ingestionSecret) {
    log.error(
      "SIGNALS_INGESTION_SECRET is not defined; refusing to ingest signals.",
    )
    return NextResponse.json(
      { error: "Signal ingestion secret not configured" },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader)
  let authedViaBearer = false
  if (bearerMatch) {
    const provided = bearerMatch[1]
    const a = Buffer.from(provided)
    const b = Buffer.from(ingestionSecret)
    if (a.length === b.length && timingSafeEqual(a, b)) {
      authedViaBearer = true
    } else {
      // A Bearer token was provided but does not match — fail fast.
      // Falling back to session here would let attackers brute-force.
      log.warn("invalid bearer token on /api/signals")
      return NextResponse.json(
        { error: "Invalid bearer token" },
        { status: 401 },
      )
    }
  }

  if (!authedViaBearer) {
    const { error: sessionErr } = await requirePageAccess("crm")
    if (sessionErr) return sessionErr
  }

  // ── Validate body ─────────────────────────────────────────────────
  const v = await validateBody(request, signalIngestionSchema)
  if ("error" in v) return v.error
  const payload = v.data

  // ── Lookup SignalTypeRegistry (strict — 400 if unknown code) ─────
  const registryEntry = await prisma.signalTypeRegistry.findUnique({
    where: { code: payload.signalTypeCode },
  })
  if (!registryEntry) {
    return NextResponse.json(
      {
        error: "Unknown signal type code",
        details: {
          signalTypeCode: payload.signalTypeCode,
          hint: "Register the code via scripts/db/seed-signal-types.ts before ingesting.",
        },
      },
      { status: 400 },
    )
  }
  if (!registryEntry.isActive) {
    return NextResponse.json(
      {
        error: "Signal type is inactive",
        details: { signalTypeCode: payload.signalTypeCode },
      },
      { status: 400 },
    )
  }

  // ── Reject category-mismatch (e.g. market scope with INTENT type) ─
  const isMarketScope = payload.scope === "market"
  if (isMarketScope && registryEntry.category !== "MARKET") {
    return NextResponse.json(
      {
        error: "Signal type category mismatch",
        details: {
          scope: payload.scope,
          signalTypeCategory: registryEntry.category,
          expected: "MARKET",
        },
      },
      { status: 400 },
    )
  }
  if (!isMarketScope && registryEntry.category !== "INTENT") {
    return NextResponse.json(
      {
        error: "Signal type category mismatch",
        details: {
          scope: payload.scope,
          signalTypeCategory: registryEntry.category,
          expected: "INTENT",
        },
      },
      { status: 400 },
    )
  }

  // ── Compute lifecycle anchors ─────────────────────────────────────
  const occurredAt = payload.occurredAt
    ? new Date(payload.occurredAt)
    : new Date()
  const expiresAt = new Date(
    occurredAt.getTime() + registryEntry.decayDays * 24 * 60 * 60 * 1000,
  )
  const points = payload.customPoints ?? registryEntry.defaultPoints

  // metadata is `unknown` post-Zod — coerce to Prisma's input shape.
  // null is meaningful (operator opt-out of payload storage); undefined
  // means "not provided", we store null too.
  const metadataInput =
    payload.metadata === undefined
      ? null
      : (payload.metadata as Prisma.InputJsonValue)

  try {
    // ── Persist (branch by scope) ───────────────────────────────────
    if (payload.scope === "contact") {
      return await persistContactScope(payload, registryEntry, {
        occurredAt,
        expiresAt,
        points,
        metadataInput,
        log,
      })
    }
    if (payload.scope === "company") {
      return await persistCompanyScope(payload, registryEntry, {
        occurredAt,
        expiresAt,
        points,
        metadataInput,
        log,
      })
    }
    // payload.scope === "market"
    return await persistMarketScope(payload, registryEntry, {
      occurredAt,
      expiresAt,
      points,
      metadataInput,
      log,
    })
  } catch (err) {
    log.error(
      { err: serializeError(err), scope: payload.scope },
      "signal ingestion failed at persist step",
    )
    return NextResponse.json(
      {
        error: "Failed to persist signal",
        details: err instanceof Error ? err.message : "internal error",
      },
      { status: 500 },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────
// Persist branches (one per scope) — kept inline rather than extracted
// to a helper module because they are only used from this file and the
// branch-by-scope is the load-bearing logic of the endpoint.
// ─────────────────────────────────────────────────────────────────────

interface PersistContext {
  occurredAt: Date
  expiresAt: Date
  points: number
  metadataInput: Prisma.InputJsonValue | null
  log: pino.Logger
}

type RegistryEntry = NonNullable<
  Awaited<ReturnType<typeof prisma.signalTypeRegistry.findUnique>>
>

async function persistContactScope(
  payload: Extract<SignalIngestionPayload, { scope: "contact" }>,
  registry: RegistryEntry,
  ctx: PersistContext,
): Promise<NextResponse> {
  // Denormalize companyId from CrmContact.companyId so company-scoped
  // scoring queries don't have to join through CrmContact every time.
  const contact = await prisma.crmContact.findUnique({
    where: { id: payload.contactId },
    select: { id: true, companyId: true },
  })
  if (!contact) {
    return NextResponse.json(
      { error: "Contact not found", details: { contactId: payload.contactId } },
      { status: 404 },
    )
  }

  const created = await prisma.intentSignal.create({
    data: {
      contactId: contact.id,
      companyId: contact.companyId, // denormalized
      signalTypeId: registry.id,
      source: "api/signals",
      signalType: registry.code, // legacy free-string mirror
      title: registry.label,
      detail: payload.notes ?? null,
      points: ctx.points,
      expiresAt: ctx.expiresAt,
      metadata: ctx.metadataInput ?? Prisma.DbNull,
      sourceUrl: payload.sourceUrl ?? null,
      notes: payload.notes ?? null,
      createdAt: ctx.occurredAt, // anchor on occurredAt, not now()
    },
  })

  ctx.log.info(
    { signalId: created.id, scope: "contact", contactId: contact.id, points: ctx.points },
    "intent signal ingested (scope=contact)",
  )
  return NextResponse.json(
    { success: true, scope: "contact", signal: created },
    { status: 200 },
  )
}

async function persistCompanyScope(
  payload: Extract<SignalIngestionPayload, { scope: "company" }>,
  registry: RegistryEntry,
  ctx: PersistContext,
): Promise<NextResponse> {
  const company = await prisma.company.findUnique({
    where: { id: payload.companyId },
    select: { id: true },
  })
  if (!company) {
    return NextResponse.json(
      { error: "Company not found", details: { companyId: payload.companyId } },
      { status: 404 },
    )
  }

  const created = await prisma.intentSignal.create({
    data: {
      contactId: null,
      companyId: company.id,
      signalTypeId: registry.id,
      source: "api/signals",
      signalType: registry.code,
      title: registry.label,
      detail: payload.notes ?? null,
      points: ctx.points,
      expiresAt: ctx.expiresAt,
      metadata: ctx.metadataInput ?? Prisma.DbNull,
      sourceUrl: payload.sourceUrl ?? null,
      notes: payload.notes ?? null,
      createdAt: ctx.occurredAt,
    },
  })

  ctx.log.info(
    { signalId: created.id, scope: "company", companyId: company.id, points: ctx.points },
    "intent signal ingested (scope=company)",
  )
  return NextResponse.json(
    { success: true, scope: "company", signal: created },
    { status: 200 },
  )
}

async function persistMarketScope(
  payload: Extract<SignalIngestionPayload, { scope: "market" }>,
  registry: RegistryEntry,
  ctx: PersistContext,
): Promise<NextResponse> {
  const created = await prisma.marketSignal.create({
    data: {
      signalTypeId: registry.id,
      country: payload.country,
      vertical: payload.vertical ?? null,
      points: ctx.points,
      metadata: ctx.metadataInput ?? Prisma.DbNull,
      sourceUrl: payload.sourceUrl ?? null,
      occurredAt: ctx.occurredAt,
      expiresAt: ctx.expiresAt,
      notes: payload.notes ?? null,
    },
  })

  ctx.log.info(
    {
      signalId: created.id,
      scope: "market",
      country: payload.country,
      vertical: payload.vertical ?? null,
      points: ctx.points,
    },
    "market signal ingested (scope=market)",
  )
  return NextResponse.json(
    { success: true, scope: "market", signal: created },
    { status: 200 },
  )
}

