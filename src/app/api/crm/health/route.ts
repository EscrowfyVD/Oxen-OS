import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  // All customers with relationship and deal data
  const customers = await prisma.crmContact.findMany({
    where: { lifecycleStage: "customer" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      vertical: true,
      relationshipStrength: true,
      relationshipScore: true,
      dealOwner: true,
      lastInteraction: true,
      daysSinceLastContact: true,
      totalInteractions: true,
      company: {
        select: { id: true, name: true },
      },
      deals: {
        select: {
          id: true,
          dealValue: true,
          stage: true,
          aiDealHealth: true,
        },
      },
    },
    orderBy: { relationshipScore: "desc" },
  })

  // Relationship strength distribution
  const strengthValues = ["strong", "warm", "cold", "no_relationship"]
  const distribution = strengthValues.map((strength) => {
    const filtered = customers.filter((c) => c.relationshipStrength === strength)
    return {
      status: strength,
      count: filtered.length,
      totalDealValue: filtered.reduce(
        (s, c) => s + c.deals.reduce((ds, d) => ds + (d.dealValue ?? 0), 0),
        0
      ),
    }
  })

  // By vertical
  const verticalMap = new Map<string, typeof customers>()
  for (const c of customers) {
    for (const v of c.vertical) {
      if (!verticalMap.has(v)) verticalMap.set(v, [])
      verticalMap.get(v)!.push(c)
    }
  }
  const byVertical = Array.from(verticalMap.entries()).map(([vertical, vCustomers]) => ({
    vertical,
    count: vCustomers.length,
    totalDealValue: vCustomers.reduce(
      (s, c) => s + c.deals.reduce((ds, d) => ds + (d.dealValue ?? 0), 0),
      0
    ),
    avgRelationshipScore:
      vCustomers.length > 0
        ? Math.round(
            vCustomers.reduce((s, c) => s + c.relationshipScore, 0) / vCustomers.length
          )
        : 0,
  }))

  return NextResponse.json({
    health: {
      customers: customers.map((c) => ({
        ...c,
        name: `${c.firstName} ${c.lastName}`,
        company: c.company?.name ?? null,
      })),
      distribution,
      byVertical,
      totalCustomers: customers.length,
    },
  })
}
