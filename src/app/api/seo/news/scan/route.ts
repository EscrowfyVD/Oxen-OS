import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

function extractItems(xml: string) {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() || ""
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || ""
    const description = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim() || ""
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || ""

    if (title && link) {
      items.push({ title, link, description, pubDate })
    }
  }

  return items
}

async function scoreArticle(title: string, snippet: string): Promise<{ score: number; verticals: string[]; reasoning: string }> {
  const prompt = `Score this news article 0-100 on relevance to Oxen Finance's business. Oxen provides financial services to: crypto companies, family offices, CSPs/fiduciaries, luxury asset brokers, iGaming operators, yacht brokers, import/export companies. Score based on: does this news relate to banking, payments, financial services, regulation, or any of these verticals? Which verticals does it match? Return JSON only: {"score": number, "verticals": string[], "reasoning": string}

Title: ${title}
Snippet: ${snippet?.substring(0, 500) || "No snippet available"}`

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = msg.content[0].type === "text" ? msg.content[0].text : ""
    // Extract JSON from potential markdown fences
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { score: 0, verticals: [], reasoning: "Failed to parse response" }
  } catch {
    return { score: 0, verticals: [], reasoning: "API call failed" }
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Allow internal calls (auto-scan) to skip auth check via header
  const isInternal = req.headers.get("x-internal-call") === "true"
  if (!session?.user && !isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sources = await prisma.newsSource.findMany({
    where: { isActive: true, rssUrl: { not: null } },
  })

  let newItemsCount = 0
  let relevantCount = 0
  let scoredCount = 0
  const MAX_SCORED = 10

  for (const source of sources) {
    if (!source.rssUrl) continue

    try {
      const res = await fetch(source.rssUrl)
      if (!res.ok) continue

      const xml = await res.text()
      const feedItems = extractItems(xml)

      for (const item of feedItems) {
        if (scoredCount >= MAX_SCORED) break

        // Check if URL already exists
        const exists = await prisma.newsItem.findUnique({
          where: { url: item.link },
        })
        if (exists) continue

        // Score with Claude
        const { score, verticals, reasoning } = await scoreArticle(item.title, item.description)
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

      // Update lastScanned on source
      await prisma.newsSource.update({
        where: { id: source.id },
        data: { lastScanned: new Date() },
      })
    } catch {
      // Skip sources that fail to fetch
      continue
    }
  }

  return NextResponse.json({
    scanned: sources.length,
    newItems: newItemsCount,
    relevant: relevantCount,
  })
}
