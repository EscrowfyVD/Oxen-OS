import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { getLemlistCampaigns, lemlistAuth, isLemlistConfigured } from "@/lib/lemlist"

const BASE = "https://api.lemlist.com/api"

interface LeadListItem {
  _id: string
  state?: string
  contactId?: string
  [key: string]: unknown
}

interface LeadDetail {
  _id: string
  email?: string
  firstName?: string
  lastName?: string
  state?: string
  createdAt?: string
  [key: string]: unknown
}

const STATE_MAP: Record<string, string> = {
  scanned: "active",
  contacted: "active",
  interested: "replied",
  notInterested: "completed",
  paused: "paused",
  bounced: "bounced",
  unsubscribed: "unsubscribed",
}

function mapLeadState(state: string | undefined): string {
  if (!state) return "active"
  return STATE_MAP[state] ?? "active"
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Fetch email for a lead via its contactId — tries /people, /contacts, then lead endpoints
async function fetchLeadEmail(
  leadId: string,
  contactId: string | undefined,
  campaignId: string,
  auth: string,
): Promise<LeadDetail | null> {
  const endpoints: Array<{ label: string; url: string }> = []

  // Primary: People API using contactId
  if (contactId) {
    endpoints.push(
      { label: "people", url: `${BASE}/people/${contactId}` },
      { label: "contacts", url: `${BASE}/contacts/${contactId}` },
      { label: "hooks", url: `${BASE}/hooks/${contactId}` },
    )
  }

  // Fallback: lead detail endpoints
  endpoints.push(
    { label: "leads", url: `${BASE}/leads/${leadId}` },
    { label: "campaign_leads", url: `${BASE}/campaigns/${campaignId}/leads/${leadId}` },
  )

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { headers: { Authorization: auth } })
      if (res.ok) {
        const data: LeadDetail = await res.json()
        if (data.email) {
          console.log(`[Lemlist Sync] Got email from ${ep.label}: ${data.email}`)
          return data
        }
        console.log(`[Lemlist Sync] ${ep.label} (${ep.url}) — no email, keys: ${Object.keys(data).join(", ")}`)
      } else {
        console.log(`[Lemlist Sync] ${ep.label} status: ${res.status}`)
      }
    } catch {
      // try next endpoint
    }
  }

  return null
}

// POST /api/lemlist/sync — pull campaign enrollment data from Lemlist into CRM
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET || ""
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const { error } = await requirePageAccess("crm")
    if (error) return error
  }

  if (!isLemlistConfigured()) {
    return NextResponse.json(
      { error: "Lemlist API key not configured" },
      { status: 500 },
    )
  }

  const auth = lemlistAuth()

  try {
    const campaigns = await getLemlistCampaigns()
    console.log(`[Lemlist Sync] Found ${campaigns.length} campaigns:`,
      JSON.stringify(campaigns.map(c => ({ _id: c._id, name: c.name }))))

    if (campaigns.length === 0) {
      return NextResponse.json({ synced: 0, notFound: 0, campaigns: 0 })
    }

    let synced = 0
    let notFound = 0
    let noEmail = 0
    const debugLog: Array<Record<string, unknown>> = []

    for (const campaign of campaigns) {
      console.log(`[Lemlist Sync] Processing campaign: ${campaign.name} (${campaign._id})`)

      // Step 1: Get lead list (returns _id, state, contactId — no email)
      let leadList: LeadListItem[] = []
      const listUrl = `${BASE}/campaigns/${campaign._id}/leads?offset=0&limit=100`
      console.log(`[Lemlist Sync] Fetching lead list: ${listUrl}`)

      try {
        const res = await fetch(listUrl, { headers: { Authorization: auth } })
        if (res.ok) {
          const raw = await res.json()
          if (Array.isArray(raw)) {
            leadList = raw
          }
        } else {
          console.error(`[Lemlist Sync] Lead list ${res.status} for ${campaign.name}`)
        }
      } catch (err) {
        console.error(`[Lemlist Sync] Lead list error for ${campaign.name}:`, err)
      }

      // Handle pagination — keep fetching until we get less than 100
      if (leadList.length === 100) {
        let offset = 100
        let hasMore = true
        while (hasMore) {
          try {
            const res = await fetch(
              `${BASE}/campaigns/${campaign._id}/leads?offset=${offset}&limit=100`,
              { headers: { Authorization: auth } },
            )
            if (res.ok) {
              const page = await res.json()
              if (Array.isArray(page) && page.length > 0) {
                leadList.push(...page)
                offset += page.length
                if (page.length < 100) hasMore = false
              } else {
                hasMore = false
              }
            } else {
              hasMore = false
            }
          } catch {
            hasMore = false
          }
          await delay(200)
        }
      }

      console.log(`[Lemlist Sync] Found ${leadList.length} leads in ${campaign.name}`)
      if (leadList.length > 0) {
        console.log(`[Lemlist Sync] First lead keys: ${Object.keys(leadList[0]).join(", ")}`)
        console.log(`[Lemlist Sync] First lead: ${JSON.stringify(leadList[0]).slice(0, 500)}`)
      }

      if (leadList.length === 0) {
        debugLog.push({ campaignId: campaign._id, campaignName: campaign.name, leadsInList: 0, synced: 0, notFound: 0, noEmail: 0 })
        continue
      }

      // Step 2: Fetch full details for each lead (to get email)
      const leadsWithEmail: LeadDetail[] = []
      let campaignNoEmail = 0

      for (let i = 0; i < leadList.length; i++) {
        const item = leadList[i]
        console.log(`[Lemlist Sync] Fetching lead detail ${i + 1}/${leadList.length} (_id=${item._id}, contactId=${item.contactId ?? "none"})`)

        const detail = await fetchLeadEmail(item._id, item.contactId, campaign._id, auth)
        if (detail?.email) {
          // Merge state from list if detail doesn't have it
          if (!detail.state && item.state) detail.state = item.state
          leadsWithEmail.push(detail)
        } else {
          campaignNoEmail++
          noEmail++
        }

        // Rate limit: 200ms between requests
        if (i < leadList.length - 1) await delay(200)
      }

      console.log(`[Lemlist Sync] Got email for ${leadsWithEmail.length}/${leadList.length} leads in ${campaign.name}`)

      if (leadsWithEmail.length === 0) {
        debugLog.push({ campaignId: campaign._id, campaignName: campaign.name, leadsInList: leadList.length, leadsWithEmail: 0, noEmail: campaignNoEmail, synced: 0, notFound: 0 })
        continue
      }

      // Step 3: Batch-match by email
      const emails = leadsWithEmail
        .map((l) => l.email!.toLowerCase())
        .filter(Boolean)

      const contacts = await prisma.crmContact.findMany({
        where: { email: { in: emails, mode: "insensitive" } },
        select: { id: true, email: true },
      })

      console.log(`[Lemlist Sync] Matched ${contacts.length}/${emails.length} to CRM contacts`)

      const contactByEmail = new Map(
        contacts.map((c) => [c.email.toLowerCase(), c.id]),
      )

      // Step 4: Update matched contacts
      let campaignSynced = 0
      let campaignNotFound = 0

      for (const lead of leadsWithEmail) {
        const email = lead.email!.toLowerCase()
        const contactId = contactByEmail.get(email)

        if (!contactId) {
          notFound++
          campaignNotFound++
          continue
        }

        const mappedStatus = mapLeadState(lead.state)

        await prisma.crmContact.update({
          where: { id: contactId },
          data: {
            lemlistCampaignId: campaign._id,
            lemlistCampaignName: campaign.name,
            lemlistStatus: mappedStatus,
            lemlistEnrolledAt: lead.createdAt ? new Date(lead.createdAt) : new Date(),
          },
        })

        synced++
        campaignSynced++
      }

      debugLog.push({
        campaignId: campaign._id,
        campaignName: campaign.name,
        leadsInList: leadList.length,
        leadsWithEmail: leadsWithEmail.length,
        noEmail: campaignNoEmail,
        matched: contacts.length,
        synced: campaignSynced,
        notFound: campaignNotFound,
      })
    }

    console.log(`[Lemlist Sync] Done: synced=${synced}, notFound=${notFound}, noEmail=${noEmail}, campaigns=${campaigns.length}`)

    return NextResponse.json({
      synced,
      notFound,
      noEmail,
      campaigns: campaigns.length,
      debug: debugLog,
    })
  } catch (err) {
    console.error("[Lemlist Sync] Error:", err)
    return NextResponse.json(
      { error: "Lemlist sync failed" },
      { status: 500 },
    )
  }
}
