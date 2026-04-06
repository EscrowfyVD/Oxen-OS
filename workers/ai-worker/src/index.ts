/**
 * AI Worker — processes jobs that call the Claude API
 *
 * Handles: ai:score-lead, ai:generate-article, ai:news-scan, ai:score-news,
 *          ai:keyword-discover, ai:geo-test
 */

import { PrismaClient } from "@prisma/client"
import Anthropic from "@anthropic-ai/sdk"

const prisma = new PrismaClient()
const anthropic = new Anthropic()

const WORKER_ID = `ai-worker-${process.pid}`
const POLL_INTERVAL = parseInt(process.env.AI_POLL_INTERVAL_MS || "5000", 10)
const STALE_TIMEOUT = parseInt(process.env.STALE_JOB_TIMEOUT_MS || "300000", 10)

const AI_JOB_TYPES = [
  "ai:score-lead",
  "ai:generate-article",
  "ai:news-scan",
  "ai:score-news",
  "ai:keyword-discover",
  "ai:geo-test",
]

// ─── Job Claiming (atomic with FOR UPDATE SKIP LOCKED) ───

async function claimNextJob() {
  const jobs = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "Job"
    SET "status" = 'processing',
        "processedBy" = ${WORKER_ID},
        "startedAt" = NOW(),
        "attempts" = "attempts" + 1,
        "updatedAt" = NOW()
    WHERE "id" = (
      SELECT "id" FROM "Job"
      WHERE "status" = 'pending'
        AND "type" = ANY(${AI_JOB_TYPES}::text[])
        AND "attempts" < "maxAttempts"
      ORDER BY "priority" DESC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"
  `

  if (!jobs || jobs.length === 0) return null
  return prisma.job.findUnique({ where: { id: jobs[0].id } })
}

async function completeJob(jobId: string, result: Record<string, unknown>) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "completed", result, completedAt: new Date() },
  })
}

async function failJob(jobId: string, error: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } })
  if (!job) return
  const newStatus = job.attempts >= job.maxAttempts ? "failed" : "pending"
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: newStatus,
      error,
      processedBy: newStatus === "pending" ? null : job.processedBy,
      startedAt: newStatus === "pending" ? null : job.startedAt,
    },
  })
}

// ─── Job Handlers ───

function parseJsonFromText(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim()
  return JSON.parse(cleaned)
}

async function handleScoreLead(payload: Record<string, unknown>) {
  const contactId = payload.contactId as string

  const contact = await prisma.crmContact.findUnique({
    where: { id: contactId },
    include: {
      company: { select: { id: true, name: true, industry: true, employeeCount: true, vertical: true, geoZone: true } },
      deals: { orderBy: { updatedAt: "desc" }, take: 5 },
      activities: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  })

  if (!contact) throw new Error(`Contact not found: ${contactId}`)

  const VERTICALS = [
    "FinTech/Crypto", "Family Office", "CSP/Fiduciaries",
    "Luxury Assets", "iGaming", "Yacht Brokers", "Import/Export"
  ]
  const GEO_ZONES = [
    "Malta & Southern EU", "Cyprus & Eastern Med", "Luxembourg & Western EU",
    "UK & Channel Islands", "UAE & GCC", "Switzerland & Liechtenstein",
    "Caribbean", "Asia Pacific", "Americas"
  ]

  const prompt = `You are an ICP (Ideal Customer Profile) scoring engine for a B2B payment services company focused on Malta, Cyprus, Luxembourg, UK, UAE. Our target verticals are: ${VERTICALS.join(", ")}. Our geo zones are: ${GEO_ZONES.join(", ")}.

Score this contact on 5 criteria. Each criterion has a max score. Return the breakdown and total.

**Contact:**
- Name: ${contact.firstName} ${contact.lastName}
- Email: ${contact.email}
- Job Title: ${contact.jobTitle || "Unknown"}
- Company: ${contact.company?.name || "Unknown"}
- Company Industry: ${contact.company?.industry || "Unknown"}
- Company Size: ${contact.companySize || "Unknown"}
- Company Employee Count: ${contact.company?.employeeCount ?? "Unknown"}
- Verticals: ${contact.vertical.join(", ") || "None"}
- Geo Zone: ${contact.geoZone || "Unknown"}
- Country: ${contact.country || "Unknown"}
- Annual Revenue Range: ${contact.annualRevenueRange || "Unknown"}
- Lifecycle Stage: ${contact.lifecycleStage}
- Contact Type: ${contact.contactType}
- Total Interactions: ${contact.totalInteractions}
- Last Interaction: ${contact.lastInteraction?.toISOString() || "Never"}

**Recent Activities (last 20):**
${contact.activities.map((a: { type: string; description: string | null; createdAt: Date }) => `- ${a.type}: ${(a.description || "").slice(0, 120)} (${a.createdAt.toISOString().slice(0, 10)})`).join("\n") || "None"}

**Active Deals:**
${contact.deals.map((d: { dealName: string; stage: string; dealValue: number | null }) => `- ${d.dealName} | Stage: ${d.stage} | Value: ${d.dealValue ?? 0}`).join("\n") || "None"}

**Scoring Criteria:**
1. Vertical Match (max 30 pts): How well does this contact's industry/vertical align with our target verticals?
2. Geographic Fit (max 20 pts): Is the contact in one of our priority geo zones (Malta, Cyprus, Luxembourg, UK, UAE)?
3. Company Size (max 20 pts): Does the company size match our ideal (mid-market to enterprise)?
4. Engagement (max 15 pts): How engaged is this contact based on activity volume, recency, and responsiveness?
5. Revenue Potential (max 15 pts): Based on deal values, company revenue range, and market signals, what is the revenue potential?

Return ONLY valid JSON with this exact structure:
{
  "vertical_match": <0-30>,
  "geographic_fit": <0-20>,
  "company_size": <0-20>,
  "engagement": <0-15>,
  "revenue_potential": <0-15>,
  "total": <0-100>,
  "reasoning": "<brief explanation of the score>"
}`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
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

  const breakdown = {
    vertical_match: scores.vertical_match,
    geographic_fit: scores.geographic_fit,
    company_size: scores.company_size,
    engagement: scores.engagement,
    revenue_potential: scores.revenue_potential,
    reasoning: scores.reasoning,
  }

  const updated = await prisma.crmContact.update({
    where: { id: contactId },
    data: {
      icpScore: Math.round(total),
      icpFit,
      icpScoredAt: new Date(),
      icpScoreBreakdown: breakdown,
    },
  })

  return {
    contactId,
    icpScore: updated.icpScore,
    icpFit: updated.icpFit,
    icpScoredAt: updated.icpScoredAt,
    breakdown,
  }
}

async function handleGenerateArticle(payload: Record<string, unknown>) {
  const { topic, newsItemIds, vertical, keywordId } = payload as {
    topic?: string
    newsItemIds?: string[]
    vertical?: string
    keywordId?: string
  }

  let sourceArticles: { id: string; title: string; snippet: string; url: string }[] = []
  let targetKeyword: string | null = null
  let targetVertical: string = vertical || ""

  if (newsItemIds && newsItemIds.length > 0) {
    const newsItems = await prisma.newsItem.findMany({
      where: { id: { in: newsItemIds } },
      select: { id: true, title: true, snippet: true, url: true, vertical: true },
    })
    sourceArticles = newsItems.map((n) => ({
      id: n.id, title: n.title, snippet: n.snippet || "", url: n.url,
    }))
    if (!targetVertical && newsItems.length > 0 && newsItems[0].vertical.length > 0) {
      targetVertical = newsItems[0].vertical[0]
    }
  }

  if (keywordId) {
    const keyword = await prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { keyword: true, vertical: true },
    })
    if (keyword) {
      targetKeyword = keyword.keyword
      if (!targetVertical) targetVertical = keyword.vertical
    }
  }

  if (sourceArticles.length === 0 && !topic) {
    const queuedNews = await prisma.newsItem.findMany({
      where: { status: "new" },
      orderBy: { relevanceScore: "desc" },
      take: 5,
      select: { id: true, title: true, snippet: true, url: true, vertical: true, clusterId: true },
    })
    if (queuedNews.length > 0) {
      const clusters = new Map<string, typeof queuedNews>()
      for (const item of queuedNews) {
        const key = item.clusterId || item.id
        if (!clusters.has(key)) clusters.set(key, [])
        clusters.get(key)!.push(item)
      }
      const largestCluster = [...clusters.values()].sort((a, b) => b.length - a.length)[0]
      sourceArticles = largestCluster.map((n) => ({
        id: n.id, title: n.title, snippet: n.snippet || "", url: n.url,
      }))
      if (!targetVertical && largestCluster[0].vertical.length > 0) {
        targetVertical = largestCluster[0].vertical[0]
      }
    }
  }

  const parts: string[] = []
  if (topic) parts.push(`Topic: ${topic}`)
  if (sourceArticles.length > 0) {
    parts.push(`\nSource articles for context:`)
    sourceArticles.forEach((a, i) => parts.push(`${i + 1}. "${a.title}" — ${a.snippet}`))
  }
  if (targetKeyword) parts.push(`\nTarget keyword: ${targetKeyword}`)
  if (targetVertical) parts.push(`Target vertical: ${targetVertical}`)

  const SYSTEM_PROMPT = `You are Oxen Finance's SEO content writer. Generate a long-form blog article (1,500-2,500 words) optimized for both Google SEO and AI engine citations (GEO).

ARTICLE STRUCTURE (follow exactly):
1. TITLE: SEO-optimized, includes primary keyword, under 60 characters, compelling
2. META DESCRIPTION: 155 chars max, includes primary keyword, clear summary
3. URL SLUG: lowercase, hyphenated, keyword-rich
4. INTRODUCTION (100-150 words): Start with a DIRECT ANSWER to the implied question. Include primary keyword in first sentence.
5. BODY (1,200-2,000 words): H2 and H3 subheadings, each section starts with a direct extractable statement, include specific numbers/dates/data, reference original sources, naturally mention Oxen's relevance where appropriate — never salesy.
6. FAQ SECTION (3-5 questions): Each FAQ as H3 heading + 2-3 sentence direct answer.
7. INTERNAL LINKS: Suggest 2-4 links to other Oxen pages.

GEO OPTIMIZATION RULES:
- Start each section with a direct, extractable answer
- Include specific numbers, dates, and data
- Clean H2/H3 hierarchy
- FAQ section is mandatory
- Cite authoritative sources

TONE: Professional, authoritative, informative. Not salesy.

OXEN CONTEXT: Oxen Finance provides tailored global account solutions for businesses in crypto, iGaming, family offices, luxury assets, and professional services. Multi-currency accounts, SEPA/SWIFT, crypto-to-fiat, card issuing, compliance-first approach. Regulated entities in Switzerland, Canada, UK, Italy.

Return ONLY valid JSON:
{
  "title": "...",
  "slug": "...",
  "metaDescription": "...",
  "primaryKeyword": "...",
  "secondaryKeywords": ["..."],
  "content": "... (full HTML with h2, h3, p, ul, ol tags) ...",
  "faqSchema": [{"question": "...", "answer": "..."}],
  "socialPost": "... (3-4 sentence LinkedIn summary) ..."
}`

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: parts.join("\n") }],
  })

  const textBlock = message.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") throw new Error("Failed to generate article")

  let jsonText = textBlock.text.trim()
  const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)```/)
  if (jsonMatch) jsonText = jsonMatch[1].trim()

  const generated = JSON.parse(jsonText)
  const wordCount = generated.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(" ").length
  const verticalArray = targetVertical ? [targetVertical] : []

  const schemaJson = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: generated.title,
      description: generated.metaDescription || "",
      datePublished: new Date().toISOString(),
      author: { "@type": "Organization", name: "Oxen Finance" },
      publisher: { "@type": "Organization", name: "Oxen Finance" },
    },
    ...(generated.faqSchema?.length > 0 ? [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: generated.faqSchema.map((faq: { question: string; answer: string }) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    }] : []),
  ]

  const article = await prisma.article.create({
    data: {
      title: generated.title,
      slug: generated.slug,
      metaDescription: generated.metaDescription || null,
      content: generated.content,
      vertical: verticalArray,
      primaryKeyword: generated.primaryKeyword || null,
      secondaryKeywords: generated.secondaryKeywords || [],
      wordCount,
      status: "draft",
      generatedBy: "ai",
      sourceArticles: sourceArticles.map((a) => a.url),
      schemaJson,
      socialPost: generated.socialPost || null,
    },
  })

  if (sourceArticles.length > 0) {
    await prisma.newsItem.updateMany({
      where: { id: { in: sourceArticles.map((a) => a.id) } },
      data: { status: "used" },
    })
  }

  return { articleId: article.id, title: article.title, wordCount }
}

async function handleNewsScan(payload: Record<string, unknown>) {
  const maxScored = (payload.maxScored as number) || 10

  const sources = await prisma.newsSource.findMany({
    where: { isActive: true, rssUrl: { not: null } },
  })

  let newItemsCount = 0
  let relevantCount = 0
  let scoredCount = 0

  for (const source of sources) {
    if (!source.rssUrl) continue

    try {
      const res = await fetch(source.rssUrl)
      if (!res.ok) continue

      const xml = await res.text()
      const items = extractRssItems(xml)

      for (const item of items) {
        if (scoredCount >= maxScored) break

        const exists = await prisma.newsItem.findUnique({ where: { url: item.link } })
        if (exists) continue

        const { score, verticals } = await scoreArticle(item.title, item.description)
        scoredCount++

        const status = score >= 60 ? "queued" : "irrelevant"
        if (score >= 60) relevantCount++

        await prisma.newsItem.create({
          data: {
            title: item.title,
            url: item.link,
            sourceId: source.id,
            snippet: item.description?.substring(0, 1000) || null,
            publishedAt: item.pubDate ? new Date(item.pubDate) : null,
            relevanceScore: score,
            vertical: verticals,
            status,
          },
        })
        newItemsCount++
      }

      await prisma.newsSource.update({
        where: { id: source.id },
        data: { lastScanned: new Date() },
      })
    } catch {
      continue
    }
  }

  return { scanned: sources.length, newItems: newItemsCount, relevant: relevantCount }
}

function extractRssItems(xml: string) {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() || ""
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || ""
    const description = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim() || ""
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || ""

    if (title && link) items.push({ title, link, description, pubDate })
  }
  return items
}

async function scoreArticle(title: string, snippet: string) {
  const prompt = `Score this news article 0-100 on relevance to Oxen Finance's business. Oxen provides financial services to: crypto companies, family offices, CSPs/fiduciaries, luxury asset brokers, iGaming operators, yacht brokers, import/export companies. Score based on: does this news relate to banking, payments, financial services, regulation, or any of these verticals? Which verticals does it match? Return JSON only: {"score": number, "verticals": string[], "reasoning": string}

Title: ${title}
Snippet: ${snippet?.substring(0, 500) || "No snippet available"}`

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = msg.content[0].type === "text" ? msg.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return { score: parsed.score || 0, verticals: parsed.verticals || [], reasoning: parsed.reasoning || "" }
    }
    return { score: 0, verticals: [], reasoning: "Failed to parse" }
  } catch {
    return { score: 0, verticals: [], reasoning: "API call failed" }
  }
}

// ─── Main Loop ───

async function processJob(job: { id: string; type: string; payload: unknown }) {
  const payload = job.payload as Record<string, unknown>

  switch (job.type) {
    case "ai:score-lead":
      return handleScoreLead(payload)
    case "ai:generate-article":
      return handleGenerateArticle(payload)
    case "ai:news-scan":
      return handleNewsScan(payload)
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}

async function resetStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_TIMEOUT)
  const result = await prisma.job.updateMany({
    where: { status: "processing", startedAt: { lt: cutoff } },
    data: { status: "pending", processedBy: null, startedAt: null },
  })
  if (result.count > 0) {
    console.log(`[${WORKER_ID}] Reset ${result.count} stale jobs`)
  }
}

let running = true

async function poll() {
  while (running) {
    try {
      // Periodically reset stale jobs
      await resetStaleJobs()

      const job = await claimNextJob()
      if (job) {
        console.log(`[${WORKER_ID}] Processing job ${job.id} (${job.type}) attempt ${job.attempts}`)
        try {
          const result = await processJob(job)
          await completeJob(job.id, result || {})
          console.log(`[${WORKER_ID}] Completed job ${job.id}`)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          console.error(`[${WORKER_ID}] Failed job ${job.id}: ${errorMessage}`)
          await failJob(job.id, errorMessage)
        }
      }
    } catch (err) {
      console.error(`[${WORKER_ID}] Poll error:`, err)
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log(`[${WORKER_ID}] Shutting down...`)
  running = false
})
process.on("SIGTERM", () => {
  console.log(`[${WORKER_ID}] Shutting down...`)
  running = false
})

console.log(`[${WORKER_ID}] Starting AI Worker (poll every ${POLL_INTERVAL}ms)`)
poll().then(() => {
  console.log(`[${WORKER_ID}] Worker stopped`)
  prisma.$disconnect()
})
