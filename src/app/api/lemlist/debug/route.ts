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
  let firstLeadId: string | null = null

  if (firstCampaignId) {
    // Standard leads endpoint (list — returns _id, state, contactId)
    const leadListResult = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}/leads?offset=0&limit=5`, auth,
    )
    leadsResults.lead_list = leadListResult

    // Extract first lead ID for detail fetch
    if (leadListResult.status === 200 && Array.isArray(leadListResult.body)) {
      const items = leadListResult.body as Array<{ _id: string }>
      if (items.length > 0) firstLeadId = items[0]._id
    }

    // If we have a lead ID, fetch individual detail
    if (firstLeadId) {
      // Primary: GET /api/leads/{leadId}
      leadsResults.lead_detail_global = await safeFetch(
        `${BASE}/leads/${firstLeadId}`, auth,
      )

      // Fallback: GET /api/campaigns/{cid}/leads/{leadId}
      leadsResults.lead_detail_campaign = await safeFetch(
        `${BASE}/campaigns/${firstCampaignId}/leads/${firstLeadId}`, auth,
      )
    }

    // Export endpoint
    leadsResults.export = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}/export`, auth,
    )

    // Campaign detail
    leadsResults.campaign_detail = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}`, auth,
    )
  }

  // 3. Auth verification
  const authCheck = {
    format: "Basic :<API_KEY> (base64 encoded)",
    headerPreview: `Basic ${auth.replace("Basic ", "").slice(0, 8)}...`,
    decoded_prefix: Buffer.from(auth.replace("Basic ", ""), "base64").toString("utf8").slice(0, 5) + "...",
  }

  return NextResponse.json({
    authCheck,
    campaigns: campaignsResult,
    firstCampaignId,
    firstLeadId,
    leads: leadsResults,
  })
}
