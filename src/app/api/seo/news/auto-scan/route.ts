import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { scoreNewsArticle } from "@/lib/ai/score-news-article"
import { notifyLlmFailure } from "@/lib/ai/llm-alert"

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

export async function POST() {
  // Cron endpoint — authenticate via auth session or allow unauthenticated for cron
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sources = await prisma.newsSource.findMany({
    where: { isActive: true, rssUrl: { not: null } },
  })

  let newItemsCount = 0
  let relevantCount = 0
  let scoredCount = 0
  const MAX_SCORED = 10

  try {
    for (const source of sources) {
      if (!source.rssUrl) continue

      try {
        const res = await fetch(source.rssUrl)
        if (!res.ok) continue

        const xml = await res.text()
        const feedItems = extractItems(xml)

        for (const item of feedItems) {
          if (scoredCount >= MAX_SCORED) break

          const exists = await prisma.newsItem.findUnique({
            where: { url: item.link },
          })
          if (exists) continue

          // scoreNewsArticle THROWS on an LLM/API failure — never a fake score:0.
          const { score, verticals } = await scoreNewsArticle(client, item.title, item.description)
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
      } catch (e) {
        // Only RSS/fetch errors are skipped. An LLM/API error must NOT be swallowed
        // into a "green" scan of fake score:0 rows — rethrow so the run fails visibly.
        if (e instanceof Anthropic.APIError) throw e
        continue
      }
    }
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      await notifyLlmFailure({ source: "cron/news-auto-scan", error: e })
      return NextResponse.json(
        { error: "News scoring unavailable — LLM call failed", scored: scoredCount },
        { status: 503 },
      )
    }
    throw e
  }

  return NextResponse.json({
    scanned: sources.length,
    newItems: newItemsCount,
    relevant: relevantCount,
  })
}
