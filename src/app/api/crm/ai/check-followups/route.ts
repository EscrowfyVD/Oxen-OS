import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { STAGE_LABELS } from "@/lib/crm-config"
import { sendTelegramNotificationByEmail } from "@/lib/telegram"

const anthropic = new Anthropic()

const ACTIVE_STAGES = [
  "replied",
  "meeting_booked",
  "meeting_completed",
  "proposal_sent",
  "negotiation",
]

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.oxen.io"

// ─── Stall detection helpers ────────────────────────────

type StallReason =
  | "no_response_5_days"
  | "meeting_no_followup"
  | "proposal_no_response"
  | "conversation_stalled"

interface Activity {
  id: string
  type: string
  description: string | null
  createdAt: Date
}

function detectStall(
  deal: { stage: string },
  activities: Activity[],
): StallReason | null {
  const now = Date.now()
  const msPerDay = 86_400_000

  // Sort by date descending (newest first)
  const sorted = [...activities].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  // no_response_5_days: last outbound email with no inbound reply in 5+ days
  const lastOutbound = sorted.find((a) =>
    ["email_sent", "linkedin_message", "whatsapp_message", "call_outbound"].includes(a.type),
  )
  if (lastOutbound) {
    const outboundTime = new Date(lastOutbound.createdAt).getTime()
    const hasInboundAfter = sorted.some(
      (a) =>
        ["email_received", "call_inbound"].includes(a.type) &&
        new Date(a.createdAt).getTime() > outboundTime,
    )
    if (!hasInboundAfter && now - outboundTime > 5 * msPerDay) {
      return "no_response_5_days"
    }
  }

  // meeting_no_followup: meeting_completed activity with no email_sent within 48h after
  const meetingActivity = sorted.find((a) =>
    ["meeting_calendly", "meeting_manual"].includes(a.type),
  )
  if (
    meetingActivity &&
    deal.stage === "meeting_completed"
  ) {
    const meetingTime = new Date(meetingActivity.createdAt).getTime()
    const hasFollowup = sorted.some(
      (a) =>
        a.type === "email_sent" &&
        new Date(a.createdAt).getTime() > meetingTime,
    )
    if (!hasFollowup && now - meetingTime > 2 * msPerDay) {
      return "meeting_no_followup"
    }
  }

  // proposal_no_response: proposal_sent stage with no activity in 5+ days
  if (deal.stage === "proposal_sent") {
    const lastActivity = sorted[0]
    if (lastActivity && now - new Date(lastActivity.createdAt).getTime() > 5 * msPerDay) {
      return "proposal_no_response"
    }
  }

  // conversation_stalled: any active deal with no activity in 7+ days
  const lastActivity = sorted[0]
  if (!lastActivity || now - new Date(lastActivity.createdAt).getTime() > 7 * msPerDay) {
    return "conversation_stalled"
  }

  return null
}

// ─── POST: detect stalled deals & generate follow-ups ───

export async function POST() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const deals = await prisma.deal.findMany({
    where: { stage: { in: ACTIVE_STAGES } },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: { select: { name: true } },
        },
      },
      company: { select: { id: true, name: true } },
    },
  })

  let generated = 0
  let skipped = 0

  for (const deal of deals) {
    // Fetch last 10 activities for this deal's contact
    const activities = await prisma.activity.findMany({
      where: {
        OR: [{ dealId: deal.id }, { contactId: deal.contactId }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    const stallReason = detectStall(deal, activities)
    if (!stallReason) {
      skipped++
      continue
    }

    // Skip if a pending follow-up already exists for this deal
    const existing = await prisma.aIFollowUp.findFirst({
      where: { dealId: deal.id, status: "pending" },
    })
    if (existing) {
      skipped++
      continue
    }

    const contact = deal.contact
    if (!contact) {
      skipped++
      continue
    }

    const companyName = deal.company?.name || contact.company?.name || "Unknown"
    const lastActivity = activities[0]
    const recentSummary = activities
      .slice(0, 5)
      .map(
        (a) =>
          `- ${a.type} on ${new Date(a.createdAt).toLocaleDateString()}: ${(a.description || "N/A").slice(0, 80)}`,
      )
      .join("\n")

    const prompt = `Generate a follow-up message for this stalled deal.

Contact: ${contact.firstName} ${contact.lastName} at ${companyName}
Deal stage: ${STAGE_LABELS[deal.stage] || deal.stage}
Last activity: ${lastActivity ? `${lastActivity.type} on ${new Date(lastActivity.createdAt).toLocaleDateString()} — ${(lastActivity.description || "N/A").slice(0, 100)}` : "No recent activity"}
Recent activities:
${recentSummary || "None"}
Deal value: ${deal.dealValue ? `€${deal.dealValue.toLocaleString()}` : "Not set"}

Rules:
- Match a professional but warm tone
- Maximum one question per message
- Reference something specific from the last conversation
- 3-5 sentences max

Return JSON: {
  "subject": "Re: ...",
  "body": "...",
  "suggestedAction": "send_follow_up" | "schedule_call" | "send_reminder",
  "reason": "one-line explanation of why follow-up is needed"
}

RESPOND ONLY WITH VALID JSON, no markdown.`

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      })

      const text =
        response.content[0].type === "text" ? response.content[0].text : ""
      const jsonStr = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim()
      const parsed = JSON.parse(jsonStr) as {
        subject?: string
        body?: string
        suggestedAction?: string
        reason?: string
      }

      const draftMessage = JSON.stringify({
        subject: parsed.subject || "Follow-up",
        body: parsed.body || "",
      })

      const followUp = await prisma.aIFollowUp.create({
        data: {
          contactId: contact.id,
          dealId: deal.id,
          reason: stallReason,
          suggestedAction: parsed.suggestedAction || "send_follow_up",
          draftMessage,
          status: "pending",
          assignee: deal.dealOwner || "Andy",
        },
      })

      // Send Telegram notification to deal owner
      if (deal.dealOwner) {
        const bodyPreview = (parsed.body || "").slice(0, 100)
        const reasonText =
          parsed.reason || stallReason.replace(/_/g, " ")
        const telegramMsg = [
          "\u{1F916} Follow-up Suggestion",
          "",
          `\u{1F464} ${contact.firstName} ${contact.lastName} at ${companyName}`,
          `\u{1F4CB} ${reasonText}`,
          "",
          `Draft: ${bodyPreview}...`,
          "",
          `Open in CRM: ${APP_URL}/crm/contacts/${contact.id}`,
        ].join("\n")

        // Look up employee by deal owner name to get their email
        const ownerEmployee = await prisma.employee.findFirst({
          where: { name: { contains: deal.dealOwner, mode: "insensitive" } },
          select: { email: true },
        })
        if (ownerEmployee?.email) {
          await sendTelegramNotificationByEmail(ownerEmployee.email, telegramMsg)
        }
      }

      generated++
    } catch (err) {
      console.error(
        `Follow-up generation failed for deal ${deal.id}:`,
        err,
      )
      skipped++
    }
  }

  return NextResponse.json({ generated, skipped })
}
