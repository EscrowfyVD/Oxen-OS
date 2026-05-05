import { NextResponse } from "next/server"
import { requireWebhookSecret } from "@/lib/webhook-auth"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import {
  upsertCompanyFromClay,
  upsertPersonFromClay,
} from "@/lib/clay-enrichment"
import { clayEnrichmentSchema } from "../_schemas"

/**
 * Clay enrichment webhook (PRD-001 scoring engine, Sprint S0).
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

    return NextResponse.json({
      success: true,
      action: result.action,
      ...(result.companyId !== undefined && { companyId: result.companyId }),
      ...(result.contactId && { contactId: result.contactId }),
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
