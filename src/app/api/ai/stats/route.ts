import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000)

  const [
    totalInsights,
    activeInsights,
    criticalInsights,
    insightsByType,
    totalBriefs,
    upcomingMeetings,
    totalResearches,
  ] = await Promise.all([
    prisma.aIInsight.count(),
    prisma.aIInsight.count({ where: { dismissed: false } }),
    prisma.aIInsight.count({ where: { severity: "critical", dismissed: false } }),
    prisma.aIInsight.groupBy({
      by: ["type"],
      _count: { _all: true },
    }),
    prisma.meetingBrief.count(),
    prisma.calendarEvent.count({
      where: { startTime: { gte: sevenDaysAgo, lte: sevenDaysFromNow } },
    }),
    prisma.companyIntel.count(),
  ])

  // Brief coverage
  const briefCoverage = upcomingMeetings > 0
    ? Math.round((totalBriefs / upcomingMeetings) * 100)
    : 0

  // Revenue at risk: find contacts with active risk/churn insights, sum their deals
  const riskInsights = await prisma.aIInsight.findMany({
    where: {
      type: { in: ["risk", "churn_warning"] },
      dismissed: false,
      contactId: { not: null },
    },
    select: { contactId: true },
  })
  const riskContactIds = [...new Set(riskInsights.map((i) => i.contactId).filter(Boolean))] as string[]

  let revenueAtRisk = 0
  if (riskContactIds.length > 0) {
    const atRiskDeals = await prisma.deal.aggregate({
      where: {
        contactId: { in: riskContactIds },
        stage: { notIn: ["closed_won", "closed_lost"] },
      },
      _sum: { dealValue: true },
    })
    revenueAtRisk = atRiskDeals._sum.dealValue ?? 0
  }

  return NextResponse.json({
    stats: {
      totalInsights,
      activeInsights,
      criticalInsights,
      insightsByType: insightsByType.map((g) => ({
        type: g.type,
        count: g._count._all,
      })),
      totalBriefs,
      briefCoverage,
      revenueAtRisk,
      totalResearches,
    },
  })
}
