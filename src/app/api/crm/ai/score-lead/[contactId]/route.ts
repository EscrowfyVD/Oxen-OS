import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { VERTICALS, GEO_ZONES } from "@/lib/crm-config"

const anthropic = new Anthropic()

function parseJsonFromText(text: string): Record<string, unknown> {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim()
  return JSON.parse(cleaned)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { contactId } = await params

  try {
    const contact = await prisma.crmContact.findUnique({
      where: { id: contactId },
      include: {
        company: { select: { id: true, name: true, industry: true, employeeCount: true, vertical: true, geoZone: true } },
        deals: { orderBy: { updatedAt: "desc" }, take: 5 },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    })

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const prompt = `You are an ICP (Ideal Customer Profile) scoring engine for a B2B payment services company focused on Malta, Cyprus, Luxembourg, UK, UAE. Our target verticals are: ${VERTICALS.join(", ")}. Our geo zones are: ${GEO_ZONES.join(", ")}.

Score this contact on 5 criteria. Each criterion has a max score. Return the breakdown and total.

**Contact:**
- Name: ${contact.firstName} ${contact.lastName}
- Email: ${contact.email}
- Job Title: ${contact.jobTitle || "Unknown"}
- Company: ${contact.company?.name || "Unknown"}
- Company Industry: ${contact.company?.industry || "Unknown"}
- Company Size: ${contact.companySize || "Unknown"}
- Company Employee Count: ${contact.company?.employeeCount ?? "Unknown"}
- Verticals: ${contact.vertical.join(", ") || "None"}
- Geo Zone: ${contact.geoZone || "Unknown"}
- Country: ${contact.country || "Unknown"}
- Annual Revenue Range: ${contact.annualRevenueRange || "Unknown"}
- Lifecycle Stage: ${contact.lifecycleStage}
- Contact Type: ${contact.contactType}
- Total Interactions: ${contact.totalInteractions}
- Last Interaction: ${contact.lastInteraction?.toISOString() || "Never"}

**Recent Activities (last 20):**
${contact.activities.map((a) => `- ${a.type}: ${(a.description || "").slice(0, 120)} (${a.createdAt.toISOString().slice(0, 10)})`).join("\n") || "None"}

**Active Deals:**
${contact.deals.map((d) => `- ${d.dealName} | Stage: ${d.stage} | Value: ${d.dealValue ?? 0}`).join("\n") || "None"}

**Scoring Criteria:**
1. Vertical Match (max 30 pts): How well does this contact's industry/vertical align with our target verticals?
2. Geographic Fit (max 20 pts): Is the contact in one of our priority geo zones (Malta, Cyprus, Luxembourg, UK, UAE)?
3. Company Size (max 20 pts): Does the company size match our ideal (mid-market to enterprise)?
4. Engagement (max 15 pts): How engaged is this contact based on activity volume, recency, and responsiveness?
5. Revenue Potential (max 15 pts): Based on deal values, company revenue range, and market signals, what is the revenue potential?

Return ONLY valid JSON with this exact structure:
{
  "vertical_match": <0-30>,
  "geographic_fit": <0-20>,
  "company_size": <0-20>,
  "engagement": <0-15>,
  "revenue_potential": <0-15>,
  "total": <0-100>,
  "reasoning": "<brief explanation of the score>"
}`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const scores = parseJsonFromText(text) as {
      vertical_match: number
      geographic_fit: number
      company_size: number
      engagement: number
      revenue_potential: number
      total: number
      reasoning: string
    }

    const total = scores.total ?? (
      (scores.vertical_match ?? 0) +
      (scores.geographic_fit ?? 0) +
      (scores.company_size ?? 0) +
      (scores.engagement ?? 0) +
      (scores.revenue_potential ?? 0)
    )

    // Determine ICP fit tier
    let icpFit: string
    if (total >= 70) icpFit = "tier_1"
    else if (total >= 40) icpFit = "tier_2"
    else icpFit = "tier_3"

    const breakdown = {
      vertical_match: scores.vertical_match,
      geographic_fit: scores.geographic_fit,
      company_size: scores.company_size,
      engagement: scores.engagement,
      revenue_potential: scores.revenue_potential,
      reasoning: scores.reasoning,
    }

    const updated = await prisma.crmContact.update({
      where: { id: contactId },
      data: {
        icpScore: Math.round(total),
        icpFit,
        icpScoredAt: new Date(),
        icpScoreBreakdown: breakdown,
      },
    })

    return NextResponse.json({
      contactId,
      icpScore: updated.icpScore,
      icpFit: updated.icpFit,
      icpScoredAt: updated.icpScoredAt,
      breakdown,
    })
  } catch (error) {
    console.error("[AI Score Lead]", error)
    return NextResponse.json({ error: "Failed to score lead" }, { status: 500 })
  }
}
