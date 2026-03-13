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
          name: true,
          company: true,
          sector: true,
          segment: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Pipeline KPIs
  const totalDeals = deals.length
  const totalExpectedRevenue = deals.reduce((s, d) => s + (d.expectedRevenue ?? 0), 0)
  const totalWeightedRevenue = deals.reduce(
    (s, d) => s + (d.expectedRevenue ?? 0) * (d.probability / 100),
    0
  )
  const avgProbability =
    totalDeals > 0
      ? Math.round(deals.reduce((s, d) => s + d.probability, 0) / totalDeals)
      : 0

  // By stage
  const stages = [
    "discovery",
    "demo",
    "proposal",
    "negotiation",
    "commit",
    "integration",
    "volume_ramp",
  ]
  const byStage = stages.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage)
    return {
      stage,
      count: stageDeals.length,
      expectedRevenue: stageDeals.reduce((s, d) => s + (d.expectedRevenue ?? 0), 0),
      weightedRevenue: stageDeals.reduce(
        (s, d) => s + (d.expectedRevenue ?? 0) * (d.probability / 100),
        0
      ),
    }
  })

  // Won/Lost counts this quarter
  const now = new Date()
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const wonThisQuarter = await prisma.contact.count({
    where: {
      status: "won",
      updatedAt: { gte: quarterStart },
    },
  })
  const lostThisQuarter = await prisma.contact.count({
    where: {
      status: "lost",
      updatedAt: { gte: quarterStart },
    },
  })

  return NextResponse.json({
    pipeline: {
      totalDeals,
      totalExpectedRevenue,
      totalWeightedRevenue,
      avgProbability,
      byStage,
      deals,
      wonThisQuarter,
      lostThisQuarter,
    },
  })
}
