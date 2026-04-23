import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { serializeMoney, sumDecimals } from "@/lib/decimal"
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  STAGE_PROBABILITY,
} from "@/lib/crm-config"

export async function GET(req: NextRequest) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const url = new URL(req.url)
  const owner = url.searchParams.get("owner") || null
  const months = Math.min(Math.max(parseInt(url.searchParams.get("months") ?? "4", 10) || 4, 1), 12)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed

  // Build month ranges
  const monthRanges: Array<{
    label: string
    startDate: Date
    endDate: Date
  }> = []

  for (let i = 0; i < months; i++) {
    const m = currentMonth + i
    const year = currentYear + Math.floor(m / 12)
    const month = m % 12
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999) // last day of month
    const label = startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    monthRanges.push({ label, startDate, endDate })
  }

  // Query all deals across the full date range
  const globalStart = monthRanges[0].startDate
  const globalEnd = monthRanges[monthRanges.length - 1].endDate

  const whereClause: Record<string, unknown> = {
    expectedCloseDate: {
      gte: globalStart,
      lte: globalEnd,
    },
    stage: { notIn: ["closed_lost"] },
  }
  if (owner) {
    whereClause.dealOwner = owner
  }

  const deals = await prisma.deal.findMany({
    where: whereClause,
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dealValue: "desc" },
  })

  // Build month buckets
  const monthsResult = monthRanges.map((range) => {
    const monthDeals = deals.filter((d) => {
      if (!d.expectedCloseDate) return false
      const close = new Date(d.expectedCloseDate)
      return close >= range.startDate && close <= range.endDate
    })

    // Group by stage
    // Sprint 3.2 — dealValue/weightedValue are Decimal. Aggregate in Decimal precision
    // then convert to number once at the boundary for the JSON response and arithmetic.
    const byStage = PIPELINE_STAGES
      .filter((s) => s.id !== "closed_lost")
      .map((stage) => {
        const stageDeals = monthDeals.filter((d) => d.stage === stage.id)
        const totalValue = serializeMoney(sumDecimals(stageDeals.map((d) => d.dealValue))) ?? 0
        const weightedValue = serializeMoney(sumDecimals(stageDeals.map((d) => d.weightedValue))) ?? 0

        return {
          stageId: stage.id,
          label: stage.label,
          color: stage.color,
          deals: stageDeals.map((d) => ({
            id: d.id,
            contactId: d.contact?.id ?? null,
            dealName: d.dealName,
            contactName: d.contact
              ? `${d.contact.firstName} ${d.contact.lastName}`
              : "Unknown",
            companyName: d.company?.name ?? null,
            dealValue: serializeMoney(d.dealValue),
            weightedValue: serializeMoney(d.weightedValue),
            winProbability: d.winProbability,
            stage: d.stage,
            aiDealHealth: d.aiDealHealth ?? null,
          })),
          totalValue,
          weightedValue,
        }
      })
      .filter((s) => s.deals.length > 0)

    const totalValue = serializeMoney(sumDecimals(monthDeals.map((d) => d.dealValue))) ?? 0
    const totalWeightedValue = serializeMoney(sumDecimals(monthDeals.map((d) => d.weightedValue))) ?? 0
    const dealCount = monthDeals.length

    return {
      label: range.label,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      byStage,
      totalValue,
      totalWeightedValue,
      dealCount,
    }
  })

  // Scenarios across all months
  const allMonthDeals = deals.filter((d) => {
    if (!d.expectedCloseDate) return false
    const close = new Date(d.expectedCloseDate)
    return close >= globalStart && close <= globalEnd
  })

  // Sprint 3.2 — Decimal-precision aggregation, serialize once at JSON boundary.
  const bestCase = serializeMoney(sumDecimals(allMonthDeals.map((d) => d.dealValue))) ?? 0
  const expected = serializeMoney(sumDecimals(allMonthDeals.map((d) => d.weightedValue))) ?? 0
  const worstCase = serializeMoney(
    sumDecimals(
      allMonthDeals
        .filter((d) => d.stage === "closed_won" || d.stage === "negotiation")
        .map((d) => d.dealValue),
    ),
  ) ?? 0

  return NextResponse.json({
    months: monthsResult,
    scenarios: {
      bestCase,
      expected,
      worstCase,
    },
  })
}
