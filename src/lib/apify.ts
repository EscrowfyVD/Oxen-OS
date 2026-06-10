// ─── Apify dataset client (Apify PR3a-wiring) ───────────────────────
//
// Pure HTTP client to fetch a finished actor run's dataset items. Mirrors the
// apollo.ts / lemcal.ts client shape (own module, never-throw, 429-aware).
//
// Spine = the guards:
//   - skip-if-no-key : no APIFY_API_TOKEN → return [] WITHOUT any HTTP call
//     (no crash, no wasted call). Key read at call time (fresh env + testable).
//   - never-throw    : network / 4xx / 5xx / bad body → [] (the runner treats an
//     empty fetch as "nothing to ingest" and moves on).
//   - 429-aware      : respect Retry-After, retry with backoff (~3 attempts) → [].
//
// Auth: the token goes in the `?token=` query param (Apify supports this). We
// NEVER log the full URL (only datasetId + status), so the token can't leak to
// logs.

import { logger, serializeError } from "./logger"

const BASE_URL = "https://api.apify.com/v2"
const MAX_RETRIES = 2 // → up to 3 attempts total on 429

const log = logger.child({ component: "apify" })

function apifyToken(): string {
  return process.env.APIFY_API_TOKEN || ""
}

export function isApifyConfigured(): boolean {
  return apifyToken().length > 0
}

// Loose — a scraped item is arbitrary JSON; the raw object is persisted verbatim
// as ProcessedSignal.rawPayload, so we never want a shape to drop a field.
export type ApifyDatasetItem = Record<string, unknown>

/**
 * Fetch a dataset's items: GET /v2/datasets/{id}/items?token=&format=json&limit=.
 * Returns the items array, or [] on no-key / not-found / error (never throws).
 */
export async function fetchDatasetItems(
  datasetId: string,
  { limit = 1000 }: { limit?: number } = {},
): Promise<ApifyDatasetItem[]> {
  if (!isApifyConfigured()) {
    log.warn("APIFY_API_TOKEN not set — skipping fetchDatasetItems (no HTTP call)")
    return []
  }

  const url = new URL(`${BASE_URL}/datasets/${encodeURIComponent(datasetId)}/items`)
  url.searchParams.set("token", apifyToken())
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", String(limit))

  let attempt = 0
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await fetch(url.toString(), { method: "GET" })
      if (res.ok) {
        const body = await res.json().catch(() => null)
        return Array.isArray(body) ? (body as ApifyDatasetItem[]) : []
      }
      if (res.status === 429) {
        if (attempt >= MAX_RETRIES) {
          log.error({ datasetId, attempt }, "apify: rate-limited, retries exhausted")
          return []
        }
        const retryAfter = res.headers.get("Retry-After")
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(8000, 500 * Math.pow(2, attempt))
        await new Promise((r) => setTimeout(r, Number.isFinite(waitMs) ? waitMs : 1000))
        attempt += 1
        continue
      }
      // 4xx (not-found etc.) / 5xx non-429 → not retryable here → []
      log.warn({ datasetId, status: res.status }, "apify: non-2xx fetching dataset")
      return []
    } catch (err) {
      log.error({ datasetId, err: serializeError(err) }, "apify: network error fetching dataset")
      return []
    }
  }
  return []
}
