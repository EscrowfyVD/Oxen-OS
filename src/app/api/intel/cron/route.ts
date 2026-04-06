import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

function computeNextRunAt(
  from: Date,
  frequency: string,
  scheduledDay: string | null,
  scheduledTime: string | null,
): Date {
  const [hours, minutes] = (scheduledTime || "09:00").split(":").map(Number)

  if (frequency === "daily") {
    const next = new Date(from)
    next.setDate(next.getDate() + 1)
    next.setHours(hours, minutes, 0, 0)
    return next
  }

  if (frequency === "weekly" || frequency === "biweekly") {
    const targetDayIndex = scheduledDay ? DAY_NAMES.indexOf(scheduledDay.toLowerCase()) : -1
    const next = new Date(from)
    if (targetDayIndex >= 0) {
      const currentDay = next.getDay()
      let daysUntil = targetDayIndex - currentDay
      if (daysUntil <= 0) daysUntil += 7
      if (frequency === "biweekly") daysUntil += 7
      next.setDate(next.getDate() + daysUntil)
    } else {
      next.setDate(next.getDate() + (frequency === "biweekly" ? 14 : 7))
    }
    next.setHours(hours, minutes, 0, 0)
    return next
  }

  if (frequency === "monthly") {
    const targetDay = scheduledDay ? parseInt(scheduledDay, 10) : null
    const next = new Date(from)
    next.setMonth(next.getMonth() + 1)
    if (targetDay && targetDay >= 1 && targetDay <= 28) {
      next.setDate(targetDay)
    }
    next.setHours(hours, minutes, 0, 0)
    return next
  }

  return new Date(from.getTime() + 604800000)
}

const SYSTEM_PROMPT = `You are Sentinel's intelligence engine for Oxen Finance, a premium B2B banking and payment infrastructure platform serving iGaming, crypto, family offices, and luxury sectors.

Perform the following research and return structured results as a JSON array. Each result must have:
- title: concise headline
- summary: 2-4 sentence analysis
- source: likely source or URL pattern
- sourceType: "linkedin" | "twitter" | "reddit" | "github" | "google" | "news" | "website" | "review_site" | "regulatory" | "conference_site"
- sentiment: "positive" | "negative" | "neutral"
- relevance: "critical" | "high" | "medium" | "low"
- actionable: true/false (should Oxen act on this?)
- metadata: any additional structured data

Be specific, factual, and prioritize by relevance to Oxen's business.
Return ONLY a valid JSON array.`

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const dueResearches = await prisma.intelResearch.findMany({
    where: {
      type: "recurring",
      status: "active",
      nextRunAt: { lte: now },
    },
  })

  let executed = 0
  const errors: string[] = []

  for (const research of dueResearches) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: research.query || `Research: ${research.category} / ${research.subcategory}` }],
      })

      const textBlock = response.content.find((b) => b.type === "text")
      const rawText = textBlock?.type === "text" ? textBlock.text : "[]"

      let results: Array<Record<string, unknown>> = []
      try {
        results = JSON.parse(rawText)
      } catch {
        const match = rawText.match(/\[[\s\S]*\]/)
        if (match) try { results = JSON.parse(match[0]) } catch { /* empty */ }
      }

      if (Array.isArray(results)) {
        for (const r of results) {
          await prisma.intelResult.create({
            data: {
              researchId: research.id,
              title: (r.title as string) || "Untitled",
              summary: (r.summary as string) || "",
              source: (r.source as string) || null,
              sourceType: (r.sourceType as string) || null,
              sentiment: (r.sentiment as string) || "neutral",
              relevance: (r.relevance as string) || "medium",
              actionable: (r.actionable as boolean) || false,
              metadata: r.metadata ? JSON.parse(JSON.stringify(r.metadata)) : undefined,
            },
          })
        }
      }

      const nextRunAt = computeNextRunAt(now, research.frequency || "weekly", research.scheduledDay, research.scheduledTime)
      await prisma.intelResearch.update({
        where: { id: research.id },
        data: {
          lastRunAt: now,
          nextRunAt,
        },
      })

      executed++
    } catch (e) {
      errors.push(`${research.id}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({ executed, total: dueResearches.length, errors })
}
