import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { serializeMoney, sumDecimals } from "@/lib/decimal"

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

  // Sprint 3.2 — dealValue/weightedValue are Decimal, winProbability stays Float.
  // Convert each per-row Decimal to number once, then aggregate in number-space.
  const computeWeighted = (d: {
    dealValue: import("@prisma/client").Prisma.Decimal | null
    weightedValue: import("@prisma/client").Prisma.Decimal | null
    winProbability: number | null
  }): number => {
    const explicit = serializeMoney(d.weightedValue)
    if (explicit !== null) return explicit
    const dv = serializeMoney(d.dealValue) ?? 0
    const prob = (d.winProbability ?? 0) / 100
    return dv * prob
  }

  const byStage = PIPELINE_STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage)
    const totalValue = serializeMoney(sumDecimals(stageDeals.map((d) => d.dealValue))) ?? 0
    const weightedTotal = stageDeals.reduce((sum, d) => sum + computeWeighted(d), 0)

    return {
      stage,
      count: stageDeals.length,
      totalValue,
      weightedTotal,
    }
  })

  const totalValue = serializeMoney(sumDecimals(deals.map((d) => d.dealValue))) ?? 0
  const totalWeighted = deals.reduce((sum, d) => sum + computeWeighted(d), 0)

  return NextResponse.json({
    pipeline: {
      totalDeals: deals.length,
      totalValue,
      totalWeighted,
      byStage,
    },
  })
}
