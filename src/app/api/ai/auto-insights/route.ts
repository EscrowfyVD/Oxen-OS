import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { sendTelegramNotification } from "@/lib/telegram"

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
    const contacts = await prisma.contact.findMany({
      where: { status: { notIn: ["lost", "churned"] } },
      include: {
        interactions: { orderBy: { createdAt: "desc" }, take: 3 },
        deals: { where: { stage: { notIn: ["closed_won", "closed_lost"] } }, orderBy: { updatedAt: "desc" } },
        metrics: { orderBy: { month: "desc" }, take: 3 },
      },
    })

    // Build analysis data
    const analysisPoints: string[] = []

    for (const c of contacts) {
      const lastInteraction = c.interactions[0]
      const daysSinceContact = lastInteraction
        ? Math.floor((Date.now() - new Date(lastInteraction.createdAt).getTime()) / 86400000)
        : 999

      // Follow-up needed
      if (daysSinceContact > 14) {
        analysisPoints.push(`FOLLOW_UP: ${c.name} (${c.company || "?"}) - No contact for ${daysSinceContact} days. Status: ${c.status}, Health: ${c.healthStatus}. GTV: €${c.monthlyGtv?.toLocaleString() || "?"}`)
      }

      // Deal stuck
      for (const d of c.deals) {
        const daysInStage = Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / 86400000)
        if (daysInStage > 7) {
          analysisPoints.push(`DEAL_STUCK: Deal "${d.name}" for ${c.company || c.name} stuck in "${d.stage}" for ${daysInStage} days. Value: €${d.expectedRevenue?.toLocaleString() || "?"}`)
        }
      }

      // Churn warning (declining GTV)
      if (c.metrics.length >= 2) {
        const latest = c.metrics[0]
        const previous = c.metrics[1]
        if (latest.gtv < previous.gtv * 0.8) {
          analysisPoints.push(`CHURN_WARNING: ${c.company || c.name} GTV dropped from €${previous.gtv.toLocaleString()} to €${latest.gtv.toLocaleString()} (${c.metrics[0].month})`)
        }
      }

      // New contact with no interaction
      if (c.interactions.length === 0 && c.status === "lead") {
        analysisPoints.push(`OPPORTUNITY: New lead ${c.name} (${c.company || "?"}) with no interactions yet. Sector: ${c.sector || "?"}`)
      }

      // High-value deals in negotiation
      for (const d of c.deals) {
        if (d.stage === "negotiation" && d.expectedRevenue && d.expectedRevenue > 10000) {
          analysisPoints.push(`BUYING_SIGNAL: High-value deal "${d.name}" (€${d.expectedRevenue.toLocaleString()}) in negotiation with ${c.company || c.name}. Probability: ${d.probability || "?"}%`)
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
        const contact = await prisma.contact.findFirst({
          where: {
            OR: [
              { name: { contains: insight.contactName, mode: "insensitive" } },
              { company: { contains: insight.contactName, mode: "insensitive" } },
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
        include: { contact: { select: { id: true, name: true, company: true } } },
      })
      savedInsights.push(saved)
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
              select: { assignedTo: true },
            })
            if (relatedDeal?.assignedTo) {
              assigneeEmployee = await prisma.employee.findFirst({
                where: { name: { contains: relatedDeal.assignedTo, mode: "insensitive" }, telegramChatId: { not: null } },
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
          const msg = `${emoji} *${insight.severity.toUpperCase()} Insight — Oxen OS*\n\n*${insight.title}*\n${insight.summary}\n\n${insight.contact ? `Contact: ${insight.contact.name} (${insight.contact.company || "?"})` : ""}`

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
