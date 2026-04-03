import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  // All active deals (not closed)
  const deals = await prisma.deal.findMany({
    where: { stage: { notIn: ["closed_won", "closed_lost"] } },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          vertical: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { winProbability: "desc" },
  })

  // 3 forecast buckets
  // Committed: winProbability >= 80%
  const committed = deals.filter((d) => (d.winProbability ?? 0) >= 80)
  // Probable / Best Case: 50% <= winProbability < 80%
  const probable = deals.filter(
    (d) => (d.winProbability ?? 0) >= 50 && (d.winProbability ?? 0) < 80
  )
  // Stretch / Upside: winProbability < 50%
  const stretch = deals.filter((d) => (d.winProbability ?? 0) < 50)

  const sumDealValue = (arr: typeof deals) =>
    arr.reduce((s, d) => s + (d.dealValue ?? 0), 0)
  const sumWeightedValue = (arr: typeof deals) =>
    arr.reduce((s, d) => s + (d.weightedValue ?? 0), 0)

  // Current monthly revenue (from won deals)
  const currentAgg = await prisma.deal.aggregate({
    where: { stage: "closed_won", dealValue: { not: null } },
    _sum: { dealValue: true },
  })
  const currentMonthlyRevenue = currentAgg._sum.dealValue ?? 0

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
    // Deals closing before this month contribute weighted value
    const monthDate = new Date(month + "-01")
    const closingDeals = deals.filter(
      (d) => d.expectedCloseDate && new Date(d.expectedCloseDate) <= monthDate
    )
    const newRevenue = closingDeals.reduce(
      (s, d) => s + (d.weightedValue ?? 0),
      0
    )
    return {
      month,
      base: currentMonthlyRevenue,
      committed: committed
        .filter((d) => d.expectedCloseDate && new Date(d.expectedCloseDate) <= monthDate)
        .reduce((s, d) => s + (d.weightedValue ?? 0), 0),
      probable: probable
        .filter((d) => d.expectedCloseDate && new Date(d.expectedCloseDate) <= monthDate)
        .reduce((s, d) => s + (d.weightedValue ?? 0), 0),
      stretch: stretch
        .filter((d) => d.expectedCloseDate && new Date(d.expectedCloseDate) <= monthDate)
        .reduce((s, d) => s + (d.weightedValue ?? 0), 0),
      total: currentMonthlyRevenue + newRevenue,
    }
  })

  const formatDeals = (arr: typeof deals) =>
    arr.map((d) => ({
      ...d,
      contactName: `${d.contact.firstName} ${d.contact.lastName}`,
      companyName: d.company?.name ?? null,
    }))

  return NextResponse.json({
    forecast: {
      currentMonthlyRevenue,
      committed: {
        count: committed.length,
        totalDealValue: sumDealValue(committed),
        weightedValue: sumWeightedValue(committed),
        deals: formatDeals(committed),
      },
      probable: {
        count: probable.length,
        totalDealValue: sumDealValue(probable),
        weightedValue: sumWeightedValue(probable),
        deals: formatDeals(probable),
      },
      stretch: {
        count: stretch.length,
        totalDealValue: sumDealValue(stretch),
        weightedValue: sumWeightedValue(stretch),
        deals: formatDeals(stretch),
      },
      projections,
    },
  })
}
