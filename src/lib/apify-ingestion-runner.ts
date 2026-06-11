// Apify ingestion runner (Apify PR3a-wiring + PR3b-pipeline) — the cron-runner
// consumer of the `apify:process-dataset` Jobs the webhook (#23) queues.
//
// Cron-runner (NOT the sync-worker): isolates the heavy Apify dataset fetch from
// the sync-worker that carries the time-sensitive LemCal F2 briefings. Mirrors
// the Apollo runner; claims Jobs via the same FOR UPDATE SKIP LOCKED pattern as
// the workers. The sync-worker / ai-worker do NOT claim `apify:*` (disjoint
// types, zero contention) → this runner is the sole consumer.
//
// PR3a scope: fetch dataset → per item, dedup on sourceUrl vs ProcessedSignal,
// insert the raw item. PR3b-pipeline scope (this file): AFTER the dedup-insert,
// for the 2 structured actors with a clean prospect-company field
// (crunchbase-f, jobboard-g) ONLY, route a NEW item through keyword + recency +
// company-match gates → on a >=0.85 match, ingest a company-scoped IntentSignal
// (scores via PR2.5) + stamp ProcessedSignal.accountId + targeted recompute of
// the company's contacts. Storage always happens; routing is the added gate.
// ON-NEW-INSERT-ONLY: a duplicate item is never re-routed.
//
// NOT in scope (deferred): Apollo enrich-create for no-match (PR3c);
// market-signal / DRAFT-campaign (PR3d); Website-Crawler diff (PR3e); Reddit/
// News NLP (Phase 2). Those actors' items stay in ProcessedSignal, unrouted.

import { Prisma } from "@prisma/client"
import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"
import { fetchDatasetItems, type ApifyDatasetItem } from "@/lib/apify"
import { ingestSignal } from "@/lib/signal-ingestion"
import { matchCompanyByName } from "@/lib/apify-account-match"
import { matchesIndustryKeyword } from "@/lib/apify-keywords"
import { recomputeCompanyContacts } from "@/lib/scoring/recompute-company-contacts"
import { getActiveScoringConfigWithVersion } from "@/lib/scoring/config-loader"
import type { ScoringConfigBlob } from "@/lib/scoring/config-types"
import { logger, serializeError } from "@/lib/logger"

const log = logger.child({ component: "apify-ingestion-runner" })
const WORKER_ID = `apify-ingestion-cron-${process.pid}`

// Jobs processed per run; the rest wait for the next cron tick.
export const DEFAULT_APIFY_INGEST_CAP = 20

// Caller-side match cutoff (account-match.ts returns all matches; the route's
// documented 0.85 contract is applied here).
const MATCH_THRESHOLD = 0.85
// Only act on fresh signals — funding/postings older than this are dropped.
const RECENCY_MAX_MS = 7 * 24 * 60 * 60 * 1000

export interface ApifyIngestionResult {
  skipped: boolean // true = run short-circuited before any claim (no APIFY_API_TOKEN)
  jobs: number // Jobs processed this run
  fetched: number // dataset items fetched across jobs
  inserted: number // new ProcessedSignal rows
  duplicates: number // items skipped (sourceUrl already seen)
  errors: number // per-item + per-job + routing errors
  routed: number // matched items → company-scoped IntentSignal ingested + accountId set
  unmatched: number // routable items that passed gates but matched no account >=0.85
  durationMs: number
}

interface ApifyJobPayload {
  datasetId?: string
  category?: string
  actId?: string | null
}

// PR3b — the 2 structured actors we auto-route. The map KEYS are the actor
// allowlist (= competitor-safety guard): a Job whose category isn't here is
// stored by PR3a but NEVER routed (Trustpilot competitor name / Reddit+News
// NLP / Website-Crawler diff all stay unrouted). Keys MUST match the #23
// webhook category suffixes (convention `<actor>-<letter>`).
interface RouteConfig {
  letter: string // intentCategory letter → signal code apify_<letter>
  companyField: string // item field holding the prospect company name
  recencyField: string // item field holding the actor's timestamp
}
const ROUTABLE_ACTORS: Record<string, RouteConfig> = {
  "crunchbase-f": { letter: "f", companyField: "name", recencyField: "lastFundingDate" },
  "jobboard-g": { letter: "g", companyField: "company", recencyField: "date_posted" },
}

type RouteOutcome = "skipped" | "no-match" | "routed" | "error"

/**
 * Dedup key for an item — item.url ?? item.link, else a stable content hash so
 * re-ingesting the same item still dedups.
 */
export function extractSourceUrl(item: ApifyDatasetItem): string {
  const candidate = item.url ?? item.link
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim()
  }
  const hash = createHash("sha256").update(JSON.stringify(item)).digest("hex")
  return `sha256:${hash}`
}

// Relevance text for the keyword gate: title + body/description (+ common
// aliases). Only string fields are concatenated.
function relevanceText(item: ApifyDatasetItem): string {
  const parts: string[] = []
  for (const key of ["title", "description", "body", "text", "headline", "snippet"]) {
    const v = item[key]
    if (typeof v === "string") parts.push(v)
  }
  return parts.join(" ")
}

// Parse the actor's timestamp field. Accepts ISO strings + epoch (s or ms).
// Returns null when absent/unparseable → the recency gate then fails closed
// (can't confirm freshness → no route).
function parseItemDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000 // heuristic: ms vs seconds
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const d = new Date(value.trim())
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function extractCompanyName(item: ApifyDatasetItem, field: string): string | null {
  const v = item[field]
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null
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

/**
 * Route ONE newly-inserted item (PR3b gate). Returns the outcome; never throws
 * on a gate miss. The caller wraps the call so an unexpected throw is isolated.
 */
async function routeNewItem(
  item: ApifyDatasetItem,
  route: RouteConfig,
  processedSignalId: string,
  sourceUrl: string,
  now: Date,
  loadScoring: () => Promise<{ config: ScoringConfigBlob; version: number }>,
): Promise<RouteOutcome> {
  // (c) keyword relevance — title + body/description must mention >=1 keyword.
  if (!matchesIndustryKeyword(relevanceText(item))) return "skipped"

  // (d) recency — drop items older than 7d (or with no usable timestamp).
  const itemDate = parseItemDate(item[route.recencyField])
  if (!itemDate) return "skipped"
  if (now.getTime() - itemDate.getTime() > RECENCY_MAX_MS) return "skipped"

  // (e) extract prospect company name.
  const companyName = extractCompanyName(item, route.companyField)
  if (!companyName) return "skipped"

  // match via the server matcher; caller applies the >=0.85 cutoff.
  const match = await matchCompanyByName(companyName)
  if (!match || match.confidence < MATCH_THRESHOLD) return "no-match"

  // route → company-scoped IntentSignal (scores via PR2.5). Only pass a real
  // http(s) sourceUrl (a sha256: dedup key is not a URL).
  const realUrl = sourceUrl.startsWith("http") ? sourceUrl : undefined
  const res = await ingestSignal({
    scope: "company" as const,
    companyId: match.companyId,
    signalTypeCode: `apify_${route.letter}`,
    occurredAt: itemDate.toISOString(),
    sourceUrl: realUrl,
  })
  if (!res.ok) {
    // e.g. UNKNOWN_SIGNAL_TYPE if the prod seed hasn't run yet — log + count,
    // leave accountId null, no recompute.
    log.error(
      { processedSignalId, code: res.code, companyId: match.companyId },
      "apify ingestSignal rejected — accountId left null",
    )
    return "error"
  }

  // stamp the ProcessedSignal as routed to this account.
  await prisma.processedSignal.update({
    where: { id: processedSignalId },
    data: { accountId: match.companyId },
  })

  // targeted recompute (decision #3) — loop persistScore over the company's
  // contacts; NOT the full-scan. Config fetched once per run (lazy).
  const { config, version } = await loadScoring()
  await recomputeCompanyContacts(match.companyId, config, version, now)

  return "routed"
}

export async function runApifyIngestion(
  { cap = DEFAULT_APIFY_INGEST_CAP }: { cap?: number } = {},
): Promise<ApifyIngestionResult> {
  const wallStart = Date.now()
  const now = new Date()
  const result: ApifyIngestionResult = {
    skipped: false,
    jobs: 0,
    fetched: 0,
    inserted: 0,
    duplicates: 0,
    errors: 0,
    routed: 0,
    unmatched: 0,
    durationMs: 0,
  }

  // Hard guard, BEFORE any Job claim. Without APIFY_API_TOKEN the client would
  // skip every fetch and we'd mark each claimed Job completed-at-0 — but a
  // one-shot actor's dataset is never recreated, so that signal would be lost
  // FOREVER. So we touch zero Jobs: they stay 'pending' and drain on the first
  // run after the token is set. (The client's own skip-no-key stays, defensive.)
  if (!process.env.APIFY_API_TOKEN) {
    log.warn("APIFY_API_TOKEN not set — skipping Apify ingestion run (0 Jobs claimed; pending Jobs preserved)")
    result.skipped = true
    result.durationMs = Date.now() - wallStart
    return result
  }

  // ScoringConfig fetched once per run, lazily on the first matched ingest.
  let scoringCache: { config: ScoringConfigBlob; version: number } | null = null
  const loadScoring = async () => {
    if (!scoringCache) {
      const { config, version } = await getActiveScoringConfigWithVersion()
      scoringCache = { config, version }
    }
    return scoringCache
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

      // PR3b — is this actor routable? (undefined → store only, never route.)
      const route = category ? ROUTABLE_ACTORS[category] : undefined

      let fetched = 0
      let inserted = 0
      let duplicates = 0
      let itemErrors = 0
      let routed = 0
      let unmatched = 0

      if (!datasetId) {
        log.warn({ jobId: claimed.id }, "apify job missing datasetId — nothing to fetch")
      } else {
        const items = await fetchDatasetItems(datasetId)
        fetched = items.length
        for (const item of items) {
          const sourceUrl = extractSourceUrl(item)
          let created: { id: string } | null = null
          try {
            created = await prisma.processedSignal.create({
              data: {
                sourceUrl,
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

          // ROUTING — on-new-insert-only (created), routable actor only. A dup
          // (created === null) is never re-routed.
          if (created?.id && route) {
            try {
              const outcome = await routeNewItem(item, route, created.id, sourceUrl, now, loadScoring)
              if (outcome === "routed") routed += 1
              else if (outcome === "no-match") unmatched += 1
              else if (outcome === "error") itemErrors += 1
            } catch (err) {
              itemErrors += 1
              log.error({ jobId: claimed.id, err: serializeError(err) }, "apify item routing failed")
            }
          }
        }
      }

      result.fetched += fetched
      result.inserted += inserted
      result.duplicates += duplicates
      result.errors += itemErrors
      result.routed += routed
      result.unmatched += unmatched

      await prisma.job.update({
        where: { id: claimed.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          result: {
            fetched,
            new: inserted,
            dup: duplicates,
            errors: itemErrors,
            routed,
            unmatched,
          } as Prisma.InputJsonValue,
        },
      })
      log.info(
        { jobId: claimed.id, datasetId, fetched, new: inserted, dup: duplicates, errors: itemErrors, routed, unmatched },
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
      routed: result.routed,
      unmatched: result.unmatched,
    },
    "apify ingestion batch complete",
  )
  return result
}
