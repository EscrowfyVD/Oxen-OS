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

  const contact = await prisma.crmContact.findUnique({
    where: { id: contactId },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 5 },
      deals: { orderBy: { updatedAt: "desc" }, take: 5 },
      intentSignals: { orderBy: { createdAt: "desc" }, take: 10 },
      company: { select: { name: true } },
    },
  })

  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })

  const prompt = `Analyze this contact and classify them for our GTM pipeline.

Contact: ${contact.firstName} ${contact.lastName}
Company: ${contact.company?.name || "Unknown"}
Vertical: ${contact.vertical.join(", ") || "Unknown"}
Lifecycle Stage: ${contact.lifecycleStage}
Country: ${contact.country || "Unknown"}
Source: ${contact.acquisitionSource || "Unknown"}
Relationship: ${contact.relationshipStrength || "Unknown"}
ICP Fit: ${contact.icpFit || "Unknown"}

Recent Activities: ${contact.activities.map((a) => `${a.type}: ${(a.description || "").slice(0, 100)}`).join("; ") || "None"}
Active Deals: ${contact.deals.map((d) => `${d.dealName} (${d.stage}, €${d.dealValue?.toLocaleString() ?? "0"})`).join("; ") || "None"}
Intent Signals: ${contact.intentSignals.map((s) => `${s.signalType}: ${s.title} (score: ${s.score})`).join("; ") || "None"}

Return a JSON object with:
- icpScore (0-100): How well they match our Ideal Customer Profile (payment services, crypto, iGaming, family offices, high-net-worth)
- intentScore (0-100): Their buying intent based on signals, interactions, engagement
- priorityScore (0-100): Overall priority for sales outreach (weighted combination of ICP + intent + revenue potential)
- icpFit: One of "tier_1", "tier_2", "tier_3"
- contactType: One of "prospect", "client", "introducer", "partner"
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

    await prisma.crmContact.update({
      where: { id: contactId },
      data: {
        icpFit: scores.icpFit || contact.icpFit,
        contactType: scores.contactType || contact.contactType,
        vertical: scores.vertical ? [scores.vertical] : contact.vertical,
        relationshipScore: scores.priorityScore ?? contact.relationshipScore,
      },
    })

    return NextResponse.json({ scores })
  } catch (error) {
    console.error("Classification error:", error)
    return NextResponse.json({ error: "Classification failed" }, { status: 500 })
  }
}
