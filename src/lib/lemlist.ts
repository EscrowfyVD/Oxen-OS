// ─── Lemlist API Helper ────────────────────────────────

import { logger, serializeError } from "./logger"

const LEMLIST_API_KEY = process.env.LEMLIST_API_KEY || ""
const BASE_URL = "https://api.lemlist.com/api"

const log = logger.child({ component: "lemlist" })

// ─── Types ─────────────────────────────────────────────

export interface LemlistCampaign {
  _id: string
  name: string
  labels?: string[]
  sendingAddress?: string
}

// ─── Auth ──────────────────────────────────────────────

export function lemlistAuth(): string {
  return `Basic ${Buffer.from(":" + LEMLIST_API_KEY).toString("base64")}`
}

export function isLemlistConfigured(): boolean {
  return LEMLIST_API_KEY.length > 0
}

// ─── Campaign cache (1-hour TTL) ──────────────────────

let cachedCampaigns: LemlistCampaign[] = []
let cacheTimestamp = 0
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function getLemlistCampaigns(): Promise<LemlistCampaign[]> {
  if (!isLemlistConfigured()) {
    log.error("API key not configured")
    return []
  }

  const now = Date.now()
  if (cachedCampaigns.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedCampaigns
  }

  try {
    const res = await fetch(`${BASE_URL}/campaigns`, {
      method: "GET",
      headers: { Authorization: lemlistAuth() },
    })

    if (!res.ok) {
      log.error({ status: res.status, statusText: res.statusText }, "failed to fetch campaigns")
      return cachedCampaigns // return stale cache on error
    }

    const data: LemlistCampaign[] = await res.json()
    cachedCampaigns = data
    cacheTimestamp = now
    return data
  } catch (error) {
    log.error({ err: serializeError(error) }, "network error fetching campaigns")
    return cachedCampaigns // return stale cache on network failure
  }
}

// ─── Enroll a lead in a campaign ──────────────────────

export async function enrollLead(
  campaignId: string,
  lead: {
    email: string
    firstName?: string
    lastName?: string
    companyName?: string
    icebreaker?: string
  },
): Promise<{ ok: boolean; leadId?: string; error?: string }> {
  if (!isLemlistConfigured()) {
    return { ok: false, error: "Lemlist API key not configured" }
  }

  try {
    const res = await fetch(
      `${BASE_URL}/campaigns/${campaignId}/leads/${encodeURIComponent(lead.email)}`,
      {
        method: "POST",
        headers: {
          Authorization: lemlistAuth(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.companyName,
          icebreaker: lead.icebreaker,
        }),
      },
    )

    if (!res.ok) {
      const body = await res.text()
      log.error({ status: res.status, body }, "enrollLead failed")
      return { ok: false, error: `${res.status} ${body}` }
    }

    const data = await res.json()
    return { ok: true, leadId: data._id }
  } catch (error) {
    log.error({ err: serializeError(error) }, "network error enrolling lead")
    return { ok: false, error: String(error) }
  }
}

// ─── Remove a lead from a specific campaign ───────────

export async function removeLead(
  campaignId: string,
  email: string,
): Promise<{ ok: boolean }> {
  if (!isLemlistConfigured()) {
    log.error("API key not configured")
    return { ok: false }
  }

  try {
    const res = await fetch(
      `${BASE_URL}/campaigns/${campaignId}/leads/${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: { Authorization: lemlistAuth() },
      },
    )

    if (!res.ok) {
      log.error({ status: res.status, statusText: res.statusText }, "removeLead failed")
      return { ok: false }
    }

    return { ok: true }
  } catch (error) {
    log.error({ err: serializeError(error) }, "network error removing lead")
    return { ok: false }
  }
}

// ─── Remove a lead from all campaigns ─────────────────

export async function removeLeadFromAll(
  email: string,
): Promise<{ ok: boolean }> {
  if (!isLemlistConfigured()) {
    log.error("API key not configured")
    return { ok: false }
  }

  try {
    const res = await fetch(
      `${BASE_URL}/leads/${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: { Authorization: lemlistAuth() },
      },
    )

    if (!res.ok) {
      log.error({ status: res.status, statusText: res.statusText }, "removeLeadFromAll failed")
      return { ok: false }
    }

    return { ok: true }
  } catch (error) {
    log.error({ err: serializeError(error) }, "network error removing lead from all")
    return { ok: false }
  }
}

// ─── Rate limiter (Sprint 3d) ────────────────────────────
// Lemlist documents 20 requests / 2 seconds per API key. We implement
// a simple token-bucket scoped to this Node process — sufficient for
// V1 where a single recompute batch is the only burst source. A
// shared cache (Redis) would matter only once we run multiple
// concurrent Next.js instances hammering the API; defer to V2.
//
// Refs:
//   - https://lemlist.mintlify.app/api-reference/getting-started/rate-limits
//   - Sprint 3d recon Finding 6 (PARTIAL acceleration verdict)

const RATE_WINDOW_MS = 2000
const RATE_BURST = 20

let tokens = RATE_BURST
let lastRefill = Date.now()

function refillTokens(now: number = Date.now()): void {
  const elapsed = now - lastRefill
  if (elapsed >= RATE_WINDOW_MS) {
    tokens = RATE_BURST
    lastRefill = now
  } else if (elapsed > 0) {
    // Linear refill within the window — feels closer to Lemlist's actual
    // behaviour than full-window bucketing.
    const refill = Math.floor((elapsed / RATE_WINDOW_MS) * RATE_BURST)
    if (refill > 0) {
      tokens = Math.min(RATE_BURST, tokens + refill)
      lastRefill = now
    }
  }
}

async function acquireRateToken(): Promise<void> {
  refillTokens()
  if (tokens > 0) {
    tokens -= 1
    return
  }
  // No token — sleep until the next refill window and try again.
  const waitMs = RATE_WINDOW_MS - (Date.now() - lastRefill)
  await new Promise((r) => setTimeout(r, Math.max(50, waitMs)))
  return acquireRateToken()
}

// Test hook — reset the bucket between tests. Not exported in the
// public surface, but accessible via __resetLemlistRateLimiter__.
export function __resetLemlistRateLimiter__(): void {
  tokens = RATE_BURST
  lastRefill = Date.now()
}

// ─── Update lead custom variables (Sprint 3d B2) ─────────
// Lemlist exposes `PATCH /leads/{leadIdOrEmail}/variables` with custom
// fields as query params. We use this as the "adapt" lever in
// orchestrateSequence — see Sprint 3d recon Finding 6 + D1:
// programmatic acceleration is not available, but variable injection
// IS — provided the campaign templates reference {{customField1}}..N.
//
// Behaviour:
//   - 429 → respects Retry-After (or falls back to 1s) and retries up
//     to MAX_RETRIES times with exponential backoff.
//   - 5xx → same retry policy.
//   - 4xx (non-429) → returns ok=false with body; caller decides.
//   - network errors → returns ok=false, no retry (Activity log on caller).
const MAX_RETRIES = 3

export async function updateLeadVariables(
  leadIdOrEmail: string,
  variables: Record<string, string>,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!isLemlistConfigured()) {
    return { ok: false, error: "LEMLIST_API_KEY not set" }
  }

  // Lemlist passes custom fields as query params, not JSON body.
  const url = new URL(
    `${BASE_URL}/leads/${encodeURIComponent(leadIdOrEmail)}/variables`,
  )
  for (const [k, v] of Object.entries(variables)) {
    url.searchParams.set(k, v)
  }

  let attempt = 0
  while (attempt <= MAX_RETRIES) {
    await acquireRateToken()
    try {
      const res = await fetch(url.toString(), {
        method: "PATCH",
        headers: { Authorization: lemlistAuth() },
      })

      if (res.ok) {
        return { ok: true, status: res.status }
      }

      // Retry on 429 + 5xx
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= MAX_RETRIES) {
          const body = await res.text().catch(() => "")
          log.error(
            { status: res.status, attempt, body },
            "updateLeadVariables exhausted retries",
          )
          return { ok: false, status: res.status, error: body || res.statusText }
        }
        const retryAfter = res.headers.get("Retry-After")
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(8000, 500 * Math.pow(2, attempt))
        log.warn(
          { status: res.status, waitMs, attempt },
          "updateLeadVariables backing off",
        )
        await new Promise((r) => setTimeout(r, waitMs))
        attempt += 1
        continue
      }

      // 4xx non-429 → fail fast.
      const body = await res.text().catch(() => "")
      log.error(
        { status: res.status, body },
        "updateLeadVariables non-retryable failure",
      )
      return { ok: false, status: res.status, error: body || res.statusText }
    } catch (error) {
      log.error(
        { err: serializeError(error) },
        "network error updating lead variables",
      )
      return { ok: false, error: String(error) }
    }
  }

  // Unreachable in practice — loop returns inside both branches.
  return { ok: false, error: "retry loop exhausted unexpectedly" }
}
