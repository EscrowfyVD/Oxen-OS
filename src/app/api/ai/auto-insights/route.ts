import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { sendTelegramNotification } from "@/lib/telegram"
import { logActivity } from "@/lib/activity"

const anthropic = new Anthropic()

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Fetch all active contacts with relevant data
    const contacts = await prisma.crmContact.findMany({
      where: { lifecycleStage: { notIn: ["lost", "churned"] } },
      include: {
        activities: { orderBy: { createdAt: "desc" }, take: 3 },
        deals: { where: { stage: { notIn: ["closed_won", "closed_lost"] } }, orderBy: { updatedAt: "desc" } },
        company: { select: { name: true } },
      },
    })

    // Build analysis data
    const analysisPoints: string[] = []

    for (const c of contacts) {
      const fullName = `${c.firstName} ${c.lastName}`
      const companyName = c.company?.name || "?"
      const lastActivity = c.activities[0]
      const daysSinceContact = lastActivity
        ? Math.floor((Date.now() - new Date(lastActivity.createdAt).getTime()) / 86400000)
        : 999

      // Follow-up needed
      if (daysSinceContact > 14) {
        analysisPoints.push(`FOLLOW_UP: ${fullName} (${companyName}) - No contact for ${daysSinceContact} days. Stage: ${c.lifecycleStage}, Relationship: ${c.relationshipStrength || "?"}`)
      }

      // Deal stuck
      for (const d of c.deals) {
        const daysInStage = Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / 86400000)
        if (daysInStage > 7) {
          analysisPoints.push(`DEAL_STUCK: Deal "${d.dealName}" for ${companyName || fullName} stuck in "${d.stage}" for ${daysInStage} days. Value: €${d.dealValue?.toLocaleString() || "?"}`)
        }
      }

      // New contact with no activity
      if (c.activities.length === 0 && c.lifecycleStage === "new_lead") {
        analysisPoints.push(`OPPORTUNITY: New lead ${fullName} (${companyName}) with no activities yet. Vertical: ${c.vertical.join(", ") || "?"}`)
      }

      // High-value deals in negotiation
      for (const d of c.deals) {
        if (d.stage === "negotiation" && d.dealValue && d.dealValue > 10000) {
          analysisPoints.push(`BUYING_SIGNAL: High-value deal "${d.dealName}" (€${d.dealValue.toLocaleString()}) in negotiation with ${companyName || fullName}. Probability: ${d.winProbability || "?"}%`)
        }
      }
    }

    if (analysisPoints.length === 0) {
      return NextResponse.json({ insights: [], message: "No notable patterns found" })
    }

    // Send to Claude for analysis
    const prompt = `Analyze this CRM data and generate the top insights. For each, return a JSON array of insight objects.

DATA:
${analysisPoints.join("\n")}

Return ONLY a valid JSON array with objects like:
[
  {
    "type": "follow_up_needed|deal_stuck|churn_warning|opportunity|buying_signal|risk|upsell",
    "title": "Short title",
    "summary": "2-3 sentence explanation with specific data points and recommended action",
    "contactName": "Name from the data",
    "severity": "critical|high|medium|low"
  }
]

Return the top 10 most important insights, ordered by severity. Be specific and actionable.`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })

    const responseText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")

    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ insights: [], message: "Could not parse AI response" })
    }

    const insightData = JSON.parse(jsonMatch[0]) as Array<{
      type: string; title: string; summary: string; contactName?: string; severity: string
    }>

    // Save insights to DB
    const savedInsights = []
    for (const insight of insightData) {
      // Try to find matching contact
      let contactId: string | null = null
      if (insight.contactName) {
        const contact = await prisma.crmContact.findFirst({
          where: {
            OR: [
              { firstName: { contains: insight.contactName, mode: "insensitive" } },
              { lastName: { contains: insight.contactName, mode: "insensitive" } },
              { company: { name: { contains: insight.contactName, mode: "insensitive" } } },
            ],
          },
        })
        if (contact) contactId = contact.id
      }

      const saved = await prisma.aIInsight.create({
        data: {
          type: insight.type,
          title: insight.title,
          summary: insight.summary,
          contactId,
          severity: insight.severity,
        },
        include: { contact: { select: { id: true, firstName: true, lastName: true, company: { select: { name: true } } } } },
      })
      savedInsights.push(saved)
    }

    // Log high-priority insights as activity
    for (const insight of savedInsights) {
      if (insight.severity === "critical" || insight.severity === "high") {
        logActivity("sentinel_insight", `Sentinel insight — ${insight.title}`, "system", insight.id, `/crm`)
      }
    }

    // Notify via Telegram for critical/high severity insights
    try {
      for (const insight of savedInsights) {
        if (insight.severity === "critical" || insight.severity === "high") {
          // Find the assignee/owner for the related contact's deals
          let assigneeEmployee = null
          if (insight.contactId) {
            const relatedDeal = await prisma.deal.findFirst({
              where: { contactId: insight.contactId, stage: { notIn: ["closed_won", "closed_lost"] } },
              select: { dealOwner: true },
            })
            if (relatedDeal?.dealOwner) {
              assigneeEmployee = await prisma.employee.findFirst({
                where: { name: { contains: relatedDeal.dealOwner, mode: "insensitive" }, telegramChatId: { not: null } },
                select: { id: true, name: true },
              })
            }
          }

          // If no specific assignee, notify all sales team members
          const recipients = assigneeEmployee
            ? [assigneeEmployee]
            : await prisma.employee.findMany({
                where: {
                  department: { in: ["Sales", "Leadership"] },
                  telegramChatId: { not: null },
                },
                select: { id: true, name: true },
                take: 5,
              })

          const emoji = insight.severity === "critical" ? "🚨" : "⚠️"
          const msg = `${emoji} *${insight.severity.toUpperCase()} Insight — Oxen OS*\n\n*${insight.title}*\n${insight.summary}\n\n${insight.contact ? `Contact: ${insight.contact.firstName} ${insight.contact.lastName} (${insight.contact.company?.name || "?"})` : ""}`

          for (const r of recipients) {
            await sendTelegramNotification(r.id, msg)
          }
        }
      }
    } catch (err) {
      console.error("Telegram insight notification error:", err)
    }

    return NextResponse.json({ insights: savedInsights })
  } catch (error) {
    console.error("Auto-insights error:", error)
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 })
  }
}
