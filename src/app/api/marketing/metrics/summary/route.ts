import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("marketing")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const entity = searchParams.get("entity")

  const baseWhere: Record<string, unknown> = {}
  if (entity && entity !== "all") baseWhere.entity = entity

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  // Get latest entry per platform (for follower counts)
  const platforms = ["linkedin", "twitter", "telegram", "instagram"]
  const latestByPlatform: Record<string, {
    followers: number; impressions: number; engagement: number;
    clicks: number; posts: number; date: Date
  }> = {}

  for (const p of platforms) {
    const latest = await prisma.socialMetrics.findFirst({
      where: { ...baseWhere, platform: p },
      orderBy: { date: "desc" },
    })
    if (latest) {
      latestByPlatform[p] = {
        followers: latest.followers,
        impressions: latest.impressions,
        engagement: latest.engagement,
        clicks: latest.clicks,
        posts: latest.posts,
        date: latest.date,
      }
    }
  }

  // Current month aggregates per platform
  const currentMonthByPlatform: Record<string, {
    impressions: number; engagement: number; clicks: number; posts: number
  }> = {}

  for (const p of platforms) {
    const agg = await prisma.socialMetrics.aggregate({
      where: { ...baseWhere, platform: p, date: { gte: currentMonthStart, lte: currentMonthEnd } },
      _sum: { impressions: true, engagement: true, clicks: true, posts: true },
    })
    currentMonthByPlatform[p] = {
      impressions: agg._sum.impressions || 0,
      engagement: agg._sum.engagement || 0,
      clicks: agg._sum.clicks || 0,
      posts: agg._sum.posts || 0,
    }
  }

  // Total followers
  const totalFollowers = Object.values(latestByPlatform).reduce((s, v) => s + v.followers, 0)

  // Monthly impressions total
  const monthlyImpressions = Object.values(currentMonthByPlatform).reduce((s, v) => s + v.impressions, 0)

  // Total engagement & engagement rate
  const monthlyEngagement = Object.values(currentMonthByPlatform).reduce((s, v) => s + v.engagement, 0)
  const engagementRate = monthlyImpressions > 0 ? (monthlyEngagement / monthlyImpressions) * 100 : 0

  // Last 6 months trend data per platform
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const trendData = await prisma.socialMetrics.findMany({
    where: { ...baseWhere, date: { gte: sixMonthsAgo }, platform: { in: platforms } },
    orderBy: { date: "asc" },
  })

  // Group by month+platform
  const trendByMonth: Record<string, Record<string, { followers: number; impressions: number; engagement: number; posts: number }>> = {}
  for (const entry of trendData) {
    const monthKey = `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, "0")}`
    if (!trendByMonth[monthKey]) trendByMonth[monthKey] = {}
    // Take the latest entry per month per platform
    if (!trendByMonth[monthKey][entry.platform] ||
        entry.date > new Date(trendByMonth[monthKey][entry.platform].followers)) {
      trendByMonth[monthKey][entry.platform] = {
        followers: entry.followers,
        impressions: entry.impressions,
        engagement: entry.engagement,
        posts: entry.posts,
      }
    }
  }

  // Follower growth: compare current vs previous month per platform
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  const followerGrowth: Record<string, number> = {}

  for (const p of platforms) {
    const prev = await prisma.socialMetrics.findFirst({
      where: { ...baseWhere, platform: p, date: { gte: prevMonthStart, lte: prevMonthEnd } },
      orderBy: { date: "desc" },
    })
    const current = latestByPlatform[p]
    if (prev && current) {
      followerGrowth[p] = current.followers - prev.followers
    } else {
      followerGrowth[p] = 0
    }
  }

  // Content pipeline count
  const contentPipeline = await prisma.contentIdea.count({
    where: { status: { in: ["draft", "scheduled"] } },
  })

  return NextResponse.json({
    summary: {
      totalFollowers,
      monthlyImpressions,
      engagementRate,
      contentPipeline,
      latestByPlatform,
      currentMonthByPlatform,
      followerGrowth,
      trendByMonth,
    },
  })
}
