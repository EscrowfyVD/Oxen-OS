import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { serializeMoney, sumDecimals } from "@/lib/decimal"

export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const wonDeals = await prisma.deal.findMany({
    where: { stage: "closed_won" },
    select: {
      id: true,
      dealName: true,
      dealValue: true,
      acquisitionSource: true,
      vertical: true,
      contact: {
        select: {
          geoZone: true,
        },
      },
      company: {
        select: {
          geoZone: true,
        },
      },
    },
  })

  // Sprint 3.2 — dealValue is Decimal; convert each to number once, then aggregate.
  // Revenue by acquisition source
  const bySource: Record<string, { count: number; totalValue: number }> = {}
  for (const deal of wonDeals) {
    const source = deal.acquisitionSource ?? "Unknown"
    const dv = serializeMoney(deal.dealValue) ?? 0
    if (!bySource[source]) bySource[source] = { count: 0, totalValue: 0 }
    bySource[source].count++
    bySource[source].totalValue += dv
  }

  // Revenue by vertical
  const byVertical: Record<string, { count: number; totalValue: number }> = {}
  for (const deal of wonDeals) {
    const verticals = deal.vertical.length > 0 ? deal.vertical : ["Uncategorized"]
    const dv = serializeMoney(deal.dealValue) ?? 0
    for (const v of verticals) {
      if (!byVertical[v]) byVertical[v] = { count: 0, totalValue: 0 }
      byVertical[v].count++
      byVertical[v].totalValue += dv
    }
  }

  // Revenue by geo zone
  const byGeoZone: Record<string, { count: number; totalValue: number }> = {}
  for (const deal of wonDeals) {
    const geo = deal.company?.geoZone ?? deal.contact?.geoZone ?? "Unknown"
    const dv = serializeMoney(deal.dealValue) ?? 0
    if (!byGeoZone[geo]) byGeoZone[geo] = { count: 0, totalValue: 0 }
    byGeoZone[geo].count++
    byGeoZone[geo].totalValue += dv
  }

  const totalRevenue = serializeMoney(sumDecimals(wonDeals.map((d) => d.dealValue))) ?? 0

  return NextResponse.json({
    revenue: {
      totalRevenue,
      totalDeals: wonDeals.length,
      bySource: Object.entries(bySource).map(([source, data]) => ({ source, ...data })),
      byVertical: Object.entries(byVertical).map(([vertical, data]) => ({ vertical, ...data })),
      byGeoZone: Object.entries(byGeoZone).map(([geoZone, data]) => ({ geoZone, ...data })),
    },
  })
}
