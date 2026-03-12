import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { sendTelegramMessage, formatBriefForTelegram } from "@/lib/telegram"

const anthropic = new Anthropic()

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { eventId, contactId, meetingDate, title, attendees } = body

  if (!title || !meetingDate) {
    return NextResponse.json({ error: "title and meetingDate are required" }, { status: 400 })
  }

  try {
    // Gather all context for the brief
    const contextParts: string[] = []

    // Contact data
    let contact = null
    if (contactId) {
      contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          interactions: { orderBy: { createdAt: "desc" }, take: 10 },
          deals: { orderBy: { updatedAt: "desc" }, take: 5 },
          metrics: { orderBy: { month: "desc" }, take: 6 },
          companyIntel: { orderBy: { updatedAt: "desc" }, take: 1 },
        },
      })
    }

    // If no contact but attendees, try to find by name/email
    if (!contact && attendees?.length > 0) {
      for (const att of attendees) {
        const found = await prisma.contact.findFirst({
          where: {
            OR: [
              { email: { equals: att, mode: "insensitive" } },
              { name: { contains: att.split("@")[0], mode: "insensitive" } },
            ],
          },
          include: {
            interactions: { orderBy: { createdAt: "desc" }, take: 10 },
            deals: { orderBy: { updatedAt: "desc" }, take: 5 },
            metrics: { orderBy: { month: "desc" }, take: 6 },
            companyIntel: { orderBy: { updatedAt: "desc" }, take: 1 },
          },
        })
        if (found) { contact = found; break }
      }
    }

    if (contact) {
      contextParts.push(`## Contact: ${contact.name}`)
      contextParts.push(`Company: ${contact.company || "?"} | Email: ${contact.email || "?"} | Status: ${contact.status} | Health: ${contact.healthStatus}`)
      contextParts.push(`Sector: ${contact.sector || "?"} | Segment: ${contact.segment || "?"} | Country: ${contact.country || "?"}`)
      if (contact.monthlyGtv) contextParts.push(`Monthly GTV: €${contact.monthlyGtv.toLocaleString()} | Revenue: €${contact.monthlyRevenue?.toLocaleString() || "?"}`)
      if (contact.notes) contextParts.push(`Notes: ${contact.notes}`)

      if (contact.interactions.length > 0) {
        contextParts.push("\n## Relationship History")
        for (const i of contact.interactions) {
          contextParts.push(`- [${i.type}] ${new Date(i.createdAt).toLocaleDateString()}: ${i.content}`)
        }
      }

      if (contact.deals.length > 0) {
        contextParts.push("\n## Deals")
        for (const d of contact.deals) {
          contextParts.push(`- ${d.name} | Stage: ${d.stage} | Revenue: €${d.expectedRevenue?.toLocaleString() || "?"} | Probability: ${d.probability || "?"}% | Owner: ${d.assignedTo || "?"}`)
        }
      }

      if (contact.metrics.length > 0) {
        contextParts.push("\n## Financial Metrics")
        for (const m of contact.metrics) {
          contextParts.push(`- ${m.month}: GTV €${m.gtv.toLocaleString()} | Revenue €${m.revenue.toLocaleString()} | Take Rate ${m.takeRate}%`)
        }
      }

      if (contact.companyIntel.length > 0) {
        const intel = contact.companyIntel[0]
        contextParts.push("\n## Company Intel")
        if (intel.description) contextParts.push(`Description: ${intel.description}`)
        if (intel.industry) contextParts.push(`Industry: ${intel.industry}`)
        if (intel.employeeCount) contextParts.push(`Size: ${intel.employeeCount} employees`)
        if (intel.revenue) contextParts.push(`Revenue: ${intel.revenue}`)
        if (intel.keyPeople) contextParts.push(`Key People: ${JSON.stringify(intel.keyPeople)}`)
        if (intel.recentNews) contextParts.push(`Recent News: ${JSON.stringify(intel.recentNews)}`)
      }
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })

    const responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse brief content" }, { status: 500 })
    }

    const briefContent = JSON.parse(jsonMatch[0])

    // Save to DB
    const brief = await prisma.meetingBrief.create({
      data: {
        eventId: eventId || null,
        contactId: contact?.id || null,
        title,
        meetingDate: new Date(meetingDate),
        attendees: attendees || [],
        briefContent,
        createdBy: "ai",
      },
      include: { contact: { select: { id: true, name: true, company: true } } },
    })

    // Auto-send via Telegram to relevant team members
    const telegramSentTo: string[] = []
    try {
      for (const att of (attendees || [])) {
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

    return NextResponse.json({ brief, telegramSentTo })
  } catch (error) {
    console.error("Brief generation error:", error)
    return NextResponse.json({ error: "Failed to generate brief" }, { status: 500 })
  }
}
