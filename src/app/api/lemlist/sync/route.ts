import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { getLemlistCampaigns, lemlistAuth, isLemlistConfigured } from "@/lib/lemlist"

interface LemlistLead {
  _id: string
  email: string
  firstName?: string
  lastName?: string
  status?: string
  campaignId?: string
  createdAt?: string
}

const STATUS_MAP: Record<string, string> = {
  interested: "replied",
  notInterested: "completed",
  contacted: "active",
  paused: "paused",
  bounced: "bounced",
  unsubscribed: "unsubscribed",
}

function mapLemlistStatus(lemlistStatus: string | undefined): string {
  if (!lemlistStatus) return "active"
  return STATUS_MAP[lemlistStatus] ?? "active"
}

// POST /api/lemlist/sync — pull campaign enrollment data from Lemlist into CRM
export async function POST(request: Request) {
  // Allow both authenticated user calls and internal cron calls
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

  try {
    const campaigns = await getLemlistCampaigns()
    if (campaigns.length === 0) {
      return NextResponse.json({ synced: 0, notFound: 0, campaigns: 0 })
    }

    let synced = 0
    let notFound = 0

    for (const campaign of campaigns) {
      // Fetch all leads for this campaign
      let leads: LemlistLead[] = []
      try {
        const res = await fetch(
          `https://api.lemlist.com/api/campaigns/${campaign._id}/leads`,
          { headers: { Authorization: lemlistAuth() } },
        )
        if (!res.ok) {
          console.error(`[Lemlist Sync] Failed to fetch leads for campaign ${campaign.name}: ${res.status}`)
          continue
        }
        leads = await res.json()
      } catch (err) {
        console.error(`[Lemlist Sync] Network error fetching leads for ${campaign.name}:`, err)
        continue
      }

      if (!Array.isArray(leads)) continue

      // Batch-match leads by email
      const emails = leads
        .map((l) => l.email?.toLowerCase())
        .filter((e): e is string => Boolean(e))

      if (emails.length === 0) continue

      // Fetch matching contacts in one query
      const contacts = await prisma.crmContact.findMany({
        where: { email: { in: emails, mode: "insensitive" } },
        select: { id: true, email: true },
      })

      const contactByEmail = new Map(
        contacts.map((c) => [c.email.toLowerCase(), c.id]),
      )

      // Update each matched contact
      for (const lead of leads) {
        const email = lead.email?.toLowerCase()
        if (!email) continue

        const contactId = contactByEmail.get(email)
        if (!contactId) {
          notFound++
          continue
        }

        const mappedStatus = mapLemlistStatus(lead.status)

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
      }
    }

    console.log(
      `[Lemlist Sync] Done: synced=${synced}, notFound=${notFound}, campaigns=${campaigns.length}`,
    )

    return NextResponse.json({
      synced,
      notFound,
      campaigns: campaigns.length,
    })
  } catch (err) {
    console.error("[Lemlist Sync] Error:", err)
    return NextResponse.json(
      { error: "Lemlist sync failed" },
      { status: 500 },
    )
  }
}
