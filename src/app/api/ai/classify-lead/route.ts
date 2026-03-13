import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId } = await request.json()
  if (!contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 })

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      interactions: { orderBy: { createdAt: "desc" }, take: 5 },
      deals: { orderBy: { updatedAt: "desc" }, take: 5 },
      metrics: { orderBy: { month: "desc" }, take: 6 },
      signals: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  })

  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })

  const prompt = `Analyze this contact and classify them for our GTM pipeline.

Contact: ${contact.name}
Company: ${contact.company || "Unknown"}
Sector: ${contact.sector || "Unknown"}
Status: ${contact.status}
Country: ${contact.country || "Unknown"}
Source: ${contact.source || "Unknown"}
Monthly GTV: €${contact.monthlyGtv?.toLocaleString() ?? "0"}
Monthly Revenue: €${contact.monthlyRevenue?.toLocaleString() ?? "0"}
Take Rate: ${contact.takeRate ?? 0}%
Health: ${contact.healthStatus}
Segment: ${contact.segment || "Unknown"}

Recent Interactions: ${contact.interactions.map((i) => `${i.type}: ${i.content.slice(0, 100)}`).join("; ") || "None"}
Active Deals: ${contact.deals.map((d) => `${d.name} (${d.stage}, €${d.expectedRevenue?.toLocaleString() ?? "0"})`).join("; ") || "None"}
Intent Signals: ${contact.signals.map((s) => `${s.signalType}: ${s.title} (score: ${s.score})`).join("; ") || "None"}
Revenue Trend: ${contact.metrics.map((m) => `${m.month}: €${m.revenue.toLocaleString()}`).join(", ") || "No data"}

Return a JSON object with:
- icpScore (0-100): How well they match our Ideal Customer Profile (payment services, crypto, iGaming, family offices, high-net-worth)
- intentScore (0-100): Their buying intent based on signals, interactions, engagement
- priorityScore (0-100): Overall priority for sales outreach (weighted combination of ICP + intent + revenue potential)
- segment: One of "Enterprise", "Mid-Market", "SMB"
- clientType: One of "direct", "agent_referred", "partner"
- vertical: Industry vertical (e.g., "iGaming", "Crypto", "Family Office", "Luxury", "Fintech", "Real Estate")

RESPOND ONLY WITH VALID JSON, no markdown.`

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const scores = JSON.parse(text)

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        icpScore: scores.icpScore ?? 0,
        intentScore: scores.intentScore ?? 0,
        priorityScore: scores.priorityScore ?? 0,
        segment: scores.segment || contact.segment,
        clientType: scores.clientType || contact.clientType,
        vertical: scores.vertical || contact.vertical,
      },
    })

    return NextResponse.json({ scores })
  } catch (error) {
    console.error("Classification error:", error)
    return NextResponse.json({ error: "Classification failed" }, { status: 500 })
  }
}
