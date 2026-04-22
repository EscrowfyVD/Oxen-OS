import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { replaceBudgetsSchema, budgetQuery } from "../_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, budgetQuery)
  if ("error" in vq) return vq.error
  const { month, entity } = vq.data

  const [year, mon] = month.split("-").map(Number)
  const monthStart = new Date(year, mon - 1, 1)
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999)

  const where: Record<string, unknown> = {
    type: "budget",
    date: { gte: monthStart, lte: monthEnd },
  }
  if (entity && entity !== "all") where.entity = entity

  const budgets = await prisma.financeEntry.findMany({
    where,
    orderBy: { category: "asc" },
  })

  return NextResponse.json({ budgets })
}

export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("finance")
  if (error) return error

  const v = await validateBody(request, replaceBudgetsSchema)
  if ("error" in v) return v.error
  const { month, entity, items } = v.data

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const [year, mon] = month.split("-").map(Number)
  const budgetDate = new Date(year, mon - 1, 1)
  const ent = entity || "oxen"

  // Delete existing budgets for this month + entity, then recreate
  const monthStart = new Date(year, mon - 1, 1)
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999)

  await prisma.financeEntry.deleteMany({
    where: {
      type: "budget",
      entity: ent,
      date: { gte: monthStart, lte: monthEnd },
    },
  })

  const data = items
    .filter((it) => it.amount > 0)
    .map((it) => ({
      type: "budget" as const,
      category: it.category,
      amount: it.amount,
      currency: "EUR",
      date: budgetDate,
      entity: ent,
      recurring: false,
      createdBy: userId,
    }))

  if (data.length > 0) {
    await prisma.financeEntry.createMany({ data })
  }

  return NextResponse.json({ success: true, count: data.length })
}
