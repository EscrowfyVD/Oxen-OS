import { NextResponse } from "next/server"
import { CLAUDE_MODEL } from "@/lib/ai/model"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Anthropic from "@anthropic-ai/sdk"
import { VERTICALS, GEO_ZONES } from "@/lib/crm-config"
import { notifyLlmFailure, isLlmFailure, LlmOutputError } from "@/lib/ai/llm-alert"
import { parseLlmJson } from "@/lib/ai/parse-llm-json"

const anthropic = new Anthropic()

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
      model: CLAUDE_MODEL,
      max_tokens: 1024, // Phase 2: raised from 512 — too low for 5 scores + total + reasoning (truncation)
      messages: [{ role: "user", content: prompt }],
    })

    const scores = parseLlmJson<{
      vertical_match: number
      geographic_fit: number
      company_size: number
      engagement: number
      revenue_potential: number
      total: number
      reasoning: string
    }>(response)

    // Phase 0: NO `?? 0` fabrication. A missing/non-numeric total is unusable output —
    // fail (write no icpScore/icpFit, do NOT bump lastScoredAt) so the 7-day sweep re-tries,
    // instead of stamping a real tier-1 lead as a fabricated 0/tier_3 "success".
    if (typeof scores.total !== "number" || Number.isNaN(scores.total)) {
      throw new LlmOutputError("ICP scoring returned no numeric total — refusing to fabricate 0/tier_3")
    }
    const total = scores.total

    let icpFit: string
    if (total >= 70) icpFit = "tier_1"
    else if (total >= 40) icpFit = "tier_2"
    else icpFit = "tier_3"

    await prisma.crmContact.update({
      where: { id: contact.id },
      data: {
        icpScore: Math.round(total),
        icpFit,
        lastScoredAt: new Date(),
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
    // errors++ is nobody's dashboard — surface an LLM CALL or OUTPUT(parse) failure.
    if (isLlmFailure(err)) {
      await notifyLlmFailure({ source: "crm/ai/score-all", error: err })
    }
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
          { lastScoredAt: null },
          { lastScoredAt: { lt: sevenDaysAgo } },
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
