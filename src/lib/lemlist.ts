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
