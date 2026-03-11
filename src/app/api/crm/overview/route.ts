import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Total active customers (won status)
  const activeCustomers = await prisma.contact.count({
    where: { status: "won" },
  })

  // Total contacts
  const totalContacts = await prisma.contact.count()

  // Monthly GTV (sum of monthlyGtv across active customers)
  const gtvAgg = await prisma.contact.aggregate({
    where: { status: "won", monthlyGtv: { not: null } },
    _sum: { monthlyGtv: true },
  })
  const monthlyGtv = gtvAgg._sum.monthlyGtv ?? 0

  // Monthly Revenue (sum of monthlyRevenue across active customers)
  const revAgg = await prisma.contact.aggregate({
    where: { status: "won", monthlyRevenue: { not: null } },
    _sum: { monthlyRevenue: true },
  })
  const monthlyRevenue = revAgg._sum.monthlyRevenue ?? 0

  // Average take rate
  const rateAgg = await prisma.contact.aggregate({
    where: { status: "won", takeRate: { not: null } },
    _avg: { takeRate: true },
  })
  const avgTakeRate = rateAgg._avg.takeRate ?? 0

  // Revenue run rate (monthly * 12)
  const revenueRunRate = monthlyRevenue * 12

  // Pipeline value (non-won, non-lost)
  const pipelineAgg = await prisma.contact.aggregate({
    where: { status: { notIn: ["won", "lost"] } },
    _sum: { value: true },
  })
  const pipelineValue = pipelineAgg._sum.value ?? 0

  // Revenue trend (last 12 months from CustomerMetrics)
  let revenueTrend: Array<{ month: string; gtv: number; revenue: number }> = []
  try {
    const raw = await prisma.$queryRaw<
      Array<{ month: string; gtv: number; revenue: number }>
    >`
      SELECT month,
             SUM(gtv)::float as gtv,
             SUM(revenue)::float as revenue
      FROM "CustomerMetrics"
      GROUP BY month
      ORDER BY month ASC
      LIMIT 12
    `
    revenueTrend = raw.map((r) => ({
      month: r.month,
      gtv: Number(r.gtv),
      revenue: Number(r.revenue),
    }))
  } catch {
    revenueTrend = []
  }

  // Volume concentration (top customers by GTV)
  const topCustomers = await prisma.contact.findMany({
    where: { status: "won", monthlyGtv: { not: null } },
    orderBy: { monthlyGtv: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      company: true,
      monthlyGtv: true,
      monthlyRevenue: true,
      takeRate: true,
      healthStatus: true,
      segment: true,
    },
  })

  // Concentration percentages
  const allGtv = topCustomers.reduce((s, c) => s + (c.monthlyGtv ?? 0), 0)
  const top1 = topCustomers[0]?.monthlyGtv ?? 0
  const top2to5 = topCustomers.slice(1, 5).reduce((s, c) => s + (c.monthlyGtv ?? 0), 0)
  const top6to10 = topCustomers.slice(5, 10).reduce((s, c) => s + (c.monthlyGtv ?? 0), 0)
  const restGtv = monthlyGtv - top1 - top2to5 - top6to10

  const concentration = {
    top1Pct: allGtv > 0 ? Math.round((top1 / monthlyGtv) * 100) : 0,
    top2to5Pct: allGtv > 0 ? Math.round((top2to5 / monthlyGtv) * 100) : 0,
    top6to10Pct: allGtv > 0 ? Math.round((top6to10 / monthlyGtv) * 100) : 0,
    restPct: monthlyGtv > 0 ? Math.round((restGtv / monthlyGtv) * 100) : 0,
  }

  // Alerts: at-risk or declining customers
  const alerts = await prisma.contact.findMany({
    where: {
      status: "won",
      healthStatus: { in: ["at_risk", "declining", "churned"] },
    },
    select: {
      id: true,
      name: true,
      company: true,
      healthStatus: true,
      monthlyGtv: true,
      monthlyRevenue: true,
      segment: true,
    },
    take: 10,
    orderBy: { monthlyGtv: "desc" },
  })

  // Health distribution
  const healthCounts = await prisma.contact.groupBy({
    by: ["healthStatus"],
    where: { status: "won" },
    _count: { _all: true },
  })

  return NextResponse.json({
    overview: {
      monthlyGtv,
      monthlyRevenue,
      avgTakeRate: Math.round(avgTakeRate * 100) / 100,
      revenueRunRate,
      activeCustomers,
      totalContacts,
      pipelineValue,
      revenueTrend,
      concentration,
      topCustomers,
      alerts,
      healthDistribution: healthCounts.map((h) => ({
        status: h.healthStatus,
        count: h._count._all,
      })),
    },
  })
}
