import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // ── Published This Month ──
  const publishedThisMonth = await prisma.article.count({
    where: {
      status: "published",
      publishedAt: { gte: startOfMonth },
    },
  })

  // ── Published Total ──
  const publishedTotal = await prisma.article.count({
    where: { status: "published" },
  })

  // ── Per Vertical ──
  const allArticles = await prisma.article.findMany({
    select: {
      vertical: true,
      status: true,
      wordCount: true,
      organicSessions7d: true,
      organicSessions30d: true,
      id: true,
      title: true,
      slug: true,
      publishedAt: true,
    },
  })

  const verticalCounts: Record<string, number> = {}
  for (const article of allArticles) {
    for (const v of article.vertical) {
      verticalCounts[v] = (verticalCounts[v] || 0) + 1
    }
  }

  const perVertical = Object.entries(verticalCounts).map(
    ([vertical, count]) => ({ vertical, count })
  )

  // ── Average Word Count ──
  const publishedArticles = allArticles.filter((a) => a.status === "published")
  const articlesWithWordCount = publishedArticles.filter(
    (a) => a.wordCount !== null && a.wordCount > 0
  )
  const avgWordCount =
    articlesWithWordCount.length > 0
      ? Math.round(
          articlesWithWordCount.reduce(
            (sum, a) => sum + (a.wordCount ?? 0),
            0
          ) / articlesWithWordCount.length
        )
      : 0

  // ── Queue Depth ──
  const queueDepth = await prisma.article.count({
    where: {
      status: { in: ["queued", "draft"] },
    },
  })

  // ── Top Performers (by organicSessions30d) ──
  const topPerformers = publishedArticles
    .sort((a, b) => (b.organicSessions30d ?? 0) - (a.organicSessions30d ?? 0))
    .slice(0, 10)
    .map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      organicSessions30d: a.organicSessions30d,
      organicSessions7d: a.organicSessions7d,
    }))

  // ── Decaying Articles ──
  // Weekly run rate dropped 30%: organicSessions7d < organicSessions30d * 0.7 / 4
  const decaying = publishedArticles
    .filter((a) => {
      const sessions30d = a.organicSessions30d ?? 0
      const sessions7d = a.organicSessions7d ?? 0
      if (sessions30d === 0) return false
      const expectedWeekly = (sessions30d * 0.7) / 4
      return sessions7d < expectedWeekly
    })
    .map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      organicSessions30d: a.organicSessions30d,
      organicSessions7d: a.organicSessions7d,
    }))

  return NextResponse.json({
    publishedThisMonth,
    publishedTotal,
    perVertical,
    avgWordCount,
    queueDepth,
    topPerformers,
    decaying,
  })
}
