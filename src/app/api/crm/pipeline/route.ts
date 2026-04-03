import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  // All deals
  const deals = await prisma.deal.findMany({
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
    orderBy: { createdAt: "desc" },
  })

  // Pipeline KPIs
  const totalDeals = deals.length
  const totalDealValue = deals.reduce((s, d) => s + (d.dealValue ?? 0), 0)
  const totalWeightedValue = deals.reduce(
    (s, d) => s + (d.weightedValue ?? 0),
    0
  )
  const avgProbability =
    totalDeals > 0
      ? Math.round(
          deals.reduce((s, d) => s + (d.winProbability ?? 0), 0) / totalDeals
        )
      : 0

  // By stage
  const stages = [
    "new_lead",
    "discovery",
    "demo",
    "proposal",
    "negotiation",
    "commit",
    "integration",
    "volume_ramp",
    "closed_won",
    "closed_lost",
  ]
  const byStage = stages.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage)
    return {
      stage,
      count: stageDeals.length,
      dealValue: stageDeals.reduce((s, d) => s + (d.dealValue ?? 0), 0),
      weightedValue: stageDeals.reduce(
        (s, d) => s + (d.weightedValue ?? 0),
        0
      ),
    }
  })

  // Won/Lost counts this quarter (using Deal stage + closedAt)
  const now = new Date()
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const wonThisQuarter = await prisma.deal.count({
    where: {
      stage: "closed_won",
      closedAt: { gte: quarterStart },
    },
  })
  const lostThisQuarter = await prisma.deal.count({
    where: {
      stage: "closed_lost",
      closedAt: { gte: quarterStart },
    },
  })

  return NextResponse.json({
    pipeline: {
      totalDeals,
      totalDealValue,
      totalWeightedValue,
      avgProbability,
      byStage,
      deals: deals.map((d) => ({
        ...d,
        contactName: `${d.contact.firstName} ${d.contact.lastName}`,
        companyName: d.company?.name ?? null,
      })),
      wonThisQuarter,
      lostThisQuarter,
    },
  })
}
