import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Total contacts
  const totalContacts = await prisma.contact.count()

  // Pipeline value (all non-lost)
  const pipelineAgg = await prisma.contact.aggregate({
    where: { status: { not: "lost" } },
    _sum: { value: true },
  })
  const pipelineValue = pipelineAgg._sum.value ?? 0

  // Won deals
  const wonDeals = await prisma.contact.count({ where: { status: "won" } })
  const wonAgg = await prisma.contact.aggregate({
    where: { status: "won" },
    _sum: { value: true },
  })
  const wonValue = wonAgg._sum.value ?? 0

  // Conversion rate
  const conversionRate = totalContacts > 0
    ? Math.round((wonDeals / totalContacts) * 100)
    : 0

  // By status
  const byStatus = await prisma.contact.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { value: true },
  })

  // By sector
  const bySector = await prisma.contact.groupBy({
    by: ["sector"],
    _count: { _all: true },
  })

  // Monthly new contacts (last 6 months)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  let monthlyNew: Array<{ month: string; count: number }> = []
  try {
    const raw = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
             COUNT(*)::bigint as count
      FROM "Contact"
      WHERE "createdAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `
    monthlyNew = raw.map((r) => ({ month: r.month, count: Number(r.count) }))
  } catch {
    // Fallback if raw query fails
    monthlyNew = []
  }

  // Top deals
  const topDeals = await prisma.contact.findMany({
    where: { value: { not: null } },
    orderBy: { value: "desc" },
    take: 10,
  })

  // Sentinel stats
  let sentinelStats = null
  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000)

    const [totalInsightsCount, activeInsightsCount, totalBriefsCount, upcomingMeetingsCount] = await Promise.all([
      prisma.aIInsight.count(),
      prisma.aIInsight.count({ where: { dismissed: false } }),
      prisma.meetingBrief.count(),
      prisma.calendarEvent.count({
        where: { startTime: { gte: now, lte: sevenDaysFromNow } },
      }),
    ])

    const briefCoverage = upcomingMeetingsCount > 0
      ? Math.round((totalBriefsCount / upcomingMeetingsCount) * 100)
      : 0

    const riskInsights = await prisma.aIInsight.findMany({
      where: { type: { in: ["risk", "churn_warning"] }, dismissed: false, contactId: { not: null } },
      select: { contactId: true },
    })
    const riskIds = [...new Set(riskInsights.map((i) => i.contactId).filter(Boolean))] as string[]
    let revenueAtRisk = 0
    if (riskIds.length > 0) {
      const agg = await prisma.deal.aggregate({
        where: { contactId: { in: riskIds }, stage: { notIn: ["closed_won", "closed_lost"] } },
        _sum: { expectedRevenue: true },
      })
      revenueAtRisk = agg._sum.expectedRevenue ?? 0
    }

    sentinelStats = {
      totalInsights: totalInsightsCount,
      activeInsights: activeInsightsCount,
      briefCoverage,
      revenueAtRisk,
    }
  } catch { /* sentinel stats optional */ }

  return NextResponse.json({
    stats: {
      totalContacts,
      pipelineValue,
      wonDeals,
      wonValue,
      conversionRate,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
        value: s._sum.value ?? 0,
      })),
      bySector: bySector
        .filter((s) => s.sector !== null)
        .map((s) => ({
          sector: s.sector!,
          count: s._count._all,
        })),
      monthlyNew,
      topDeals,
      sentinelStats,
    },
  })
}
