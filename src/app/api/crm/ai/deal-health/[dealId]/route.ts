import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

function parseJsonFromText(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim()
  return JSON.parse(cleaned)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { dealId } = await params

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            relationshipStrength: true,
            relationshipScore: true,
            totalInteractions: true,
            lastInteraction: true,
            daysSinceLastContact: true,
          },
        },
        company: { select: { id: true, name: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
        tasks: { orderBy: { dueDate: "asc" }, take: 10 },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    // Count activity types in last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentActivities = deal.activities.filter((a) => a.createdAt >= thirtyDaysAgo)
    const emailCount = recentActivities.filter((a) => a.type.startsWith("email")).length
    const meetingCount = recentActivities.filter((a) => a.type.startsWith("meeting")).length

    const prompt = `You are a deal health prediction engine for a B2B payment services sales team.

Analyze this deal and predict its health status.

**Deal:**
- Name: ${deal.dealName}
- Stage: ${deal.stage}
- Deal Value: ${deal.dealValue ?? "Not set"}
- Deal Owner: ${deal.dealOwner}
- Days in Current Stage: ${deal.daysInCurrentStage}
- Days Since Last Activity: ${deal.daysSinceLastActivity}
- Win Probability: ${deal.winProbability ?? "Not set"}
- Expected Close Date: ${deal.expectedCloseDate?.toISOString().slice(0, 10) || "Not set"}
- KYC Status: ${deal.kycStatus}
- Stage Changed At: ${deal.stageChangedAt.toISOString().slice(0, 10)}

**Contact:**
- Name: ${deal.contact.firstName} ${deal.contact.lastName}
- Relationship Strength: ${deal.contact.relationshipStrength || "Unknown"}
- Relationship Score: ${deal.contact.relationshipScore}
- Total Interactions: ${deal.contact.totalInteractions}
- Last Interaction: ${deal.contact.lastInteraction?.toISOString().slice(0, 10) || "Never"}
- Days Since Last Contact: ${deal.contact.daysSinceLastContact ?? "Unknown"}

**Activity Metrics (last 30 days):**
- Emails: ${emailCount}
- Meetings: ${meetingCount}
- Total Activities: ${recentActivities.length}

**Recent Activities:**
${deal.activities.slice(0, 10).map((a) => `- ${a.type}: ${(a.description || "").slice(0, 100)} (${a.createdAt.toISOString().slice(0, 10)})`).join("\n") || "None"}

**Pending Tasks:**
${deal.tasks.filter((t) => t.status === "pending").map((t) => `- ${t.title} (due: ${t.dueDate.toISOString().slice(0, 10)}, priority: ${t.priority})`).join("\n") || "None"}

**Health Factors to Consider:**
1. Days in stage (longer = worse, especially past 14 days)
2. Days since last activity (>7 = concern, >14 = at risk)
3. Email frequency (regular emails = positive signal)
4. Meeting frequency (meetings = strong engagement)
5. Deal value relative to engagement level
6. Contact relationship strength

Return ONLY valid JSON:
{
  "health": "on_track" | "needs_attention" | "at_risk",
  "confidence": <0.0-1.0>,
  "reason": "<2-3 sentence explanation>",
  "suggestedAction": "<specific next step recommendation>"
}`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const result = parseJsonFromText(text) as {
      health: string
      confidence: number
      reason: string
      suggestedAction: string
    }

    await prisma.deal.update({
      where: { id: dealId },
      data: {
        aiDealHealth: result.health,
        aiDealHealthReason: result.reason,
        aiDealHealthScoredAt: new Date(),
      },
    })

    return NextResponse.json({
      dealId,
      health: result.health,
      confidence: result.confidence,
      reason: result.reason,
      suggestedAction: result.suggestedAction,
      scoredAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[AI Deal Health]", error)
    return NextResponse.json({ error: "Failed to assess deal health" }, { status: 500 })
  }
}
