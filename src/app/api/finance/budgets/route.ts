import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { upsertBudgetsSchema, budgetsQuery } from "../_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, budgetsQuery)
  if ("error" in vq) return vq.error
  const { month } = vq.data
  const entityId = vq.data.entity

  const where: Record<string, unknown> = { month }
  if (entityId && entityId !== "all") where.entityId = entityId

  const budgets = await prisma.financeBudget.findMany({
    where,
    orderBy: { category: "asc" },
  })

  // Get actual spend for the same month
  const [year, mon] = month.split("-").map(Number)
  const monthStart = new Date(year, mon - 1, 1)
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999)

  const entityWhere: Record<string, unknown> = {}
  if (entityId && entityId !== "all") entityWhere.entity = entityId

  const actuals = await prisma.financeTransaction.groupBy({
    by: ["category"],
    where: {
      ...entityWhere,
      type: "expense",
      date: { gte: monthStart, lte: monthEnd },
    },
    _sum: { amountEur: true, amount: true },
  })

  const actualMap: Record<string, number> = {}
  for (const a of actuals) {
    actualMap[a.category] = a._sum.amountEur ?? a._sum.amount ?? 0
  }

  const budgetsWithActual = budgets.map((b) => ({
    ...b,
    actual: actualMap[b.category] || 0,
    variance: b.amount - (actualMap[b.category] || 0),
  }))

  return NextResponse.json({ budgets: budgetsWithActual })
}

export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("finance")
  if (error) return error

  const v = await validateBody(request, upsertBudgetsSchema)
  if ("error" in v) return v.error
  const { month, entityId, items } = v.data

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const ent = entityId || "oxen"

  const results = []
  for (const item of items.filter((i) => i.amount > 0)) {
    const budget = await prisma.financeBudget.upsert({
      where: { category_month_entityId: { category: item.category, month, entityId: ent } },
      create: {
        category: item.category,
        amount: item.amount,
        month,
        entityId: ent,
        notes: item.notes || null,
        createdBy: userId,
      },
      update: {
        amount: item.amount,
        notes: item.notes || null,
      },
    })
    results.push(budget)
  }

  return NextResponse.json({ budgets: results })
}
