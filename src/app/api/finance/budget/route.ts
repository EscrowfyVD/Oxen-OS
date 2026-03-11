import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") // "YYYY-MM"
  const entity = searchParams.get("entity")

  if (!month) return NextResponse.json({ error: "month parameter required" }, { status: 400 })

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
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { month, entity, items } = body as {
    month: string
    entity?: string
    items: Array<{ category: string; amount: number }>
  }

  if (!month || !items || !Array.isArray(items)) {
    return NextResponse.json({ error: "month and items are required" }, { status: 400 })
  }

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
