// Apify ingestion runner (Apify PR3a-wiring) — the cron-runner consumer of the
// `apify:process-dataset` Jobs the webhook (#23) queues.
//
// Cron-runner (NOT the sync-worker): isolates the heavy Apify dataset fetch from
// the sync-worker that carries the time-sensitive LemCal F2 briefings. Mirrors
// the Apollo runner; claims Jobs via the same FOR UPDATE SKIP LOCKED pattern as
// the workers. The sync-worker / ai-worker do NOT claim `apify:*` (disjoint
// types, zero contention) → this runner is the sole consumer.
//
// Scope: fetch dataset → per item, dedup on sourceUrl vs ProcessedSignal, insert
// the raw item. NO keyword/recency filters, NO account match, NO ingestSignal,
// NO scoring — all PR3b.

import { Prisma } from "@prisma/client"
import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"
import { fetchDatasetItems, type ApifyDatasetItem } from "@/lib/apify"
import { logger, serializeError } from "@/lib/logger"

const log = logger.child({ component: "apify-ingestion-runner" })
const WORKER_ID = `apify-ingestion-cron-${process.pid}`

// Jobs processed per run; the rest wait for the next cron tick.
export const DEFAULT_APIFY_INGEST_CAP = 20

export interface ApifyIngestionResult {
  jobs: number // Jobs processed this run
  fetched: number // dataset items fetched across jobs
  inserted: number // new ProcessedSignal rows
  duplicates: number // items skipped (sourceUrl already seen)
  errors: number // per-item + per-job errors
  durationMs: number
}

interface ApifyJobPayload {
  datasetId?: string
  category?: string
  actId?: string | null
}

/**
 * Dedup key for an item — just enough to dedup. item.url ?? item.link, else a
 * stable content hash so re-ingesting the same item still dedups. Per-actor
 * canonical-field extraction is PR3b.
 */
export function extractSourceUrl(item: ApifyDatasetItem): string {
  const candidate = item.url ?? item.link
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim()
  }
  const hash = createHash("sha256").update(JSON.stringify(item)).digest("hex")
  return `sha256:${hash}`
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
}

// Claim ONE pending apify:process-dataset job (atomic; FOR UPDATE SKIP LOCKED).
async function claimNextJob(): Promise<{ id: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "Job"
    SET "status" = 'processing',
        "processedBy" = ${WORKER_ID},
        "startedAt" = NOW(),
        "attempts" = "attempts" + 1,
        "updatedAt" = NOW()
    WHERE "id" = (
      SELECT "id" FROM "Job"
      WHERE "status" = 'pending'
        AND "type" = 'apify:process-dataset'
        AND "attempts" < "maxAttempts"
      ORDER BY "priority" DESC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"
  `
  if (!rows || rows.length === 0) return null
  return { id: rows[0].id }
}

export async function runApifyIngestion(
  { cap = DEFAULT_APIFY_INGEST_CAP }: { cap?: number } = {},
): Promise<ApifyIngestionResult> {
  const wallStart = Date.now()
  const result: ApifyIngestionResult = {
    jobs: 0,
    fetched: 0,
    inserted: 0,
    duplicates: 0,
    errors: 0,
    durationMs: 0,
  }

  while (result.jobs < cap) {
    const claimed = await claimNextJob()
    if (!claimed) break // no more pending jobs
    result.jobs += 1

    try {
      const job = await prisma.job.findUnique({ where: { id: claimed.id } })
      const payload = (job?.payload ?? {}) as unknown as ApifyJobPayload
      const datasetId = typeof payload.datasetId === "string" ? payload.datasetId : null
      const category = typeof payload.category === "string" ? payload.category : null
      const actId = typeof payload.actId === "string" ? payload.actId : null

      let fetched = 0
      let inserted = 0
      let duplicates = 0
      let itemErrors = 0

      if (!datasetId) {
        log.warn({ jobId: claimed.id }, "apify job missing datasetId — nothing to fetch")
      } else {
        const items = await fetchDatasetItems(datasetId)
        fetched = items.length
        for (const item of items) {
          try {
            await prisma.processedSignal.create({
              data: {
                sourceUrl: extractSourceUrl(item),
                sourceActor: actId,
                signalCategory: category,
                rawPayload: item as Prisma.InputJsonValue,
              },
            })
            inserted += 1
          } catch (e) {
            if (isUniqueViolation(e)) {
              duplicates += 1 // already seen — dedup holds (sourceUrl @unique)
            } else {
              itemErrors += 1
              log.error({ jobId: claimed.id, err: serializeError(e) }, "apify item insert failed")
            }
          }
        }
      }

      result.fetched += fetched
      result.inserted += inserted
      result.duplicates += duplicates
      result.errors += itemErrors

      await prisma.job.update({
        where: { id: claimed.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          result: { fetched, new: inserted, dup: duplicates, errors: itemErrors } as Prisma.InputJsonValue,
        },
      })
      log.info(
        { jobId: claimed.id, datasetId, fetched, new: inserted, dup: duplicates, errors: itemErrors },
        "apify dataset job processed",
      )
    } catch (err) {
      // Per-job isolation: one bad job doesn't kill the batch.
      result.errors += 1
      log.error({ jobId: claimed.id, err: serializeError(err) }, "apify job failed")
      try {
        const j = await prisma.job.findUnique({ where: { id: claimed.id } })
        const status = j && j.attempts >= j.maxAttempts ? "failed" : "pending"
        await prisma.job.update({
          where: { id: claimed.id },
          data: { status, error: err instanceof Error ? err.message : String(err) },
        })
      } catch {
        /* swallow — best-effort status write */
      }
    }
  }

  result.durationMs = Date.now() - wallStart
  log.info(
    {
      jobs: result.jobs,
      fetched: result.fetched,
      inserted: result.inserted,
      duplicates: result.duplicates,
      errors: result.errors,
    },
    "apify ingestion batch complete",
  )
  return result
}
