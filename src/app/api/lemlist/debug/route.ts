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
    if (campaigns.length > 0) firstCampaignId = campaigns[0]._id
  }

  // 2. Lead list + contact detail
  const results: Record<string, unknown> = {}
  let firstContactId: string | null = null

  if (firstCampaignId) {
    // Lead list (returns _id, state, contactId)
    const leadListResult = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}/leads?offset=0&limit=5`, auth,
    )
    results.lead_list = leadListResult

    if (leadListResult.status === 200 && Array.isArray(leadListResult.body)) {
      const items = leadListResult.body as Array<{ _id: string; contactId?: string }>
      if (items.length > 0) firstContactId = items[0].contactId ?? null
    }

    // Contact detail via /api/contacts/{contactId} (the working endpoint)
    if (firstContactId) {
      results.contact_detail = await safeFetch(
        `${BASE}/contacts/${firstContactId}`, auth,
      )
    }

    // Campaign detail
    results.campaign_detail = await safeFetch(
      `${BASE}/campaigns/${firstCampaignId}`, auth,
    )
  }

  return NextResponse.json({
    campaigns: campaignsResult,
    firstCampaignId,
    firstContactId,
    results,
  })
}
