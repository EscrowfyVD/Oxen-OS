import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Anthropic from "@anthropic-ai/sdk"
import { VERTICALS, GEO_ZONES } from "@/lib/crm-config"

const anthropic = new Anthropic()

function parseJsonFromText(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim()
  return JSON.parse(cleaned)
}

async function scoreContact(contact: {
  id: string
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
  companySize: string | null
  vertical: string[]
  geoZone: string | null
  country: string | null
  annualRevenueRange: string | null
  lifecycleStage: string
  contactType: string
  totalInteractions: number
  lastInteraction: Date | null
  company: { name: string; industry: string | null; employeeCount: number | null; vertical: string[]; geoZone: string | null } | null
  activities: { type: string; description: string | null; createdAt: Date }[]
  // Sprint 3.2: dealValue is Prisma.Decimal (stringified only in the prompt, no arithmetic here).
  deals: { dealName: string; stage: string; dealValue: Prisma.Decimal | null }[]
}): Promise<{ success: boolean; error?: string }> {
  try {
    const prompt = `You are an ICP scoring engine for a B2B payment services company. Target verticals: ${VERTICALS.join(", ")}. Geo zones: ${GEO_ZONES.join(", ")}.

**Contact:**
- Name: ${contact.firstName} ${contact.lastName}
- Email: ${contact.email}
- Job Title: ${contact.jobTitle || "Unknown"}
- Company: ${contact.company?.name || "Unknown"}
- Industry: ${contact.company?.industry || "Unknown"}
- Company Size: ${contact.companySize || "Unknown"}
- Verticals: ${contact.vertical.join(", ") || "None"}
- Geo Zone: ${contact.geoZone || "Unknown"}
- Country: ${contact.country || "Unknown"}
- Revenue Range: ${contact.annualRevenueRange || "Unknown"}
- Total Interactions: ${contact.totalInteractions}
- Last Interaction: ${contact.lastInteraction?.toISOString() || "Never"}

**Recent Activities:** ${contact.activities.map((a) => `${a.type}: ${(a.description || "").slice(0, 80)}`).join("; ") || "None"}
**Deals:** ${contact.deals.map((d) => `${d.dealName} (${d.stage}, ${d.dealValue ?? 0})`).join("; ") || "None"}

Score on 5 criteria:
1. Vertical Match (max 30): alignment with target verticals
2. Geographic Fit (max 20): priority geo zone match
3. Company Size (max 20): mid-market to enterprise fit
4. Engagement (max 15): activity volume and recency
5. Revenue Potential (max 15): deal values and market signals

Return ONLY valid JSON: {"vertical_match":<0-30>,"geographic_fit":<0-20>,"company_size":<0-20>,"engagement":<0-15>,"revenue_potential":<0-15>,"total":<0-100>,"reasoning":"<brief>"}`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
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

    let icpFit: string
    if (total >= 70) icpFit = "tier_1"
    else if (total >= 40) icpFit = "tier_2"
    else icpFit = "tier_3"

    await prisma.crmContact.update({
      where: { id: contact.id },
      data: {
        icpScore: Math.round(total),
        icpFit,
        icpScoredAt: new Date(),
        icpScoreBreakdown: {
          vertical_match: scores.vertical_match,
          geographic_fit: scores.geographic_fit,
          company_size: scores.company_size,
          engagement: scores.engagement,
          revenue_potential: scores.revenue_potential,
          reasoning: scores.reasoning,
        },
      },
    })

    return { success: true }
  } catch (err) {
    console.error(`[Score All] Failed for contact ${contact.id}:`, err)
    return { success: false, error: String(err) }
  }
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const contacts = await prisma.crmContact.findMany({
      where: {
        OR: [
          { icpScoredAt: null },
          { icpScoredAt: { lt: sevenDaysAgo } },
        ],
      },
      include: {
        company: { select: { name: true, industry: true, employeeCount: true, vertical: true, geoZone: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
        deals: { orderBy: { updatedAt: "desc" }, take: 5 },
      },
    })

    let scored = 0
    let errors = 0
    const BATCH_SIZE = 20

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((c) => scoreContact(c))
      )

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.success) {
          scored++
        } else {
          errors++
        }
      }
    }

    return NextResponse.json({ scored, errors, total: contacts.length })
  } catch (error) {
    console.error("[AI Score All]", error)
    return NextResponse.json({ error: "Failed to bulk score" }, { status: 500 })
  }
}
