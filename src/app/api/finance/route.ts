import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createFinanceEntrySchema, listFinanceEntriesQuery } from "./_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const v = validateSearchParams(searchParams, listFinanceEntriesQuery)
  if ("error" in v) return v.error
  const { type, category, entity, dateFrom, dateTo, search } = v.data
  const sortBy = v.data.sortBy || "date"
  const sortDir = v.data.sortDir || "desc"

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
  const { error, session } = await requirePageAccess("finance")
  if (error) return error

  const v = await validateBody(request, createFinanceEntrySchema)
  if ("error" in v) return v.error
  const { type, category, description, amount, currency, date, entity, recurring, notes } = v.data

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const entry = await prisma.financeEntry.create({
    data: {
      type,
      category,
      description: description || null,
      amount,
      currency,
      date: new Date(date),
      entity,
      recurring: recurring ?? false,
      notes: notes || null,
      createdBy: userId,
    },
  })

  return NextResponse.json({ entry }, { status: 201 })
}
