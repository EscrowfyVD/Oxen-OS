import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

function parseJsonFromText(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim()
  return JSON.parse(cleaned)
}

async function checkDealHealth(deal: {
  id: string
  dealName: string
  stage: string
  dealValue: number | null
  dealOwner: string
  daysInCurrentStage: number
  daysSinceLastActivity: number
  winProbability: number | null
  expectedCloseDate: Date | null
  kycStatus: string
  stageChangedAt: Date
  contact: {
    firstName: string
    lastName: string
    relationshipStrength: string | null
    relationshipScore: number
    totalInteractions: number
    lastInteraction: Date | null
    daysSinceLastContact: number | null
  }
  activities: { type: string; description: string | null; createdAt: Date }[]
  tasks: { title: string; dueDate: Date; priority: string; status: string }[]
}): Promise<{ health: string; success: boolean }> {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentActivities = deal.activities.filter((a) => a.createdAt >= thirtyDaysAgo)
    const emailCount = recentActivities.filter((a) => a.type.startsWith("email")).length
    const meetingCount = recentActivities.filter((a) => a.type.startsWith("meeting")).length

    const prompt = `Deal health assessment. Return ONLY valid JSON: {"health":"on_track"|"needs_attention"|"at_risk","reason":"<brief>","suggestedAction":"<brief>"}

Deal: ${deal.dealName} | Stage: ${deal.stage} | Value: ${deal.dealValue ?? "N/A"} | Owner: ${deal.dealOwner}
Days in stage: ${deal.daysInCurrentStage} | Days since activity: ${deal.daysSinceLastActivity}
Contact: ${deal.contact.firstName} ${deal.contact.lastName} | Relationship: ${deal.contact.relationshipStrength || "unknown"} (${deal.contact.relationshipScore}/100)
Last 30d: ${emailCount} emails, ${meetingCount} meetings, ${recentActivities.length} total activities
Pending tasks: ${deal.tasks.filter((t) => t.status === "pending").length}`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const result = parseJsonFromText(text) as {
      health: string
      reason: string
      suggestedAction: string
    }

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        aiDealHealth: result.health,
        aiDealHealthReason: result.reason,
        aiDealHealthScoredAt: new Date(),
      },
    })

    return { health: result.health, success: true }
  } catch (err) {
    console.error(`[Health Check All] Failed for deal ${deal.id}:`, err)
    return { health: "unknown", success: false }
  }
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const deals = await prisma.deal.findMany({
      where: {
        stage: { notIn: ["closed_won", "closed_lost"] },
      },
      include: {
        contact: {
          select: {
            firstName: true,
            lastName: true,
            relationshipStrength: true,
            relationshipScore: true,
            totalInteractions: true,
            lastInteraction: true,
            daysSinceLastContact: true,
          },
        },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
        tasks: { orderBy: { dueDate: "asc" }, take: 10 },
      },
    })

    let checked = 0
    let atRisk = 0
    let needsAttention = 0
    let errors = 0

    // Process sequentially to avoid rate limiting
    for (const deal of deals) {
      const result = await checkDealHealth(deal)
      if (result.success) {
        checked++
        if (result.health === "at_risk") atRisk++
        if (result.health === "needs_attention") needsAttention++
      } else {
        errors++
      }
    }

    return NextResponse.json({
      checked,
      atRisk,
      needsAttention,
      errors,
      total: deals.length,
    })
  } catch (error) {
    console.error("[AI Health Check All]", error)
    return NextResponse.json({ error: "Failed to run health checks" }, { status: 500 })
  }
}
