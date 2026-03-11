import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const category = searchParams.get("category")
  const entity = searchParams.get("entity")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const search = searchParams.get("search")
  const sortBy = searchParams.get("sortBy") || "date"
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc"

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (category) where.category = category
  if (entity) where.entity = entity
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo + "T23:59:59Z") }),
    }
  }
  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ]
  }

  const entries = await prisma.financeEntry.findMany({
    where,
    orderBy: { [sortBy]: sortDir },
  })

  const total = await prisma.financeEntry.count({ where })

  return NextResponse.json({ entries, total })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { type, category, description, amount, currency, date, entity, recurring, notes } = body

  if (!type || !category || amount == null || !date) {
    return NextResponse.json({ error: "type, category, amount, and date are required" }, { status: 400 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const entry = await prisma.financeEntry.create({
    data: {
      type,
      category,
      description: description || null,
      amount: parseFloat(amount),
      currency: currency || "EUR",
      date: new Date(date),
      entity: entity || "oxen",
      recurring: recurring ?? false,
      notes: notes || null,
      createdBy: userId,
    },
  })

  return NextResponse.json({ entry }, { status: 201 })
}
