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
- metadata: any additional structured data (dates, prices, locations, engagement numbers, etc.)

Be specific, factual, and prioritize by relevance to Oxen's business. Focus on actionable intelligence.
Return ONLY a valid JSON array, no explanation text before or after.`

const SUBCATEGORY_PROMPTS: Record<string, string> = {
  // Marketing
  social_trends: "Research current social media trends in fintech, banking, and payments that Oxen Finance could leverage for content. Analyze what topics are trending on LinkedIn, Twitter/X, and Reddit in the B2B banking space. Include engagement patterns and content format trends.",
  competitive_intel: "Research what Oxen's competitors (Mercury, Relay, Wise Business, Payoneer, Revolut Business) are posting on LinkedIn and Twitter. Analyze: posting frequency, topics, best performing content, timing patterns. Provide insights Oxen can use for its own content strategy.",
  repost_suggestions: "Find recent high-performing LinkedIn and Twitter posts about fintech, banking infrastructure, payments, crypto banking, and iGaming that would be relevant for Oxen Finance to repost or engage with. Focus on thought leadership content from industry experts.",
  content_ideas: "Generate content ideas for Oxen Finance's social media presence (LinkedIn, Twitter). Ideas should position Oxen as a premium B2B banking infrastructure provider. Include topic, format (carousel, video, text post, article), platform, and potential hook.",

  // AI Tools
  trending_tools: "Find the most trending AI tools being discussed on Twitter/X, LinkedIn, and Reddit that could be useful for a fintech/banking company. Focus on sales automation, compliance, customer support, document processing, and financial analysis tools.",
  github_repos: "Find the most trending and recently starred GitHub repositories related to AI tools, LLM applications, fintech automation, sales automation, and compliance tech. For each: repo name, description, star count, what it does, and how it could be useful for Oxen.",
  google_search: "Research the latest AI tools for business that are getting attention in Google searches and product launches. Focus on tools useful for: banking operations, compliance, sales intelligence, customer onboarding, and payment processing.",
  news_scraping: "Find the latest AI news relevant to fintech and banking: new model releases, AI regulation affecting financial services, AI tools for compliance, new AI startups in finance, and breakthroughs in document processing or fraud detection.",

  // Competitors
  business_news: "Research non-marketing news about Oxen's competitors (Mercury, Relay, Wise Business, Payoneer, Revolut Business, Banking Circle, CurrencyCloud): new licenses, product features, fines, layoffs, hiring sprees, geographic expansion, partnerships, funding rounds. Focus on strategic business moves.",
  website_changes: "Check for any notable changes competitors (Mercury, Relay, Wise Business, Payoneer) might have made to their websites: new product pages, pricing changes, terms and conditions updates, new features announced, design overhauls. Focus on changes relevant to Oxen's competitive positioning.",
  reviews: "Research recent reviews and sentiment about Oxen's competitors (Mercury, Relay, Wise Business, Payoneer, Revolut Business) on G2, Trustpilot, Reddit, and Twitter. Identify waves of negative or positive reviews, common complaints, and praised features.",

  // Regulations
  new_regulation: "Research new financial regulations recently enacted or proposed in the EU, UK, Malta, Cyprus, and UAE that affect payment service providers, electronic money institutions, or banking infrastructure companies. Include: regulation name, jurisdiction, effective date, and impact on Oxen's business.",
  regulation_change: "Research recent changes to existing financial regulations (PSD2/PSD3, MiCA, AML directives, DORA) in the EU, UK, and UAE that affect payment and banking companies. What's changed, when it takes effect, and what Oxen needs to do.",
  regulation_removal: "Research any financial regulations being relaxed, removed, or simplified in the EU, UK, Malta, Cyprus, and UAE that could benefit payment/banking companies like Oxen. Include potential opportunities.",
  regulation_news: "Research news and commentary about upcoming regulatory changes in financial services, payments, and crypto that could affect Oxen Finance. Include expert opinions and timeline predictions.",

  // Conferences
  relevant_conferences: "Find upcoming fintech, payments, iGaming, crypto, and banking conferences in the next 6 months that would be relevant for Oxen Finance to attend. For each: name, location, dates, what it covers, estimated cost, and why Oxen should attend. Focus on conferences in Europe, UAE, Malta, Cyprus, and UK.",

  // Oxen
  news_mentions: "Search for any recent news articles, blog posts, or press mentions of Oxen Finance, Oxen.finance, or Oxen Banking. Include the source, date, context, and sentiment of each mention.",
  social_mentions: "Search for social media posts mentioning Oxen Finance on LinkedIn, Twitter/X, and Reddit. Include the platform, author (if public), content summary, engagement, and sentiment.",
  reviews_oxen: "Search for new reviews or testimonials about Oxen Finance on G2, Trustpilot, Google Reviews, and other review platforms. Include rating, key feedback points, and sentiment.",

  // Finance
  financial_news: "Research general financial news relevant to fintech, payment infrastructure, and B2B banking. Focus on market trends, interest rate impacts, funding environment, M&A activity, and economic factors affecting the payments industry.",
  fundraisings: "Research recent fundraising rounds and investments in the fintech, payments, banking infrastructure, and crypto banking space. Include: company name, round size, investors, valuation if known, and what they do. Focus on companies in Oxen's competitive landscape.",
}

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
  let prompt = ""

  if (research.subcategory && SUBCATEGORY_PROMPTS[research.subcategory]) {
    prompt = SUBCATEGORY_PROMPTS[research.subcategory]
  } else {
    prompt = `Research the following topic in the context of ${research.category} intelligence for Oxen Finance: ${research.query || research.category}`
  }

  // Add structured context
  const context: string[] = []
  if (research.sources.length > 0) {
    context.push(`Sources to search: ${research.sources.join(", ")}`)
  }
  if (research.keywords.length > 0) {
    context.push(`Keywords to monitor: ${research.keywords.join(", ")}`)
  }
  if (research.companies.length > 0) {
    context.push(`Companies to monitor: ${research.companies.join(", ")}`)
  }
  if (research.regions.length > 0) {
    context.push(`Geographic focus: ${research.regions.join(", ")}`)
  }
  if (research.language && research.language !== "english") {
    context.push(`Return results in: ${research.language}`)
  }

  if (context.length > 0) {
    prompt += "\n\nResearch context:\n" + context.map((c) => `- ${c}`).join("\n")
  }

  if (research.query) {
    prompt += `\n\nAdditional research instructions: ${research.query}`
  }

  prompt += "\n\nSearch across the specified sources for content matching these keywords and companies. Focus on the geographic regions specified. Return 5-10 results as a JSON array."
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
