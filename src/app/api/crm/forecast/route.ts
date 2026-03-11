import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // All active deals
  const deals = await prisma.deal.findMany({
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          company: true,
          sector: true,
          segment: true,
        },
      },
    },
    orderBy: { probability: "desc" },
  })

  // 3 forecast buckets
  // Committed: probability >= 80%
  const committed = deals.filter((d) => d.probability >= 80)
  // Probable / Best Case: 50% <= probability < 80%
  const probable = deals.filter((d) => d.probability >= 50 && d.probability < 80)
  // Stretch / Upside: probability < 50%
  const stretch = deals.filter((d) => d.probability < 50)

  const sumRevenue = (arr: typeof deals) =>
    arr.reduce((s, d) => s + (d.expectedRevenue ?? 0), 0)
  const sumWeighted = (arr: typeof deals) =>
    arr.reduce((s, d) => s + (d.expectedRevenue ?? 0) * (d.probability / 100), 0)
  const sumVolume = (arr: typeof deals) =>
    arr.reduce((s, d) => s + (d.expectedVolume ?? 0), 0)

  // Current monthly revenue (from won customers)
  const currentAgg = await prisma.contact.aggregate({
    where: { status: "won", monthlyRevenue: { not: null } },
    _sum: { monthlyRevenue: true },
  })
  const currentMonthlyRevenue = currentAgg._sum.monthlyRevenue ?? 0

  // Projections for next 6 months
  const months: string[] = []
  const now = new Date()
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    )
  }

  const projections = months.map((month) => {
    // Deals closing before this month contribute weighted revenue
    const monthDate = new Date(month + "-01")
    const closingDeals = deals.filter(
      (d) => d.closeDate && new Date(d.closeDate) <= monthDate
    )
    const newRevenue = closingDeals.reduce(
      (s, d) => s + (d.expectedRevenue ?? 0) * (d.probability / 100),
      0
    )
    return {
      month,
      base: currentMonthlyRevenue,
      committed: committed
        .filter((d) => d.closeDate && new Date(d.closeDate) <= monthDate)
        .reduce((s, d) => s + (d.expectedRevenue ?? 0) * (d.probability / 100), 0),
      probable: probable
        .filter((d) => d.closeDate && new Date(d.closeDate) <= monthDate)
        .reduce((s, d) => s + (d.expectedRevenue ?? 0) * (d.probability / 100), 0),
      stretch: stretch
        .filter((d) => d.closeDate && new Date(d.closeDate) <= monthDate)
        .reduce((s, d) => s + (d.expectedRevenue ?? 0) * (d.probability / 100), 0),
      total: currentMonthlyRevenue + newRevenue,
    }
  })

  return NextResponse.json({
    forecast: {
      currentMonthlyRevenue,
      committed: {
        count: committed.length,
        totalRevenue: sumRevenue(committed),
        weightedRevenue: sumWeighted(committed),
        totalVolume: sumVolume(committed),
        deals: committed,
      },
      probable: {
        count: probable.length,
        totalRevenue: sumRevenue(probable),
        weightedRevenue: sumWeighted(probable),
        totalVolume: sumVolume(probable),
        deals: probable,
      },
      stretch: {
        count: stretch.length,
        totalRevenue: sumRevenue(stretch),
        weightedRevenue: sumWeighted(stretch),
        totalVolume: sumVolume(stretch),
        deals: stretch,
      },
      projections,
    },
  })
}
