import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTelegramMessage, formatBriefForTelegram } from "@/lib/telegram"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

// Oxen internal email domains
const INTERNAL_DOMAINS = ["oxen.finance", "oxen.mt", "greennation.green"]

function isInternalEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase()
  return INTERNAL_DOMAINS.some((d) => domain === d)
}

// Called every 15 minutes by cron / sync worker
export async function GET() {
  return checkUpcoming()
}

export async function POST() {
  return checkUpcoming()
}

async function checkUpcoming() {
  console.log("[check-upcoming] Starting check...")

  try {
    const now = new Date()
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)

    // Find calendar events starting in next 30 minutes
    let events: Array<{
      id: string
      googleEventId: string
      title: string
      description: string | null
      startTime: Date
      endTime: Date
      attendees: string[]
      location: string | null
      meetLink: string | null
    }> = []

    try {
      events = await prisma.calendarEvent.findMany({
        where: {
          startTime: { gte: now, lte: thirtyMinutesFromNow },
        },
        orderBy: { startTime: "asc" },
      })
    } catch {
      console.log("[check-upcoming] Calendar table not available")
      return NextResponse.json({ message: "Calendar not available", processed: 0 })
    }

    if (events.length === 0) {
      console.log("[check-upcoming] No upcoming events in next 30 min")
      return NextResponse.json({ message: "No upcoming events", processed: 0 })
    }

    console.log(`[check-upcoming] Found ${events.length} upcoming events`)
    const results: Array<{ event: string; action: string }> = []

    for (const event of events) {
      // Skip internal-only meetings (all attendees are Oxen emails)
      const hasExternalAttendee = event.attendees.some((a) => !isInternalEmail(a))
      const isInternalMeeting = !hasExternalAttendee && event.attendees.length > 0
      const titleLower = event.title.toLowerCase()
      const isTeamMeeting = /team call|standup|stand-up|internal|sync|1:1|one.on.one/i.test(titleLower)

      if (isInternalMeeting || isTeamMeeting) {
        console.log(`[check-upcoming] Skipping internal meeting: ${event.title}`)
        results.push({ event: event.title, action: "skipped_internal" })
        continue
      }

      // Check if brief already exists and was sent
      const existingBrief = await prisma.meetingBrief.findFirst({
        where: {
          OR: [
            { eventId: event.googleEventId },
            {
              title: event.title,
              meetingDate: {
                gte: new Date(event.startTime.getTime() - 60000),
                lte: new Date(event.startTime.getTime() + 60000),
              },
            },
          ],
        },
      })

      if (existingBrief && existingBrief.sentVia) {
        console.log(`[check-upcoming] Already sent brief for: ${event.title}`)
        results.push({ event: event.title, action: "already_sent" })
        continue
      }

      let brief = existingBrief

      // Generate brief if none exists
      if (!brief) {
        try {
          brief = await generateBrief(event)
          console.log(`[check-upcoming] Generated brief for: ${event.title}`)
          results.push({ event: event.title, action: "brief_generated" })
        } catch (err) {
          console.error(`[check-upcoming] Brief generation failed for ${event.title}:`, err)

          // Fallback: send basic notification
          const fallbackSent = await sendFallbackNotification(event)
          results.push({
            event: event.title,
            action: `generation_failed,fallback_sent_to:${fallbackSent.join(",") || "none"}`,
          })
          continue
        }
      }

      // Send brief via Telegram to attending employees
      const sentTo = await sendBriefToAttendees(brief, event)
      if (sentTo.length > 0) {
        await prisma.meetingBrief.update({
          where: { id: brief.id },
          data: { sentVia: `telegram:${sentTo.join(",")}` },
        })
        console.log(`[check-upcoming] Sent brief for ${event.title} to: ${sentTo.join(", ")}`)
        results.push({ event: event.title, action: `sent_to:${sentTo.join(",")}` })
      } else {
        results.push({ event: event.title, action: "no_telegram_recipients" })
      }
    }

    console.log(`[check-upcoming] Done. Processed ${events.length} events.`)
    return NextResponse.json({ processed: events.length, results })
  } catch (error) {
    console.error("[check-upcoming] Error:", error)
    return NextResponse.json({ error: "Failed to check upcoming events" }, { status: 500 })
  }
}

// ─── Generate brief via Claude ─────────────────────────

async function generateBrief(event: {
  googleEventId: string
  title: string
  startTime: Date
  endTime: Date
  attendees: string[]
}) {
  // Try to find a matching CRM contact from attendees
  let contact = null
  for (const att of event.attendees) {
    if (isInternalEmail(att)) continue // Skip internal emails

    const found = await prisma.crmContact.findFirst({
      where: {
        OR: [
          { email: { equals: att, mode: "insensitive" } },
        ],
      },
      include: {
        company: { select: { name: true, industry: true, website: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 10 },
        deals: { orderBy: { updatedAt: "desc" }, take: 5 },
      },
    })
    if (found) {
      contact = found
      break
    }
  }

  // Build context for Claude
  const contextParts: string[] = []
  if (contact) {
    contextParts.push(`## Contact: ${contact.firstName} ${contact.lastName ?? ""}`.trim())
    contextParts.push(`Email: ${contact.email}`)
    contextParts.push(`Company: ${contact.company?.name || "Unknown"} | Industry: ${contact.company?.industry || "?"}`)
    contextParts.push(`Lifecycle: ${contact.lifecycleStage} | ICP Fit: ${contact.icpFit || "?"}`)

    if (contact.activities.length > 0) {
      contextParts.push("\n## Recent Interactions (last 10)")
      for (const a of contact.activities) {
        contextParts.push(`- [${a.type}] ${new Date(a.createdAt).toLocaleDateString("en-GB")}: ${(a.description ?? "").substring(0, 200)}`)
      }
    }

    if (contact.deals.length > 0) {
      contextParts.push("\n## Active Deals")
      for (const d of contact.deals) {
        contextParts.push(`- ${d.dealName} | Stage: ${d.stage} | Value: €${d.dealValue?.toLocaleString() || "?"} | Owner: ${d.dealOwner || "?"}`)
      }
    }
  }

  const prompt = `Generate a concise meeting brief for a sales team at Oxen Finance (B2B payment services). Return ONLY valid JSON.

MEETING: ${event.title}
DATE: ${new Date(event.startTime).toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
TIME: ${new Date(event.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
ATTENDEES: ${event.attendees.join(", ")}

${contextParts.length > 0 ? "CRM CONTEXT:\n" + contextParts.join("\n") : "No CRM data available for attendees."}

Return JSON with these fields (all strings, talking_points/risks/opportunities are string arrays):
{
  "company_context": "Brief about the company/person",
  "relationship_history": "Summary of past interactions",
  "deal_status": "Current deal stage and value if applicable",
  "talking_points": ["point 1", "point 2", "point 3"],
  "risks": ["risk 1"],
  "opportunities": ["opportunity 1"],
  "suggested_ask": "Recommended next step or ask for this meeting"
}`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  })

  const responseText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  const briefContent = jsonMatch
    ? JSON.parse(jsonMatch[0])
    : { company_context: "Auto-generated brief — no CRM data available", talking_points: ["Review agenda before meeting"] }

  return prisma.meetingBrief.create({
    data: {
      eventId: event.googleEventId,
      contactId: contact?.id || null,
      title: event.title,
      meetingDate: event.startTime,
      attendees: event.attendees,
      briefContent,
      createdBy: "auto",
    },
  })
}

// ─── Send brief to employees ───────────────────────────

async function sendBriefToAttendees(
  brief: { id: string; title: string; meetingDate: Date; attendees: string[]; briefContent: unknown },
  event: { endTime: Date; attendees: string[] },
): Promise<string[]> {
  const sentTo: string[] = []

  for (const att of event.attendees) {
    // Only try to match Oxen employees
    if (!isInternalEmail(att)) continue

    const employee = await prisma.employee.findFirst({
      where: {
        email: { equals: att, mode: "insensitive" },
        telegramChatId: { not: null },
      },
      select: { name: true, telegramChatId: true },
    })

    if (!employee?.telegramChatId) continue

    const formatted = formatBriefForTelegram({
      title: brief.title,
      meetingDate: brief.meetingDate,
      endTime: event.endTime,
      attendees: brief.attendees,
      briefContent: brief.briefContent as Record<string, unknown>,
    })

    const result = await sendTelegramMessage(employee.telegramChatId, formatted)
    if (result.ok) {
      sentTo.push(employee.name)
      console.log(`[check-upcoming] Sent brief to ${employee.name}`)
    } else {
      console.error(`[check-upcoming] Failed to send to ${employee.name}:`, result.description)
    }
  }

  return sentTo
}

// ─── Fallback notification when brief generation fails ──

async function sendFallbackNotification(event: {
  title: string
  startTime: Date
  attendees: string[]
}): Promise<string[]> {
  const sentTo: string[] = []
  const timeStr = new Date(event.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const externalAttendees = event.attendees.filter((a) => !isInternalEmail(a))

  for (const att of event.attendees) {
    if (!isInternalEmail(att)) continue

    const employee = await prisma.employee.findFirst({
      where: {
        email: { equals: att, mode: "insensitive" },
        telegramChatId: { not: null },
      },
      select: { name: true, telegramChatId: true },
    })

    if (!employee?.telegramChatId) continue

    const msg = `📅 <b>Upcoming meeting in 30 min</b>\n\n` +
      `${event.title}\n` +
      `🕐 ${timeStr}\n` +
      `👥 ${externalAttendees.join(", ") || "Internal"}\n\n` +
      `<i>Brief generation failed — check CRM for context.</i>`

    const result = await sendTelegramMessage(employee.telegramChatId, msg)
    if (result.ok) sentTo.push(employee.name)
  }

  return sentTo
}
