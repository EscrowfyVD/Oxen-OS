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

interface LemlistContact {
  _id: string
  email?: string
  fullName?: string
  fields?: { firstName?: string; lastName?: string; [key: string]: unknown }
  campaigns?: Array<{
    _id?: string
    campaignState?: string
    leadState?: string
    [key: string]: unknown
  }>
  createdAt?: string
  [key: string]: unknown
}

const STATE_MAP: Record<string, string> = {
  review: "active",
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

      // Step 1: Get lead list (returns _id, state, contactId)
      let leadList: LeadListItem[] = []
      const listUrl = `${BASE}/campaigns/${campaign._id}/leads?offset=0&limit=100`

      try {
        const res = await fetch(listUrl, { headers: { Authorization: auth } })
        if (res.ok) {
          const raw = await res.json()
          if (Array.isArray(raw)) leadList = raw
        } else {
          console.error(`[Lemlist Sync] Lead list ${res.status} for ${campaign.name}`)
        }
      } catch (err) {
        console.error(`[Lemlist Sync] Lead list error for ${campaign.name}:`, err)
      }

      // Pagination
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
              } else { hasMore = false }
            } else { hasMore = false }
          } catch { hasMore = false }
          await delay(200)
        }
      }

      console.log(`[Lemlist Sync] ${leadList.length} leads in ${campaign.name}`)

      if (leadList.length === 0) {
        debugLog.push({ campaignId: campaign._id, campaignName: campaign.name, leadsInList: 0 })
        continue
      }

      // Step 2: Fetch contact details via GET /api/contacts/{contactId}
      interface ResolvedLead { email: string; state: string; createdAt?: string }
      const resolved: ResolvedLead[] = []
      let campaignNoEmail = 0

      for (let i = 0; i < leadList.length; i++) {
        const item = leadList[i]
        if (!item.contactId) {
          console.log(`[Lemlist Sync] Lead ${i + 1}/${leadList.length} has no contactId, skipping`)
          campaignNoEmail++
          noEmail++
          continue
        }

        try {
          const res = await fetch(`${BASE}/contacts/${item.contactId}`, {
            headers: { Authorization: auth },
          })
          if (res.ok) {
            const contact: LemlistContact = await res.json()
            if (contact.email) {
              // Extract leadState for this campaign from the contact's campaigns array
              let leadState = item.state
              if (contact.campaigns && Array.isArray(contact.campaigns)) {
                const match = contact.campaigns.find(c => c._id === campaign._id)
                if (match?.leadState) leadState = match.leadState
              }
              resolved.push({
                email: contact.email,
                state: leadState ?? "active",
                createdAt: contact.createdAt,
              })
            } else {
              console.log(`[Lemlist Sync] /contacts/${item.contactId} has no email`)
              campaignNoEmail++
              noEmail++
            }
          } else {
            console.log(`[Lemlist Sync] /contacts/${item.contactId} status: ${res.status}`)
            campaignNoEmail++
            noEmail++
          }
        } catch {
          campaignNoEmail++
          noEmail++
        }

        // Rate limit: 200ms between requests
        if (i < leadList.length - 1) await delay(200)
      }

      console.log(`[Lemlist Sync] Resolved ${resolved.length}/${leadList.length} emails in ${campaign.name}`)

      if (resolved.length === 0) {
        debugLog.push({ campaignId: campaign._id, campaignName: campaign.name, leadsInList: leadList.length, resolved: 0, noEmail: campaignNoEmail })
        continue
      }

      // Step 3: Batch-match by email to CRM
      const emails = resolved.map(r => r.email.toLowerCase())

      const crmContacts = await prisma.crmContact.findMany({
        where: { email: { in: emails, mode: "insensitive" } },
        select: { id: true, email: true },
      })

      console.log(`[Lemlist Sync] Matched ${crmContacts.length}/${emails.length} to CRM`)

      const contactByEmail = new Map(
        crmContacts.map(c => [c.email.toLowerCase(), c.id]),
      )

      // Step 4: Update matched contacts
      let campaignSynced = 0
      let campaignNotFound = 0

      for (const lead of resolved) {
        const crmId = contactByEmail.get(lead.email.toLowerCase())
        if (!crmId) {
          notFound++
          campaignNotFound++
          continue
        }

        await prisma.crmContact.update({
          where: { id: crmId },
          data: {
            lemlistCampaignId: campaign._id,
            lemlistCampaignName: campaign.name,
            lemlistStatus: mapLeadState(lead.state),
            lemlistEnrolledAt: lead.createdAt ? new Date(lead.createdAt) : new Date(),
          },
        })

        synced++
        campaignSynced++
      }

      // Step 5: Upsert OutreachCampaign and calculate metrics from resolved leads
      const stateCounts = { sent: 0, replied: 0, bounced: 0, unsubscribed: 0, interested: 0, notInterested: 0 }
      for (const lead of resolved) {
        const s = lead.state
        if (s !== "scanned") stateCounts.sent++
        if (s === "interested" || s === "replied") { stateCounts.replied++; stateCounts.interested++ }
        if (s === "notInterested") stateCounts.notInterested++
        if (s === "bounced") stateCounts.bounced++
        if (s === "unsubscribed") stateCounts.unsubscribed++
      }

      try {
        await prisma.outreachCampaign.upsert({
          where: { lemlistCampaignId: campaign._id },
          update: {
            name: campaign.name,
            status: "active",
            totalSent: stateCounts.sent,
            totalReplied: stateCounts.replied,
            totalBounced: stateCounts.bounced,
            totalUnsubscribed: stateCounts.unsubscribed,
            repliesInterested: stateCounts.interested,
            repliesNotInterested: stateCounts.notInterested,
          },
          create: {
            lemlistCampaignId: campaign._id,
            name: campaign.name,
            owner: "Unknown",
            platform: "lemlist",
            status: "active",
            totalSent: stateCounts.sent,
            totalReplied: stateCounts.replied,
            totalBounced: stateCounts.bounced,
            totalUnsubscribed: stateCounts.unsubscribed,
            repliesInterested: stateCounts.interested,
            repliesNotInterested: stateCounts.notInterested,
          },
        })
      } catch (err) {
        console.error(`[Lemlist Sync] OutreachCampaign upsert error for ${campaign.name}:`, err)
      }

      debugLog.push({
        campaignId: campaign._id,
        campaignName: campaign.name,
        leadsInList: leadList.length,
        resolved: resolved.length,
        noEmail: campaignNoEmail,
        matched: crmContacts.length,
        synced: campaignSynced,
        notFound: campaignNotFound,
        outreachMetrics: stateCounts,
      })
    }

    // Also upsert OutreachCampaigns for campaigns with 0 leads (so they still show up)
    for (const campaign of campaigns) {
      const alreadyInLog = debugLog.some(d => d.campaignId === campaign._id && d.resolved && (d.resolved as number) > 0)
      if (!alreadyInLog) {
        try {
          await prisma.outreachCampaign.upsert({
            where: { lemlistCampaignId: campaign._id },
            update: { name: campaign.name },
            create: {
              lemlistCampaignId: campaign._id,
              name: campaign.name,
              owner: "Unknown",
              platform: "lemlist",
              status: "active",
            },
          })
        } catch { /* ignore duplicates */ }
      }
    }

    console.log(`[Lemlist Sync] Done: synced=${synced}, notFound=${notFound}, noEmail=${noEmail}, campaigns=${campaigns.length}`)

    return NextResponse.json({ synced, notFound, noEmail, campaigns: campaigns.length, outreachCampaignsSynced: campaigns.length, debug: debugLog })
  } catch (err) {
    console.error("[Lemlist Sync] Error:", err)
    return NextResponse.json({ error: "Lemlist sync failed" }, { status: 500 })
  }
}
