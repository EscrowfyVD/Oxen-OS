import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

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

      const ms: Record<string, number> = {
        daily: 86400000,
        weekly: 604800000,
        biweekly: 1209600000,
        monthly: 2592000000,
      }
      await prisma.intelResearch.update({
        where: { id: research.id },
        data: {
          lastRunAt: now,
          nextRunAt: new Date(now.getTime() + (ms[research.frequency || "weekly"] || 604800000)),
        },
      })

      executed++
    } catch (e) {
      errors.push(`${research.id}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({ executed, total: dueResearches.length, errors })
}
