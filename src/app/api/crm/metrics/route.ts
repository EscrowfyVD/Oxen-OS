import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  // Monthly aggregated metrics
  let monthlyMetrics: Array<{
    month: string
    gtv: number
    revenue: number
    takeRate: number
    txCount: number
    customerCount: number
  }> = []

  try {
    const raw = await prisma.$queryRaw<
      Array<{
        month: string
        gtv: number
        revenue: number
        avg_rate: number
        tx_count: number
        customer_count: number
      }>
    >`
      SELECT month,
             SUM(gtv)::float as gtv,
             SUM(revenue)::float as revenue,
             CASE WHEN SUM(gtv) > 0 THEN (SUM(revenue) / SUM(gtv) * 100)::float ELSE 0 END as avg_rate,
             SUM("txCount")::int as tx_count,
             COUNT(DISTINCT "contactId")::int as customer_count
      FROM "CustomerMetrics"
      GROUP BY month
      ORDER BY month ASC
    `
    monthlyMetrics = raw.map((r) => ({
      month: r.month,
      gtv: Number(r.gtv),
      revenue: Number(r.revenue),
      takeRate: Math.round(Number(r.avg_rate) * 100) / 100,
      txCount: Number(r.tx_count),
      customerCount: Number(r.customer_count),
    }))
  } catch {
    monthlyMetrics = []
  }

  // Calculate growth rates between months
  const withGrowth = monthlyMetrics.map((m, i) => {
    if (i === 0) {
      return { ...m, gtvGrowth: 0, revenueGrowth: 0 }
    }
    const prev = monthlyMetrics[i - 1]
    return {
      ...m,
      gtvGrowth:
        prev.gtv > 0
          ? Math.round(((m.gtv - prev.gtv) / prev.gtv) * 100 * 10) / 10
          : 0,
      revenueGrowth:
        prev.revenue > 0
          ? Math.round(((m.revenue - prev.revenue) / prev.revenue) * 100 * 10) / 10
          : 0,
    }
  })

  return NextResponse.json({
    metrics: {
      monthly: withGrowth,
    },
  })
}
