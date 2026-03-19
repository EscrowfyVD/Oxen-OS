import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are Sentinel's intelligence engine for Oxen Finance, a premium B2B banking and payment infrastructure platform serving iGaming, crypto, family offices, and luxury sectors.

You will be given a RESEARCH TASK with search parameters. Return structured results as a JSON array.

Each result MUST have:
- title: concise, specific headline (include names, numbers, dates when possible)
- summary: 3-5 sentence detailed analysis with SPECIFICS — company names, dollar amounts, dates, percentages, feature names. No vague statements.
- source: likely source URL or URL pattern
- sourceType: "linkedin" | "twitter" | "reddit" | "github" | "google" | "news" | "website" | "review_site" | "regulatory" | "conference_site"
- sentiment: "positive" | "negative" | "neutral"
- relevance: "critical" | "high" | "medium" | "low"
- actionable: true/false (should Oxen act on this immediately?)
- metadata: structured data object with relevant fields (dates, prices, locations, engagement_count, stars, valuation, round_size, etc.)

QUALITY RULES:
- Every result must contain CONCRETE information — names, numbers, dates, specifics
- No generic or vague results. "Company X is growing" is bad. "Company X raised $50M Series C from Sequoia in March 2025" is good.
- Prioritize recency, specificity, and actionability
- If you cannot provide specific data, do not make up vague results — return fewer, higher quality results instead

Return ONLY a valid JSON array, no explanation text before or after.`

type ResearchInput = {
  category: string
  subcategory: string | null
  query: string | null
  sources: string[]
  keywords: string[]
  companies: string[]
  regions: string[]
  language: string
}

function buildUserMessage(research: ResearchInput): string {
  // The user's query is THE primary instruction
  const task = research.query || `Research ${research.category}${research.subcategory ? ` / ${research.subcategory}` : ""} intelligence for Oxen Finance.`

  const params: string[] = []
  if (research.sources.length > 0) params.push(`- Sources to check: ${research.sources.join(", ")}`)
  if (research.keywords.length > 0) params.push(`- Keywords: ${research.keywords.join(", ")}`)
  if (research.companies.length > 0) params.push(`- Companies: ${research.companies.join(", ")}`)
  if (research.regions.length > 0) params.push(`- Geographic focus: ${research.regions.join(", ")}`)
  if (research.language && research.language !== "english") params.push(`- Language: ${research.language}`)

  let prompt = `RESEARCH TASK:\n${task}`

  if (params.length > 0) {
    prompt += `\n\nSEARCH PARAMETERS:\n${params.join("\n")}`
  }

  prompt += `\n\nCONTEXT:\nThis research is for Oxen Finance, a premium B2B banking and payment infrastructure platform. Category: ${research.category}${research.subcategory ? `, Subcategory: ${research.subcategory}` : ""}.`

  prompt += `\n\nReturn 5-10 specific, factual results. Each must have: title, detailed summary (3-5 sentences with specifics — names, numbers, dates), source URL, sourceType, sentiment, relevance, actionable flag, and metadata with structured data.\n\nPrioritize: recency, specificity, and actionability. No vague or generic results. Every result must contain concrete information that Oxen can act on.`

  return prompt
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const research = await prisma.intelResearch.findUnique({ where: { id } })
  if (!research) return NextResponse.json({ error: "Research not found" }, { status: 404 })

  try {
    const userMessage = buildUserMessage({
      category: research.category,
      subcategory: research.subcategory,
      query: research.query,
      sources: research.sources,
      keywords: research.keywords,
      companies: research.companies,
      regions: research.regions,
      language: research.language,
    })

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    const textBlock = response.content.find((b) => b.type === "text")
    const rawText = textBlock?.type === "text" ? textBlock.text : "[]"

    // Extract JSON array from response
    let results: Array<{
      title: string
      summary: string
      source?: string
      sourceType?: string
      sentiment?: string
      relevance?: string
      actionable?: boolean
      metadata?: Record<string, unknown>
    }> = []

    try {
      // Try direct parse first
      results = JSON.parse(rawText)
    } catch {
      // Try extracting JSON from markdown code block
      const match = rawText.match(/\[[\s\S]*\]/)
      if (match) {
        try { results = JSON.parse(match[0]) } catch { results = [] }
      }
    }

    if (!Array.isArray(results)) results = []

    // Save results
    const saved = await Promise.all(
      results.map((r) =>
        prisma.intelResult.create({
          data: {
            researchId: id,
            title: r.title || "Untitled",
            summary: r.summary || "",
            source: r.source || null,
            sourceType: r.sourceType || null,
            sentiment: r.sentiment || "neutral",
            relevance: r.relevance || "medium",
            actionable: r.actionable || false,
            metadata: r.metadata ? JSON.parse(JSON.stringify(r.metadata)) : undefined,
          },
        })
      )
    )

    // Update research timestamps
    const now = new Date()
    const updateData: Record<string, unknown> = { lastRunAt: now }

    if (research.type === "one_time") {
      updateData.status = "completed"
    } else if (research.type === "recurring" && research.frequency) {
      const ms: Record<string, number> = {
        daily: 86400000,
        weekly: 604800000,
        biweekly: 1209600000,
        monthly: 2592000000,
      }
      updateData.nextRunAt = new Date(now.getTime() + (ms[research.frequency] || 604800000))
    }

    await prisma.intelResearch.update({ where: { id }, data: updateData })

    return NextResponse.json({ success: true, resultCount: saved.length })
  } catch (error) {
    console.error("[Intel] Research execution error:", error)
    return NextResponse.json({ error: "Research execution failed" }, { status: 500 })
  }
}
