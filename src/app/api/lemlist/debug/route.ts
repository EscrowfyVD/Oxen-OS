import { NextResponse } from "next/server"
import { requirePageAccess } from "@/lib/admin"
import { lemlistAuth, isLemlistConfigured } from "@/lib/lemlist"

const BASE = "https://api.lemlist.com/api"

async function safeFetch(url: string, auth: string): Promise<{ status: number; body: unknown; url: string }> {
  try {
    const res = await fetch(url, { headers: { Authorization: auth } })
    const text = await res.text()
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      body = text.slice(0, 2000)
    }
    return { status: res.status, body, url }
  } catch (err) {
    return { status: 0, body: { error: String(err) }, url }
  }
}

// GET /api/lemlist/debug — raw Lemlist API responses for debugging
export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  if (!isLemlistConfigured()) {
    return NextResponse.json({ error: "Lemlist API key not configured" }, { status: 500 })
  }

  const auth = lemlistAuth()

  // 1. Fetch campaigns
  const campaignsResult = await safeFetch(`${BASE}/campaigns`, auth)

  let firstCampaignId: string | null = null
  if (campaignsResult.status === 200 && Array.isArray(campaignsResult.body)) {
    const campaigns = campaignsResult.body as Array<{ _id: string; name: string }>
    if (campaigns.length > 0) {
      firstCampaignId = campaigns[0]._id
    }
  }

  // 2. If we have a campaign, try multiple lead endpoints
  const leadsResults: Record<string, unknown> = {}

  if (firstCampaignId) {
    // Standard leads endpoint
    leadsResults.leads = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}/leads`, auth,
    )

    // Paginated leads
    leadsResults.leads_paginated = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}/leads?offset=0&limit=100`, auth,
    )

    // Export endpoint
    leadsResults.export = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}/export`, auth,
    )

    // v2 API
    leadsResults.leads_v2 = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}/leads?version=2`, auth,
    )

    // Campaign detail (to see structure)
    leadsResults.campaign_detail = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}`, auth,
    )
  }

  // 3. Auth verification — check if auth header format is correct
  const authCheck = {
    format: "Basic :<API_KEY> (base64 encoded)",
    headerPreview: `Basic ${auth.replace("Basic ", "").slice(0, 8)}...`,
    decoded_prefix: Buffer.from(auth.replace("Basic ", ""), "base64").toString("utf8").slice(0, 5) + "...",
  }

  return NextResponse.json({
    authCheck,
    campaigns: campaignsResult,
    firstCampaignId,
    leads: leadsResults,
  })
}
