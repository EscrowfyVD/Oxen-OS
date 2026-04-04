import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── Keywords on Page 1 ──
  const keywordsOnPage1 = await prisma.keyword.count({
    where: {
      isTracked: true,
      currentPosition: { gte: 1, lte: 10 },
    },
  })

  const keywordsOnPage1LastWeek = await prisma.keyword.count({
    where: {
      previousPosition: { gte: 1, lte: 10 },
    },
  })

  // ── Average Position ──
  const trackedKeywords = await prisma.keyword.findMany({
    where: {
      isTracked: true,
      currentPosition: { not: null },
    },
    select: { currentPosition: true },
  })

  const avgPosition =
    trackedKeywords.length > 0
      ? Math.round(
          (trackedKeywords.reduce((sum, k) => sum + (k.currentPosition ?? 0), 0) /
            trackedKeywords.length) *
            10
        ) / 10
      : 0

  const prevPositionKeywords = await prisma.keyword.findMany({
    where: { previousPosition: { not: null } },
    select: { previousPosition: true },
  })

  const avgPositionLastWeek =
    prevPositionKeywords.length > 0
      ? Math.round(
          (prevPositionKeywords.reduce(
            (sum, k) => sum + (k.previousPosition ?? 0),
            0
          ) /
            prevPositionKeywords.length) *
            10
        ) / 10
      : 0

  // ── Articles ──
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const articlesPublishedThisMonth = await prisma.article.count({
    where: {
      status: "published",
      publishedAt: { gte: startOfMonth },
    },
  })

  const totalArticles = await prisma.article.count()

  // ── GEO Citation Rate ──
  const allPrompts = await prisma.geoTestPrompt.findMany({
    include: {
      results: {
        orderBy: { testedAt: "desc" },
        take: 4,
      },
    },
  })

  const totalPrompts = allPrompts.length
  const promptsWithCitation = allPrompts.filter((p) =>
    p.results.some((r) => r.oxenCited)
  ).length

  const citationRate =
    totalPrompts > 0
      ? Math.round((promptsWithCitation / totalPrompts) * 100)
      : 0

  // Citation rate from results older than 7 days (approximate last week)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oldPrompts = await prisma.geoTestPrompt.findMany({
    include: {
      results: {
        where: { testedAt: { lt: sevenDaysAgo } },
        orderBy: { testedAt: "desc" },
        take: 4,
      },
    },
  })

  const oldPromptsWithResults = oldPrompts.filter((p) => p.results.length > 0)
  const oldPromptsCited = oldPromptsWithResults.filter((p) =>
    p.results.some((r) => r.oxenCited)
  ).length
  const citationRateLastWeek =
    oldPromptsWithResults.length > 0
      ? Math.round((oldPromptsCited / oldPromptsWithResults.length) * 100)
      : 0

  // ── Active Alerts ──
  const alertsBySeverity = await prisma.seoAlert.groupBy({
    by: ["severity"],
    where: { resolved: false },
    _count: { id: true },
  })

  const activeAlerts: Record<string, number> = {}
  for (const a of alertsBySeverity) {
    activeAlerts[a.severity] = a._count.id
  }

  // ── Keywords Gained / Lost Page 1 ──
  const keywordsGainedPage1 = await prisma.keyword.count({
    where: {
      currentPosition: { gte: 1, lte: 10 },
      OR: [
        { previousPosition: { gt: 10 } },
        { previousPosition: null },
      ],
    },
  })

  const keywordsLostPage1 = await prisma.keyword.count({
    where: {
      previousPosition: { gte: 1, lte: 10 },
      currentPosition: { gt: 10 },
    },
  })

  // ── Articles in Queue ──
  const articlesInQueue = await prisma.article.count({
    where: { status: "queued" },
  })

  // ── GEO per Vertical ──
  const verticalMap: Record<string, { total: number; cited: number }> = {}
  for (const p of allPrompts) {
    if (!verticalMap[p.vertical]) {
      verticalMap[p.vertical] = { total: 0, cited: 0 }
    }
    verticalMap[p.vertical].total++
    if (p.results.some((r) => r.oxenCited)) {
      verticalMap[p.vertical].cited++
    }
  }

  const geoPerVertical = Object.entries(verticalMap).map(
    ([vertical, { total, cited }]) => ({
      vertical,
      total,
      cited,
      rate: total > 0 ? Math.round((cited / total) * 100) : 0,
    })
  )

  return NextResponse.json({
    keywordsOnPage1,
    keywordsOnPage1LastWeek,
    avgPosition,
    avgPositionLastWeek,
    articlesPublishedThisMonth,
    totalArticles,
    citationRate,
    citationRateLastWeek,
    organicSessions: 0,
    domainAuthority: 0,
    activeAlerts,
    keywordsGainedPage1,
    keywordsLostPage1,
    articlesInQueue,
    geoPerVertical,
  })
}
