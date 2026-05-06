import { NextResponse } from "next/server"
import type { z } from "zod"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import {
  upsertCompanyFromClay,
  upsertPersonFromClay,
  type ClayUpsertResult,
} from "@/lib/clay-enrichment"
import {
  clayBatchImportSchema,
  clayBatchCompanyRowSchema,
  clayBatchPersonRowSchema,
  type ClayBatchImportPayload,
  type ClayEnrichmentPayload,
} from "../../../webhooks/_schemas"

/**
 * Clay CSV batch import (Sprint S0 batch 4, hotfix v2).
 *
 * Convergent target with /api/webhooks/clay-enrichment — both call the
 * same upsert helpers in `@/lib/clay-enrichment` (single source of
 * truth). This route is dedicated to authenticated wizard imports
 * (auth: requirePageAccess("crm")), while the webhook handles
 * unauthenticated 3rd-party Clay HTTP API pushes (auth: webhook secret).
 *
 * Validation flow (Sprint S0 batch 4 hotfix v2 — 2026-05-01):
 *   1. Top-level metadata (source_table, scope, group, pain_tier, rows
 *      array length) is validated upfront via clayBatchImportSchema.
 *   2. Each individual row is validated INSIDE the Promise.allSettled
 *      chunk loop (see processRow) using the appropriate per-row schema
 *      (clayBatchCompanyRowSchema or clayBatchPersonRowSchema).
 *   3. Per-row validation failures (e.g. description > 10000 chars,
 *      missing domain) are isolated — the row is reported in `errored`
 *      with the Zod error message; the rest of the batch keeps going.
 *
 * Why per-row instead of batch-level Zod: a 1711-row import failed in
 * production (2026-05-01) because 2 rows exceeded the previous 2000-char
 * description limit, taking down the entire import. Now a single bad
 * row no longer kills the batch.
 *
 * Transient failures (e.g. brief DB drop) are retried ONCE inside
 * processRow before being surfaced as `errored`.
 *
 * Refs: CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 5.1, 5.2.
 */

const CHUNK_SIZE = 100

interface ImportRowError {
  index: number
  error: string
}

type RowSchema =
  | typeof clayBatchCompanyRowSchema
  | typeof clayBatchPersonRowSchema

export async function POST(request: Request) {
  const { error: pageErr } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const v = await validateBody(request, clayBatchImportSchema)
  if ("error" in v) return v.error
  const payload = v.data

  const log = childLoggerFromRequest(request).child({
    route: "import-clay",
    scope: payload.scope,
    group: payload.group,
    painTier: payload.pain_tier,
    rowCount: payload.rows.length,
  })

  // Per-row schema selected once based on scope — each row in the batch
  // is parsed individually against this schema inside processRow.
  const rowSchema: RowSchema =
    payload.scope === "company"
      ? clayBatchCompanyRowSchema
      : clayBatchPersonRowSchema

  let created = 0
  let updated = 0
  const errors: ImportRowError[] = []

  try {
    for (
      let chunkStart = 0;
      chunkStart < payload.rows.length;
      chunkStart += CHUNK_SIZE
    ) {
      const chunk = payload.rows.slice(chunkStart, chunkStart + CHUNK_SIZE)
      const settled = await Promise.allSettled(
        chunk.map((row) => processRow(payload, row, rowSchema)),
      )

      for (let i = 0; i < settled.length; i++) {
        const r = settled[i]
        const idx = chunkStart + i
        if (r.status === "rejected") {
          const errMsg =
            r.reason instanceof Error ? r.reason.message : String(r.reason)
          errors.push({ index: idx, error: errMsg })
          log.warn(
            { rowIndex: idx, error: errMsg },
            "import-clay row rejected (after retry)",
          )
          continue
        }
        const result = r.value
        if (!result.ok) {
          errors.push({ index: idx, error: result.error })
          log.warn(
            { rowIndex: idx, error: result.error },
            "import-clay row failed validation or upsert",
          )
          continue
        }
        if (result.action === "created") created++
        else updated++
      }
    }

    log.info(
      { created, updated, errored: errors.length },
      "import-clay batch processed",
    )

    return NextResponse.json({
      success: true,
      total: payload.rows.length,
      created,
      updated,
      errored: errors.length,
      errors: errors.slice(0, 100), // cap returned errors to avoid huge response
    })
  } catch (err) {
    log.error({ err: serializeError(err) }, "import-clay batch failed")
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "internal error",
      },
      { status: 500 },
    )
  }
}

/**
 * Process a single row:
 *   1. Validate the row against the scope-specific Zod schema. Failures
 *      are returned as `{ ok: false, error }` so the batch can continue.
 *   2. Assemble the full ClayEnrichmentPayload from batch metadata + row.
 *   3. Dispatch to the appropriate upsert helper, with a single retry
 *      on thrown exceptions (transient DB / network blips).
 *
 * Returns the helper's ClayUpsertResult — both ok and error variants
 * are aggregated by the caller. Throws only if both upsert attempts
 * raise (caught by Promise.allSettled as `rejected`).
 */
async function processRow(
  batch: ClayBatchImportPayload,
  row: unknown,
  rowSchema: RowSchema,
): Promise<ClayUpsertResult> {
  // Step 1 — per-row Zod validation. Replaces the previous batch-level
  // upfront check so a single bad row doesn't reject all 1700+ rows.
  const parsed = rowSchema.safeParse(row)
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) }
  }

  // Step 2 — assemble the full Clay payload (wrap row with batch
  // metadata) before calling the shared upsert helper.
  const fullPayload = {
    source_table: batch.source_table,
    scope: batch.scope,
    group: batch.group,
    pain_tier: batch.pain_tier,
    ...(batch.scope === "company"
      ? { company: parsed.data as ClayEnrichmentPayload["company"] }
      : { person: parsed.data as ClayEnrichmentPayload["person"] }),
  } as ClayEnrichmentPayload

  // Step 3 — dispatch with retry x1 on thrown exceptions.
  const upsert = (): Promise<ClayUpsertResult> =>
    batch.scope === "company"
      ? upsertCompanyFromClay(fullPayload)
      : upsertPersonFromClay(fullPayload)

  try {
    return await upsert()
  } catch {
    // Single retry on transient errors (DB connection drops, network
    // blips). Persistent errors will throw again here and propagate to
    // Promise.allSettled which records them in `errored`.
    return await upsert()
  }
}

/**
 * Compact, single-line representation of a Zod validation error suitable
 * for surfacing to the wizard's error list. Examples:
 *   - "domain: Required"
 *   - "name: String must contain at least 1 character(s); description: String must contain at most 10000 character(s)"
 */
function formatZodError(error: z.ZodError): string {
  const flat = error.flatten()
  const fieldParts = Object.entries(flat.fieldErrors)
    .filter(([, msgs]) => msgs && msgs.length > 0)
    .map(([k, msgs]) => `${k}: ${(msgs ?? []).join(", ")}`)
  const formParts = flat.formErrors.length > 0 ? [flat.formErrors.join(", ")] : []
  const combined = [...fieldParts, ...formParts].join("; ")
  return combined.length > 0 ? `Validation: ${combined}` : "Validation: invalid row"
}
