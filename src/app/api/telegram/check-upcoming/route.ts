import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendTelegramMessage, formatBriefForTelegram } from "@/lib/telegram"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

// Called every 15 minutes by Railway cron or external scheduler
// GET for easy cron/health-check, POST for manual trigger
export async function GET() {
  return checkUpcoming()
}

export async function POST() {
  return checkUpcoming()
}

async function checkUpcoming() {
  try {
    const now = new Date()
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)

    // Find calendar events starting in next 30 minutes
    let events: Array<{
      id: string
      googleEventId: string
      title: string
      startTime: Date
      attendees: string[]
    }> = []
    try {
      events = await prisma.calendarEvent.findMany({
        where: {
          startTime: { gte: now, lte: thirtyMinutesFromNow },
        },
        orderBy: { startTime: "asc" },
      })
    } catch {
      return NextResponse.json({ message: "Calendar not available", processed: 0 })
    }

    if (events.length === 0) {
      return NextResponse.json({ message: "No upcoming events", processed: 0 })
    }

    const results: Array<{ event: string; action: string }> = []

    for (const event of events) {
      // Check if brief already exists
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
        results.push({ event: event.title, action: "already_sent" })
        continue
      }

      let brief = existingBrief

      // Generate brief if none exists
      if (!brief) {
        try {
          brief = await generateBrief(event)
          results.push({ event: event.title, action: "brief_generated" })
        } catch (err) {
          console.error(`Failed to generate brief for ${event.title}:`, err)
          results.push({ event: event.title, action: "generation_failed" })
          continue
        }
      }

      // Send via Telegram to attendee employees
      const sentTo = await sendBriefToAttendees(brief, event.attendees)
      if (sentTo.length > 0) {
        await prisma.meetingBrief.update({
          where: { id: brief.id },
          data: { sentVia: `telegram:${sentTo.join(",")}` },
        })
        results.push({ event: event.title, action: `sent_to:${sentTo.join(",")}` })
      } else {
        results.push({ event: event.title, action: "no_telegram_recipients" })
      }
    }

    return NextResponse.json({ processed: events.length, results })
  } catch (error) {
    console.error("Check upcoming error:", error)
    return NextResponse.json({ error: "Failed to check upcoming events" }, { status: 500 })
  }
}

async function generateBrief(event: {
  googleEventId: string
  title: string
  startTime: Date
  attendees: string[]
}) {
  // Try to find a matching contact from attendees
  let contact = null
  for (const att of event.attendees) {
    const found = await prisma.contact.findFirst({
      where: {
        OR: [
          { email: { equals: att, mode: "insensitive" } },
          { name: { contains: att.split("@")[0], mode: "insensitive" } },
        ],
      },
      include: {
        interactions: { orderBy: { createdAt: "desc" }, take: 5 },
        deals: { orderBy: { updatedAt: "desc" }, take: 3 },
        metrics: { orderBy: { month: "desc" }, take: 3 },
      },
    })
    if (found) { contact = found; break }
  }

  // Build context
  const contextParts: string[] = []
  if (contact) {
    contextParts.push(`## Contact: ${contact.name}`)
    contextParts.push(`Company: ${contact.company || "?"} | Status: ${contact.status} | Health: ${contact.healthStatus}`)
    if (contact.interactions.length > 0) {
      contextParts.push("\n## Recent Interactions")
      for (const i of contact.interactions) {
        contextParts.push(`- [${i.type}] ${new Date(i.createdAt).toLocaleDateString()}: ${i.content.substring(0, 150)}`)
      }
    }
    if (contact.deals.length > 0) {
      contextParts.push("\n## Deals")
      for (const d of contact.deals) {
        contextParts.push(`- ${d.name} | Stage: ${d.stage} | Revenue: €${d.expectedRevenue?.toLocaleString() || "?"}`)
      }
    }
  }

  const prompt = `Generate a meeting brief. Return ONLY valid JSON.

MEETING: ${event.title}
DATE: ${new Date(event.startTime).toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
ATTENDEES: ${event.attendees.join(", ")}

${contextParts.length > 0 ? "CONTEXT:\n" + contextParts.join("\n") : "No CRM data available."}

Return JSON: {"company_context":"...","relationship_history":"...","deal_status":"...","recent_news":"...","talking_points":["..."],"risks":["..."],"opportunities":["..."],"suggested_ask":"..."}`

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
  const briefContent = jsonMatch ? JSON.parse(jsonMatch[0]) : { company_context: "Brief auto-generated", talking_points: [] }

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

async function sendBriefToAttendees(
  brief: { id: string; title: string; meetingDate: Date; attendees: string[]; briefContent: unknown },
  eventAttendees: string[],
): Promise<string[]> {
  const sentTo: string[] = []

  for (const att of eventAttendees) {
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
      title: brief.title,
      meetingDate: brief.meetingDate,
      attendees: brief.attendees,
      briefContent: brief.briefContent as Record<string, unknown>,
    })

    const result = await sendTelegramMessage(employee.telegramChatId, formatted)
    if (result.ok) sentTo.push(employee.name)
  }

  return sentTo
}
