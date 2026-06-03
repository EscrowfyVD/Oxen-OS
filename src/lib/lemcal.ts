// ─── LemCal API helper (AIRA F2 PR2) ───────────────────────────────
//
// LemCal (lempire's booking tool) — SEPARATE product/credentials from
// Lemlist (api.lemlist.com): own base + own LEMCAL_API_KEY, but the SAME
// Basic-auth + 20-req/2s token-bucket + Retry-After pattern (lempire family).
// We replicate lemlist's structure here (own module-scoped limiter — the rate
// budgets are independent per API).
//
// Used by the LemCal webhook (PR2) for the call-back verify: re-fetch the
// booking by _id to confirm it's real, since LemCal sends NO webhook signature
// (confirmed by spike) — the call-back is the anti-forge defense.
//
// Auth: LEMCAL_API_KEY holds the full "username:password" credential from the
// lemcal integrations dashboard (e.g. "usr_xxx:secret"); Basic = base64 of it.

import { logger, serializeError } from "./logger"

const LEMCAL_API_KEY = process.env.LEMCAL_API_KEY || ""
const BASE_URL = "https://api.lemcal.com/api"

const log = logger.child({ component: "lemcal" })

export function lemcalAuth(): string {
  return `Basic ${Buffer.from(LEMCAL_API_KEY).toString("base64")}`
}

export function isLemcalConfigured(): boolean {
  return LEMCAL_API_KEY.length > 0
}

// ─── Types (loose — the raw payload is also persisted as a safety net) ──
export interface LemcalAttendee {
  email: string
  name?: string | null
  type?: string | null
  response?: string | null
  owner?: boolean
  primary?: boolean
}
export interface LemcalQuestion {
  question: string
  answer?: string | null
}
export interface LemcalMeeting {
  _id: string
  meetingTypeId?: string | null
  meetingTypeName?: string | null
  start?: string | null
  end?: string | null
  attendees?: LemcalAttendee[]
  questions?: LemcalQuestion[]
  eventId?: string | null
  timezone?: string | null
}

// ─── Rate limiter — own token-bucket, mirrors lemlist (20 req / 2s) ─────
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
  const waitMs = RATE_WINDOW_MS - (Date.now() - lastRefill)
  await new Promise((r) => setTimeout(r, Math.max(50, waitMs)))
  return acquireRateToken()
}

export function __resetLemcalRateLimiter__(): void {
  tokens = RATE_BURST
  lastRefill = Date.now()
}

const MAX_RETRIES = 3

/**
 * Call-back verify: re-fetch the booking by _id from the documented
 * `GET /api/lemcal/meetings` list endpoint (filtered by meetingTypeId when
 * available to narrow), then find the row whose `_id` matches. Returns the
 * verified meeting, or null when it doesn't exist (anti-forge → caller ignores)
 * or the API is misconfigured/unreachable. Never throws.
 *
 * NB: LemCal documents a LIST endpoint (optional `meetingTypeId` filter), not a
 * GET-by-id; we list+find. If LemCal later exposes `/meetings/{id}`, swap here.
 */
export async function verifyLemcalMeeting(
  id: string,
  meetingTypeId?: string | null,
): Promise<LemcalMeeting | null> {
  if (!isLemcalConfigured()) {
    log.warn("LEMCAL_API_KEY not set — cannot call-back verify")
    return null
  }
  const url = new URL(`${BASE_URL}/lemcal/meetings`)
  if (meetingTypeId) url.searchParams.set("meetingTypeId", meetingTypeId)

  let attempt = 0
  while (attempt <= MAX_RETRIES) {
    await acquireRateToken()
    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: lemcalAuth() },
      })
      if (res.ok) {
        const body = await res.json().catch(() => null)
        const list: LemcalMeeting[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.meetings)
            ? body.meetings
            : Array.isArray(body?.data)
              ? body.data
              : []
        return list.find((m) => m?._id === id) ?? null
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= MAX_RETRIES) {
          log.error({ status: res.status, attempt }, "verifyLemcalMeeting exhausted retries")
          return null
        }
        const retryAfter = res.headers.get("Retry-After")
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(8000, 500 * Math.pow(2, attempt))
        await new Promise((r) => setTimeout(r, waitMs))
        attempt += 1
        continue
      }
      // 4xx non-429 → not retryable
      log.error({ status: res.status }, "verifyLemcalMeeting non-retryable failure")
      return null
    } catch (error) {
      log.error({ err: serializeError(error) }, "verifyLemcalMeeting network error")
      return null
    }
  }
  return null
}
