// AIRA F2 — Pre-Meeting Briefings (PR1).
//
// Session-FREE meeting-brief generation, extracted from
// src/app/api/ai/brief/route.ts so it can be called from both the existing
// auth-gated UI endpoint AND (PR2) the Cal.com webhook, with no auth/session
// dependency. Assembles CRM context → Claude → saves MeetingBrief → delivers
// via Telegram → returns the brief.
//
// PR1 also closes the F1 gap from Andy's spec: the assembled context now
// includes recent (non-expired) IntentSignal history for the contact.
//
// Behaviour is identical to the previous inline route logic except: on a
// failure the function THROWS (the caller maps to its own error response),
// and the brief context gains the Intent Signals section.

import type { Prisma } from "@prisma/client"
import { CLAUDE_MODEL } from "@/lib/ai/model"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { sendTelegramMessage, formatBriefForTelegram } from "@/lib/telegram"

const anthropic = new Anthropic()

// Recent intent signals fed into the brief context (F1 history).
const MAX_SIGNALS = 10

const BRIEF_INCLUDE = {
  contact: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: { select: { name: true } },
    },
  },
} satisfies Prisma.MeetingBriefInclude

export type GeneratedMeetingBrief = Prisma.MeetingBriefGetPayload<{
  include: typeof BRIEF_INCLUDE
}>

export interface GenerateMeetingBriefInput {
  eventId?: string | null
  contactId?: string | null
  meetingDate: string | Date
  title: string
  attendees?: string[]
  /**
   * Optional free-text context block injected verbatim into the prompt's
   * CONTEXT section (e.g. LemCal booking Q&A). It reaches the prompt even when
   * no contact matched — for a no-match booking these answers are frequently
   * the ONLY actionable context the brief has. UI callers omit it (the param is
   * backward-compatible).
   */
  extraContext?: string | null
  /**
   * Optional short marker prepended to the Telegram message (e.g. the PR3b
   * refresh runner passes "🔄 Brief actualisé" so the BD sees this is a refresh,
   * not a new booking). Webhook/UI omit it → no marker, behaviour unchanged.
   */
  telegramNote?: string | null
}

export interface GenerateMeetingBriefResult {
  brief: GeneratedMeetingBrief
  telegramSentTo: string[]
}

const CONTACT_INCLUDE = {
  activities: { orderBy: { createdAt: "desc" as const }, take: 10 },
  deals: { orderBy: { updatedAt: "desc" as const }, take: 5 },
  companyIntel: { orderBy: { updatedAt: "desc" as const }, take: 1 },
  company: { select: { name: true } },
} satisfies Prisma.CrmContactInclude

/**
 * Generate (and persist + Telegram-deliver) a meeting brief. Pure of any
 * HTTP/session concern — callers (UI route, Cal.com webhook) own auth and
 * error-response mapping. Throws on generation failure.
 */
export async function generateMeetingBrief(
  input: GenerateMeetingBriefInput,
): Promise<GenerateMeetingBriefResult> {
  const { eventId, contactId, meetingDate, title, attendees, extraContext, telegramNote } =
    input

  // Gather all context for the brief
  const contextParts: string[] = []

  // Contact data
  let contact = null
  if (contactId) {
    contact = await prisma.crmContact.findUnique({
      where: { id: contactId },
      include: CONTACT_INCLUDE,
    })
  }

  // If no contact but attendees, try to find by name/email
  if (!contact && attendees?.length) {
    for (const att of attendees) {
      const found = await prisma.crmContact.findFirst({
        where: {
          OR: [
            { email: { equals: att, mode: "insensitive" } },
            { firstName: { contains: att.split("@")[0], mode: "insensitive" } },
            { lastName: { contains: att.split("@")[0], mode: "insensitive" } },
          ],
        },
        include: CONTACT_INCLUDE,
      })
      if (found) {
        contact = found
        break
      }
    }
  }

  if (contact) {
    contextParts.push(`## Contact: ${contact.firstName} ${contact.lastName}`)
    contextParts.push(
      `Company: ${contact.company?.name || "?"} | Email: ${contact.email || "?"} | Stage: ${contact.lifecycleStage} | Relationship: ${contact.relationshipStrength || "?"}`,
    )
    contextParts.push(
      `Vertical: ${contact.vertical.join(", ") || "?"} | ICP Fit: ${contact.icpFit || "?"} | Country: ${contact.country || "?"}`,
    )
    if (contact.pinnedNote) contextParts.push(`Notes: ${contact.pinnedNote}`)

    if (contact.activities.length > 0) {
      contextParts.push("\n## Relationship History")
      for (const a of contact.activities) {
        contextParts.push(
          `- [${a.type}] ${new Date(a.createdAt).toLocaleDateString()}: ${a.description || ""}`,
        )
      }
    }

    if (contact.deals.length > 0) {
      contextParts.push("\n## Deals")
      for (const d of contact.deals) {
        contextParts.push(
          `- ${d.dealName} | Stage: ${d.stage} | Value: €${d.dealValue?.toLocaleString() || "?"} | Probability: ${d.winProbability || "?"}% | Owner: ${d.dealOwner || "?"}`,
        )
      }
    }

    if (contact.companyIntel.length > 0) {
      const intel = contact.companyIntel[0]
      contextParts.push("\n## Company Intel")
      if (intel.description) contextParts.push(`Description: ${intel.description}`)
      if (intel.industry) contextParts.push(`Industry: ${intel.industry}`)
      if (intel.employeeCount)
        contextParts.push(`Size: ${intel.employeeCount} employees`)
      if (intel.revenue) contextParts.push(`Revenue: ${intel.revenue}`)
      if (intel.keyPeople)
        contextParts.push(`Key People: ${JSON.stringify(intel.keyPeople)}`)
      if (intel.recentNews)
        contextParts.push(`Recent News: ${JSON.stringify(intel.recentNews)}`)
    }
  }

  // Fetch open support tickets for context
  if (contact) {
    const openTickets = await prisma.supportTicket.findMany({
      where: {
        contactId: contact.id,
        status: { in: ["open", "in_progress", "waiting_client"] },
      },
      select: { subject: true, priority: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    })
    if (openTickets.length > 0) {
      const latest = openTickets[0]
      contextParts.push(
        `\n## ⚠️ Active Support Issues: ${openTickets.length} open ticket${openTickets.length > 1 ? "s" : ""}. Latest: ${latest.subject} (${latest.priority})`,
      )
      for (const t of openTickets) {
        contextParts.push(
          `- [${t.status.replace(/_/g, " ")}] ${t.subject} | Priority: ${t.priority} | Created: ${new Date(t.createdAt).toLocaleDateString()}`,
        )
      }
    }
  }

  // ── PR1 — F1 intent-signal history (the spec's "all signal history") ──
  // Recent, non-expired signals on the contact. Drives talking points /
  // opportunities / recent-news in the generated brief.
  if (contact) {
    const now = new Date()
    const signals = await prisma.intentSignal.findMany({
      where: {
        contactId: contact.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: MAX_SIGNALS,
      select: {
        source: true,
        signalType: true,
        title: true,
        detail: true,
        points: true,
        intentCategory: true,
        signalLevel: true,
        createdAt: true,
      },
    })
    if (signals.length > 0) {
      contextParts.push(
        `\n## Intent Signals (recent, non-expired) — ${signals.length}`,
      )
      for (const s of signals) {
        const cat = s.intentCategory
          ? ` · cat ${s.intentCategory}${s.signalLevel ? `/${s.signalLevel}` : ""}`
          : ""
        contextParts.push(
          `- [${s.source}/${s.signalType}] ${new Date(s.createdAt).toLocaleDateString()} · ${s.points}pts${cat}: ${s.title}${s.detail ? ` — ${s.detail}` : ""}`,
        )
      }
    }
  }

  // Caller-supplied extra context (e.g. LemCal booking Q&A). Pushed verbatim so
  // it reaches the prompt even when no contact matched — for a no-match booking
  // these answers are frequently the only actionable context the BD will have.
  if (extraContext && extraContext.trim()) {
    contextParts.push("\n## Booking Details (provided by the prospect at booking time)")
    contextParts.push(extraContext.trim())
  }

  const prompt = `Generate a comprehensive meeting brief for the following meeting. Return ONLY a valid JSON object.

MEETING: ${title}
DATE: ${new Date(meetingDate).toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
ATTENDEES: ${attendees?.join(", ") || "Not specified"}

${contextParts.length > 0 ? "CONTEXT:\n" + contextParts.join("\n") : "No CRM data available for this contact."}

Return JSON with this exact structure:
{
  "company_context": "2-3 sentences about what the company does and their current situation",
  "relationship_history": "Summary of past interactions, key discussion points, promises made",
  "deal_status": "Current deal stage, value, probability, days in stage, next steps",
  "recent_news": "Any relevant news or developments about their company/industry",
  "talking_points": ["Point 1", "Point 2", "Point 3", "Point 4"],
  "risks": ["Risk 1", "Risk 2"],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "suggested_ask": "The key thing to push for in this meeting"
}

Be specific, actionable, and reference real data. If no data available for a section, provide strategic recommendations based on the meeting context.`

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  })

  const responseText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error("Failed to parse brief content")
  }

  const briefContent = JSON.parse(jsonMatch[0])

  // Save to DB. When eventId is set (LemCal bookings) the brief is UPSERTED by
  // the @unique eventId → re-generation (PR3b 1h-before refresh, or a webhook
  // re-delivery) UPDATES the same row instead of throwing P2002. When eventId is
  // null (UI path) we create — Postgres allows multiple NULLs on a @unique col,
  // so the UI behaviour is unchanged.
  const meetingDateValue = new Date(meetingDate)
  const attendeesValue = attendees || []
  const contactIdValue = contact?.id || null
  const brief = eventId
    ? await prisma.meetingBrief.upsert({
        where: { eventId },
        create: {
          eventId,
          contactId: contactIdValue,
          title,
          meetingDate: meetingDateValue,
          attendees: attendeesValue,
          briefContent,
          createdBy: "ai",
        },
        // Refresh: regenerate content + re-link context; preserve createdAt /
        // createdBy / status / eventId.
        update: {
          contactId: contactIdValue,
          title,
          meetingDate: meetingDateValue,
          attendees: attendeesValue,
          briefContent,
        },
        include: BRIEF_INCLUDE,
      })
    : await prisma.meetingBrief.create({
        data: {
          eventId: null,
          contactId: contactIdValue,
          title,
          meetingDate: meetingDateValue,
          attendees: attendeesValue,
          briefContent,
          createdBy: "ai",
        },
        include: BRIEF_INCLUDE,
      })

  // Auto-send via Telegram to relevant team members
  const telegramSentTo: string[] = []
  try {
    for (const att of attendees || []) {
      const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            { email: { equals: att, mode: "insensitive" } },
            { name: { contains: att.split("@")[0], mode: "insensitive" } },
          ],
          telegramChatId: { not: null },
        },
        select: { name: true, telegramChatId: true },
      })
      if (!employee?.telegramChatId) continue

      const formatted = formatBriefForTelegram({
        title,
        meetingDate: new Date(meetingDate),
        attendees: attendees || [],
        briefContent,
        note: telegramNote ?? undefined,
      })
      const result = await sendTelegramMessage(employee.telegramChatId, formatted)
      if (result.ok) telegramSentTo.push(employee.name)
    }

    if (telegramSentTo.length > 0) {
      await prisma.meetingBrief.update({
        where: { id: brief.id },
        data: { sentVia: `telegram:${telegramSentTo.join(",")}` },
      })
    }
  } catch (err) {
    console.error("Telegram auto-send error:", err)
  }

  return { brief, telegramSentTo }
}
