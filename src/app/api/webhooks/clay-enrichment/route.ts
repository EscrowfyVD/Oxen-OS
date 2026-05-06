import { NextResponse } from "next/server"
import type pino from "pino"
import { requireWebhookSecret } from "@/lib/webhook-auth"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import {
  upsertCompanyFromClay,
  upsertPersonFromClay,
} from "@/lib/clay-enrichment"
import { ingestSignal } from "@/lib/signal-ingestion"
import type { SignalIngestionPayload } from "@/app/api/signals/_schemas"
import { clayEnrichmentSchema, type ClaySignalEntry } from "../_schemas"

/**
 * Clay enrichment webhook (PRD-001 scoring engine, Sprint S0; Sprint
 * S1 batch 4 added optional signal emission).
 *
 * Thin HTTP entry point — auth + Zod validation + dispatch to upsert
 * helpers in `@/lib/clay-enrichment`. The CSV import endpoint
 * (/api/crm/contacts/import-clay) calls the same helpers, guaranteeing
 * single source of truth for Clay → Oxen writes.
 *
 * MAPPING NOTES (intentional):
 * - Clay payload uses `primaryIndustry`, Oxen schema uses `industry`
 *   (decision C1 — Sprint S0 batch 1 — kept for compat with 11 AI
 *   consumer files).
 * - Clay payload uses `country`; schema field aligned post-rename
 *   (decision C3 — Sprint S0 batch 1).
 *
 * SPRINT S1 BATCH 4 — OPTIONAL SIGNAL EMISSION:
 * If the payload includes a `signals[]` array, the webhook emits one
 * IntentSignal per entry AFTER the Company / Contact upsert succeeds.
 * The signals share the scope of the upsert (company-scope upsert →
 * company-scope signals; people-scope upsert → contact-scope signals
 * with companyId auto-denormalized by ingestSignal()).
 *
 * Failure mode for signals: errors are logged but DO NOT fail the
 * webhook. Phase 2 import robustness > scoring completeness — a bad
 * signal type code or unknown contact won't break the broader Clay
 * enrichment pipeline. The aggregated counters are returned in the
 * response body so Clay can see partial failures.
 *
 * Refs: CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 4.1, 4.2.
 */
export async function POST(request: Request) {
  const authFail = requireWebhookSecret(request, {
    envVarName: "CLAY_WEBHOOK_SECRET",
  })
  if (authFail) return authFail

  const v = await validateBody(request, clayEnrichmentSchema, {
    publicErrors: false,
  })
  if ("error" in v) return v.error

  const log = childLoggerFromRequest(request).child({
    webhook: "clay-enrichment",
    scope: v.data.scope,
    group: v.data.group,
    painTier: v.data.pain_tier,
  })

  try {
    const result =
      v.data.scope === "company"
        ? await upsertCompanyFromClay(v.data)
        : await upsertPersonFromClay(v.data)

    if (!result.ok) {
      // Defensive — schema refine should make this unreachable, but the
      // helper still validates payload coherence at runtime.
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      )
    }

    // ── Sprint S1 batch 4 — optional signal emission ────────────────
    // Run AFTER the upsert succeeded so the contactId / companyId we
    // pass to ingestSignal() is guaranteed to exist in DB. Per-signal
    // errors are logged + collected; the webhook still returns 200 so
    // a single bad signal doesn't kill the whole Clay payload.
    let signalsIngested = 0
    let signalsErrored = 0
    const signalErrors: Array<{ index: number; code: string; error: string }> = []

    if (v.data.signals && v.data.signals.length > 0) {
      for (let i = 0; i < v.data.signals.length; i++) {
        const sig = v.data.signals[i]
        const ingested = await ingestSingleSignal(sig, v.data, result, i, log)
        if (ingested.ok) {
          signalsIngested++
        } else {
          signalsErrored++
          signalErrors.push({
            index: i,
            code: ingested.code,
            error: ingested.error,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      action: result.action,
      ...(result.companyId !== undefined && { companyId: result.companyId }),
      ...(result.contactId && { contactId: result.contactId }),
      ...(v.data.signals && v.data.signals.length > 0 && {
        signalsIngested,
        signalsErrored,
        signalErrors: signalErrors.slice(0, 10), // cap to keep response small
      }),
    })
  } catch (err) {
    // pino logger is Sentry-wired (Sprint 2.4b PII-safe filter).
    log.error({ err: serializeError(err) }, "clay-enrichment failed")
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "internal error",
      },
      { status: 500 },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helper: build a SignalIngestionPayload from a ClaySignalEntry +
// upsert context, then call ingestSignal(). Returns the structured
// IngestSignalResult so the loop can aggregate stats.
//
// The mapping rule:
//   - Clay payload scope = "company"  → signal scope = "company"
//   - Clay payload scope = "people"   → signal scope = "contact"
//     (signal handler will auto-denormalize companyId from CrmContact)
// ─────────────────────────────────────────────────────────────────────
async function ingestSingleSignal(
  sig: ClaySignalEntry,
  clayPayload: { scope: "company" | "people" },
  upsertResult: { companyId?: string | null; contactId?: string },
  index: number,
  log: pino.Logger,
) {
  // Resolve target id from upsert result based on Clay scope.
  if (clayPayload.scope === "company") {
    if (!upsertResult.companyId) {
      log.warn(
        { index, signalTypeCode: sig.signalTypeCode },
        "clay-enrichment signal skipped: companyId missing from upsert result",
      )
      return {
        ok: false as const,
        code: "MISSING_TARGET_ID",
        error: "companyId missing from upsert result",
      }
    }
    const payload: SignalIngestionPayload = {
      scope: "company",
      companyId: upsertResult.companyId,
      signalTypeCode: sig.signalTypeCode,
      ...(sig.customPoints !== undefined && { customPoints: sig.customPoints }),
      ...(sig.metadata !== undefined && { metadata: sig.metadata }),
      ...(sig.sourceUrl !== undefined && { sourceUrl: sig.sourceUrl }),
      ...(sig.occurredAt !== undefined && { occurredAt: sig.occurredAt }),
      ...(sig.notes !== undefined && { notes: sig.notes }),
    }
    const result = await ingestSignal(payload)
    if (!result.ok) {
      log.warn(
        {
          index,
          signalTypeCode: sig.signalTypeCode,
          errorCode: result.code,
          details: result.details,
        },
        `clay-enrichment signal ingestion failed: ${result.code}`,
      )
    }
    return result
  }

  // clayPayload.scope === "people" → contact-scope signal
  if (!upsertResult.contactId) {
    log.warn(
      { index, signalTypeCode: sig.signalTypeCode },
      "clay-enrichment signal skipped: contactId missing from upsert result",
    )
    return {
      ok: false as const,
      code: "MISSING_TARGET_ID",
      error: "contactId missing from upsert result",
    }
  }
  const payload: SignalIngestionPayload = {
    scope: "contact",
    contactId: upsertResult.contactId,
    signalTypeCode: sig.signalTypeCode,
    ...(sig.customPoints !== undefined && { customPoints: sig.customPoints }),
    ...(sig.metadata !== undefined && { metadata: sig.metadata }),
    ...(sig.sourceUrl !== undefined && { sourceUrl: sig.sourceUrl }),
    ...(sig.occurredAt !== undefined && { occurredAt: sig.occurredAt }),
    ...(sig.notes !== undefined && { notes: sig.notes }),
  }
  const result = await ingestSignal(payload)
  if (!result.ok) {
    log.warn(
      {
        index,
        signalTypeCode: sig.signalTypeCode,
        errorCode: result.code,
        details: result.details,
      },
      `clay-enrichment signal ingestion failed: ${result.code}`,
    )
  }
  return result
}
