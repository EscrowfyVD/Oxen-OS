import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const weekFromNow = new Date(today)
    weekFromNow.setDate(weekFromNow.getDate() + 7)

    // Today's meetings
    let meetings: Array<{ title: string; startTime: Date; attendees: string[] }> = []
    try {
      meetings = await prisma.calendarEvent.findMany({
        where: { startTime: { gte: today, lt: tomorrow } },
        orderBy: { startTime: "asc" },
      })
    } catch { /* calendar may not exist */ }

    // Open tasks
    const tasks = await prisma.task.findMany({
      where: { column: { not: "done" } },
      orderBy: { createdAt: "desc" },
      take: 15,
    })

    // Active deals
    const deals = await prisma.deal.findMany({
      where: { stage: { notIn: ["closed_won", "closed_lost"] } },
      include: { contact: { select: { name: true, company: true } } },
      orderBy: { expectedRevenue: "desc" },
      take: 15,
    })

    // Recent insights
    const insights = await prisma.aIInsight.findMany({
      where: { dismissed: false },
      include: { contact: { select: { name: true, company: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    })

    // Recently updated contacts
    const recentContacts = await prisma.contact.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { name: true, company: true, status: true, healthStatus: true, updatedAt: true },
    })

    const contextParts: string[] = []

    if (meetings.length > 0) {
      contextParts.push("## Today's Meetings")
      for (const m of meetings) {
        const attendeeList = m.attendees.join(", ")
        contextParts.push(`- ${new Date(m.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} — ${m.title} (${attendeeList || "no attendees"})`)
      }
    }

    if (tasks.length > 0) {
      contextParts.push("\n## Open Tasks")
      for (const t of tasks) {
        contextParts.push(`- [${t.priority}] ${t.title} — ${t.column} ${t.assignee ? `(${t.assignee})` : ""}`)
      }
    }

    if (deals.length > 0) {
      contextParts.push("\n## Active Pipeline")
      let totalValue = 0
      for (const d of deals) {
        totalValue += d.expectedRevenue || 0
        contextParts.push(`- ${d.name} (${d.contact?.company || d.contact?.name || "?"}) — ${d.stage} — €${d.expectedRevenue?.toLocaleString() || "?"}`)
      }
      contextParts.push(`Total pipeline: €${totalValue.toLocaleString()}`)
    }

    if (insights.length > 0) {
      contextParts.push("\n## Recent AI Insights")
      for (const i of insights) {
        contextParts.push(`- [${i.type}] ${i.title}: ${i.summary.substring(0, 100)}...`)
      }
    }

    const prompt = `Generate a concise daily digest for the Oxen Finance team. Today is ${today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.

${contextParts.join("\n")}

Format the digest in clear markdown with:
1. **Priority Actions** — Top 3 things to do today
2. **Today's Meetings** — Brief on each meeting (or "No meetings today")
3. **Pipeline Pulse** — Summary of deal movement, total pipeline value, key deals to focus on
4. **Watch List** — Any risks or opportunities requiring attention
5. **Quick Stats** — Key numbers (open tasks, active deals, pipeline value)

Be concise, prioritize the most important items, and end with the single most critical action for today.`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    })

    const digest = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")

    return NextResponse.json({ digest, date: today.toISOString() })
  } catch (error) {
    console.error("Digest error:", error)
    return NextResponse.json({ error: "Failed to generate digest" }, { status: 500 })
  }
}
