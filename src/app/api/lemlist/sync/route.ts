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
  [key: string]: unknown
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
    console.log(`[Lemlist Sync] Found ${campaigns.length} campaigns:`, JSON.stringify(campaigns.map(c => ({ _id: c._id, name: c.name }))))

    if (campaigns.length === 0) {
      return NextResponse.json({ synced: 0, notFound: 0, campaigns: 0 })
    }

    let synced = 0
    let notFound = 0
    const debugLog: Array<Record<string, unknown>> = []

    for (const campaign of campaigns) {
      console.log(`[Lemlist Sync] Processing campaign: ${campaign.name} (${campaign._id})`)

      // Try multiple endpoint patterns — Lemlist API can vary
      let leads: LemlistLead[] = []
      let leadsSource = ""

      // Attempt 1: /leads with pagination
      const url1 = `https://api.lemlist.com/api/campaigns/${campaign._id}/leads?offset=0&limit=100`
      console.log(`[Lemlist Sync] Fetching leads from: ${url1}`)
      try {
        const res = await fetch(url1, { headers: { Authorization: lemlistAuth() } })
        console.log(`[Lemlist Sync] /leads response status: ${res.status}`)
        if (res.ok) {
          const raw = await res.json()
          console.log(`[Lemlist Sync] /leads raw response type: ${typeof raw}, isArray: ${Array.isArray(raw)}, length: ${Array.isArray(raw) ? raw.length : "n/a"}`)
          if (Array.isArray(raw) && raw.length > 0) {
            console.log(`[Lemlist Sync] /leads first item keys: ${Object.keys(raw[0]).join(", ")}`)
            console.log(`[Lemlist Sync] /leads first item: ${JSON.stringify(raw[0]).slice(0, 500)}`)
            leads = raw
            leadsSource = "leads_paginated"
          } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            // Response might be an object wrapping the leads
            console.log(`[Lemlist Sync] /leads response keys: ${Object.keys(raw).join(", ")}`)
            console.log(`[Lemlist Sync] /leads response preview: ${JSON.stringify(raw).slice(0, 500)}`)
            // Check common wrapper fields
            const possibleArrays = Object.entries(raw).filter(([, v]) => Array.isArray(v))
            if (possibleArrays.length > 0) {
              const [key, arr] = possibleArrays[0]
              console.log(`[Lemlist Sync] Found array in field "${key}" with ${(arr as unknown[]).length} items`)
              leads = arr as LemlistLead[]
              leadsSource = `leads_wrapped:${key}`
            }
          }
        }
      } catch (err) {
        console.error(`[Lemlist Sync] /leads fetch error:`, err)
      }

      // Attempt 2: /export endpoint if /leads returned nothing
      if (leads.length === 0) {
        const url2 = `https://api.lemlist.com/api/campaigns/${campaign._id}/export`
        console.log(`[Lemlist Sync] Trying export endpoint: ${url2}`)
        try {
          const res = await fetch(url2, { headers: { Authorization: lemlistAuth() } })
          console.log(`[Lemlist Sync] /export response status: ${res.status}`)
          if (res.ok) {
            const raw = await res.json()
            console.log(`[Lemlist Sync] /export raw type: ${typeof raw}, isArray: ${Array.isArray(raw)}, length: ${Array.isArray(raw) ? raw.length : "n/a"}`)
            if (Array.isArray(raw) && raw.length > 0) {
              console.log(`[Lemlist Sync] /export first item keys: ${Object.keys(raw[0]).join(", ")}`)
              console.log(`[Lemlist Sync] /export first item: ${JSON.stringify(raw[0]).slice(0, 500)}`)
              leads = raw
              leadsSource = "export"
            } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
              console.log(`[Lemlist Sync] /export response keys: ${Object.keys(raw).join(", ")}`)
              const possibleArrays = Object.entries(raw).filter(([, v]) => Array.isArray(v))
              if (possibleArrays.length > 0) {
                const [key, arr] = possibleArrays[0]
                leads = arr as LemlistLead[]
                leadsSource = `export_wrapped:${key}`
              }
            }
          }
        } catch (err) {
          console.error(`[Lemlist Sync] /export fetch error:`, err)
        }
      }

      // Attempt 3: v2 API
      if (leads.length === 0) {
        const url3 = `https://api.lemlist.com/api/campaigns/${campaign._id}/leads?version=2`
        console.log(`[Lemlist Sync] Trying v2 API: ${url3}`)
        try {
          const res = await fetch(url3, { headers: { Authorization: lemlistAuth() } })
          console.log(`[Lemlist Sync] v2 response status: ${res.status}`)
          if (res.ok) {
            const raw = await res.json()
            console.log(`[Lemlist Sync] v2 raw type: ${typeof raw}, isArray: ${Array.isArray(raw)}, length: ${Array.isArray(raw) ? raw.length : "n/a"}`)
            if (Array.isArray(raw) && raw.length > 0) {
              console.log(`[Lemlist Sync] v2 first item: ${JSON.stringify(raw[0]).slice(0, 500)}`)
              leads = raw
              leadsSource = "v2"
            } else if (raw && typeof raw === "object") {
              console.log(`[Lemlist Sync] v2 response keys: ${Object.keys(raw).join(", ")}`)
              console.log(`[Lemlist Sync] v2 response preview: ${JSON.stringify(raw).slice(0, 500)}`)
            }
          }
        } catch (err) {
          console.error(`[Lemlist Sync] v2 fetch error:`, err)
        }
      }

      const campaignDebug: Record<string, unknown> = {
        campaignId: campaign._id,
        campaignName: campaign.name,
        leadsFound: leads.length,
        leadsSource: leadsSource || "none",
      }

      if (leads.length === 0) {
        console.log(`[Lemlist Sync] No leads found for campaign ${campaign.name} after trying all endpoints`)
        debugLog.push(campaignDebug)
        continue
      }

      // Log all lead emails for debugging
      const leadEmails = leads.map(l => l.email).filter(Boolean)
      console.log(`[Lemlist Sync] Lead emails in ${campaign.name}: ${JSON.stringify(leadEmails)}`)

      // Batch-match leads by email
      const emails = leads
        .map((l) => l.email?.toLowerCase())
        .filter((e): e is string => Boolean(e))

      if (emails.length === 0) {
        console.log(`[Lemlist Sync] No valid emails in leads for ${campaign.name}`)
        debugLog.push({ ...campaignDebug, validEmails: 0 })
        continue
      }

      // Fetch matching contacts in one query
      const contacts = await prisma.crmContact.findMany({
        where: { email: { in: emails, mode: "insensitive" } },
        select: { id: true, email: true },
      })

      console.log(`[Lemlist Sync] Matched ${contacts.length}/${emails.length} emails to CRM contacts`)

      const contactByEmail = new Map(
        contacts.map((c) => [c.email.toLowerCase(), c.id]),
      )

      let campaignSynced = 0
      let campaignNotFound = 0

      // Update each matched contact
      for (const lead of leads) {
        const email = lead.email?.toLowerCase()
        if (!email) continue

        const contactId = contactByEmail.get(email)
        if (!contactId) {
          notFound++
          campaignNotFound++
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
        campaignSynced++
      }

      debugLog.push({ ...campaignDebug, matched: contacts.length, synced: campaignSynced, notFound: campaignNotFound })
    }

    console.log(
      `[Lemlist Sync] Done: synced=${synced}, notFound=${notFound}, campaigns=${campaigns.length}`,
    )

    return NextResponse.json({
      synced,
      notFound,
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
