import { NextResponse } from "next/server"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import {
  upsertCompanyFromClay,
  upsertPersonFromClay,
} from "@/lib/clay-enrichment"
import {
  clayBatchImportSchema,
  type ClayBatchImportPayload,
  type ClayEnrichmentPayload,
} from "../../../webhooks/_schemas"

/**
 * Clay CSV batch import (Sprint S0 batch 4).
 *
 * Convergent target with /api/webhooks/clay-enrichment — both call the
 * same upsert helpers in `@/lib/clay-enrichment` (single source of
 * truth). This route is dedicated to authenticated wizard imports
 * (auth: requirePageAccess("crm")), while the webhook handles
 * unauthenticated 3rd-party Clay HTTP API pushes (auth: webhook secret).
 *
 * Rows are processed in chunks of 100 with Promise.allSettled so an
 * isolated row failure does not abort the whole batch. Aggregated
 * counters (created/updated/errored) are returned synchronously.
 *
 * Refs: CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 5.1, 5.2.
 */

const CHUNK_SIZE = 100

interface ImportRowError {
  index: number
  error: string
}

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
        chunk.map((row) => processRow(payload, row)),
      )

      for (let i = 0; i < settled.length; i++) {
        const r = settled[i]
        const idx = chunkStart + i
        if (r.status === "rejected") {
          errors.push({
            index: idx,
            error:
              r.reason instanceof Error
                ? r.reason.message
                : String(r.reason),
          })
          continue
        }
        const result = r.value
        if (!result.ok) {
          errors.push({ index: idx, error: result.error })
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
 * Process a single row: assemble the full Clay payload (wrap row with
 * batch metadata) then dispatch to the appropriate upsert helper.
 *
 * Returns the helper's ClayUpsertResult — both ok and error variants
 * are aggregated by the caller.
 */
async function processRow(batch: ClayBatchImportPayload, row: unknown) {
  // Build the full ClayEnrichmentPayload from batch metadata + row.
  const fullPayload = {
    source_table: batch.source_table,
    scope: batch.scope,
    group: batch.group,
    pain_tier: batch.pain_tier,
    ...(batch.scope === "company"
      ? { company: row as ClayEnrichmentPayload["company"] }
      : { person: row as ClayEnrichmentPayload["person"] }),
  } as ClayEnrichmentPayload

  return batch.scope === "company"
    ? upsertCompanyFromClay(fullPayload)
    : upsertPersonFromClay(fullPayload)
}
