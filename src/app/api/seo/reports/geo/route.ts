import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── Overall Citation Rate ──
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

  // ── Citation Trend (last 8 weeks) ──
  const now = new Date()
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000)

  const allResults = await prisma.geoTestResult.findMany({
    where: { testedAt: { gte: eightWeeksAgo } },
    select: {
      oxenCited: true,
      testedAt: true,
    },
    orderBy: { testedAt: "asc" },
  })

  // Group by week
  const weekBuckets: Record<string, { total: number; cited: number }> = {}

  for (const result of allResults) {
    const weekStart = getWeekStart(result.testedAt)
    const key = weekStart.toISOString().split("T")[0]
    if (!weekBuckets[key]) {
      weekBuckets[key] = { total: 0, cited: 0 }
    }
    weekBuckets[key].total++
    if (result.oxenCited) weekBuckets[key].cited++
  }

  const citationTrend = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { total, cited }]) => ({
      week,
      total,
      cited,
      rate: total > 0 ? Math.round((cited / total) * 100) : 0,
    }))

  // ── Per Vertical ──
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

  const perVertical = Object.entries(verticalMap).map(
    ([vertical, { total, cited }]) => ({
      vertical,
      total,
      cited,
      rate: total > 0 ? Math.round((cited / total) * 100) : 0,
    })
  )

  // ── Share of Voice (top 10 competitors) ──
  const allResultsFull = await prisma.geoTestResult.findMany({
    select: { competitorsCited: true },
  })

  const competitorCounts: Record<string, number> = {}
  for (const result of allResultsFull) {
    for (const competitor of result.competitorsCited) {
      competitorCounts[competitor] = (competitorCounts[competitor] || 0) + 1
    }
  }

  const shareOfVoice = Object.entries(competitorCounts)
    .map(([name, count]) => ({ name, mentions: count }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10)

  // ── Lost vs Gained (this month, based on SeoAlert records) ──
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const lostCitations = await prisma.seoAlert.count({
    where: {
      type: "geo_lost_citation",
      createdAt: { gte: startOfMonth },
    },
  })

  const gainedCitations = await prisma.seoAlert.count({
    where: {
      type: "geo_gained_citation",
      createdAt: { gte: startOfMonth },
    },
  })

  return NextResponse.json({
    citationRate,
    citationTrend,
    perVertical,
    shareOfVoice,
    lostVsGained: {
      lost: lostCitations,
      gained: gainedCitations,
    },
  })
}

/** Returns the Monday of the week containing the given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Adjust to Monday (day 1). Sunday (0) goes back 6 days.
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}
