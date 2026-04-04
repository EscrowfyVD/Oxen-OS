import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text ? text.split(" ").length : 0
}

function buildArticleSchema(
  article: {
    title: string
    metaDescription?: string | null
    publishedAt?: Date | null
    content: string
  },
  faqSchema?: { question: string; answer: string }[]
) {
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.metaDescription || "",
      datePublished:
        article.publishedAt?.toISOString() || new Date().toISOString(),
      author: { "@type": "Organization", name: "Oxen Finance" },
      publisher: { "@type": "Organization", name: "Oxen Finance" },
    },
  ]
  if (faqSchema && faqSchema.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqSchema.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    })
  }
  return schemas
}

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

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { topic, newsItemIds, vertical, keywordId } = body

  // Gather context
  let sourceArticles: { id: string; title: string; snippet: string; url: string }[] = []
  let targetKeyword: string | null = null
  let targetVertical: string = vertical || ""

  // Fetch news items if provided
  if (newsItemIds && newsItemIds.length > 0) {
    const newsItems = await prisma.newsItem.findMany({
      where: { id: { in: newsItemIds } },
      select: { id: true, title: true, snippet: true, url: true, vertical: true },
    })
    sourceArticles = newsItems.map((n) => ({
      id: n.id,
      title: n.title,
      snippet: n.snippet || "",
      url: n.url,
    }))
    if (!targetVertical && newsItems.length > 0 && newsItems[0].vertical.length > 0) {
      targetVertical = newsItems[0].vertical[0]
    }
  }

  // Fetch keyword if provided
  if (keywordId) {
    const keyword = await prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { keyword: true, vertical: true },
    })
    if (keyword) {
      targetKeyword = keyword.keyword
      if (!targetVertical) {
        targetVertical = keyword.vertical
      }
    }
  }

  // If no news items or keyword, pick highest-relevance queued news cluster
  if (sourceArticles.length === 0 && !topic) {
    const queuedNews = await prisma.newsItem.findMany({
      where: { status: "new" },
      orderBy: { relevanceScore: "desc" },
      take: 5,
      select: { id: true, title: true, snippet: true, url: true, vertical: true, clusterId: true },
    })

    if (queuedNews.length > 0) {
      // Group by cluster, pick the largest cluster
      const clusters = new Map<string, typeof queuedNews>()
      for (const item of queuedNews) {
        const key = item.clusterId || item.id
        if (!clusters.has(key)) clusters.set(key, [])
        clusters.get(key)!.push(item)
      }
      const largestCluster = [...clusters.values()].sort(
        (a, b) => b.length - a.length
      )[0]

      sourceArticles = largestCluster.map((n) => ({
        id: n.id,
        title: n.title,
        snippet: n.snippet || "",
        url: n.url,
      }))
      if (!targetVertical && largestCluster[0].vertical.length > 0) {
        targetVertical = largestCluster[0].vertical[0]
      }
    }
  }

  // Build user message
  const parts: string[] = []
  if (topic) {
    parts.push(`Topic: ${topic}`)
  }
  if (sourceArticles.length > 0) {
    parts.push(`\nSource articles for context:`)
    sourceArticles.forEach((a, i) => {
      parts.push(`${i + 1}. "${a.title}" — ${a.snippet}`)
    })
  }
  if (targetKeyword) {
    parts.push(`\nTarget keyword: ${targetKeyword}`)
  }
  if (targetVertical) {
    parts.push(`Target vertical: ${targetVertical}`)
  }

  const userMessage = parts.join("\n")

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    const textBlock = message.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Failed to generate article" },
        { status: 500 }
      )
    }

    // Parse JSON response — handle potential code block wrapping
    let jsonText = textBlock.text.trim()
    const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim()
    }

    const generated = JSON.parse(jsonText)

    const wordCount = countWords(generated.content)
    const verticalArray = targetVertical ? [targetVertical] : []

    const schemaJson = buildArticleSchema(
      {
        title: generated.title,
        metaDescription: generated.metaDescription,
        publishedAt: null,
        content: generated.content,
      },
      generated.faqSchema
    )

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
        schemaJson: schemaJson as unknown as Prisma.InputJsonValue,
        socialPost: generated.socialPost || null,
      },
    })

    // Mark source news items as used
    if (sourceArticles.length > 0) {
      await prisma.newsItem.updateMany({
        where: { id: { in: sourceArticles.map((a) => a.id) } },
        data: { status: "used" },
      })
    }

    return NextResponse.json({ article }, { status: 201 })
  } catch (err) {
    console.error("Article generation error:", err)
    return NextResponse.json(
      { error: "Failed to generate article. Check your Anthropic API key." },
      { status: 500 }
    )
  }
}
