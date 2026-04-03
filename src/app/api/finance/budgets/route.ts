import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month")
  const entityId = searchParams.get("entity")

  if (!month) {
    return NextResponse.json({ error: "month parameter required" }, { status: 400 })
  }

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

  const body = await request.json()
  const { month, entityId, items } = body as {
    month: string
    entityId?: string
    items: Array<{ category: string; amount: number; notes?: string }>
  }

  if (!month || !items || !Array.isArray(items)) {
    return NextResponse.json({ error: "month and items are required" }, { status: 400 })
  }

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
