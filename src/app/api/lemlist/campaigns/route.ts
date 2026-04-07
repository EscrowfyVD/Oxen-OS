import { NextResponse } from "next/server"
import { requirePageAccess } from "@/lib/admin"

const LEMLIST_API_KEY = process.env.LEMLIST_API_KEY ?? ""
const LEMLIST_BASE_URL = "https://api.lemlist.com/api"

interface LemlistCampaign {
  _id: string
  name: string
  labels: string[]
  sendingAddress: string
}

interface CachedCampaigns {
  data: { id: string; name: string; labels: string[]; sendingAddress: string }[]
  timestamp: number
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
let campaignsCache: CachedCampaigns | null = null

function getLemlistAuthHeader(): string {
  return `Basic ${Buffer.from(":" + LEMLIST_API_KEY).toString("base64")}`
}

// GET /api/lemlist/campaigns — list Lemlist campaigns (cached 1h)
export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  if (!LEMLIST_API_KEY) {
    return NextResponse.json(
      { error: "Lemlist API key not configured" },
      { status: 500 },
    )
  }

  // Return cached data if still fresh
  if (campaignsCache && Date.now() - campaignsCache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ campaigns: campaignsCache.data })
  }

  try {
    const response = await fetch(`${LEMLIST_BASE_URL}/campaigns`, {
      method: "GET",
      headers: {
        Authorization: getLemlistAuthHeader(),
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error(
        `[Lemlist Campaigns] API error: ${response.status} ${response.statusText}`,
      )
      return NextResponse.json({ campaigns: [] })
    }

    const raw: LemlistCampaign[] = await response.json()

    const campaigns = raw.map((c) => ({
      id: c._id,
      name: c.name,
      labels: c.labels ?? [],
      sendingAddress: c.sendingAddress ?? "",
    }))

    // Update cache
    campaignsCache = { data: campaigns, timestamp: Date.now() }

    return NextResponse.json({ campaigns })
  } catch (err) {
    console.error("[Lemlist Campaigns] Fetch error:", err)
    return NextResponse.json({ campaigns: [] })
  }
}
