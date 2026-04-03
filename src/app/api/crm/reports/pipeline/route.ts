import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

const PIPELINE_STAGES = [
  "new_lead",
  "sequence_active",
  "replied",
  "meeting_booked",
  "demo",
  "proposal",
  "negotiation",
  "commit",
  "closed_won",
  "closed_lost",
]

export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const deals = await prisma.deal.findMany({
    select: {
      id: true,
      stage: true,
      dealValue: true,
      winProbability: true,
      weightedValue: true,
    },
  })

  const byStage = PIPELINE_STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage)
    const totalValue = stageDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
    const weightedTotal = stageDeals.reduce(
      (sum, d) => sum + (d.weightedValue ?? (d.dealValue ?? 0) * ((d.winProbability ?? 0) / 100)),
      0
    )

    return {
      stage,
      count: stageDeals.length,
      totalValue,
      weightedTotal,
    }
  })

  const totalValue = deals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
  const totalWeighted = deals.reduce(
    (sum, d) => sum + (d.weightedValue ?? (d.dealValue ?? 0) * ((d.winProbability ?? 0) / 100)),
    0
  )

  return NextResponse.json({
    pipeline: {
      totalDeals: deals.length,
      totalValue,
      totalWeighted,
      byStage,
    },
  })
}
