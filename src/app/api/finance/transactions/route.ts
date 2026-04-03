import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const category = searchParams.get("category")
  const entity = searchParams.get("entity")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const search = searchParams.get("search")
  const status = searchParams.get("status")
  const paymentSource = searchParams.get("paymentSource")
  const sortBy = searchParams.get("sortBy") || "date"
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc"
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (category) where.category = category
  if (entity && entity !== "all") where.entity = entity
  if (status) where.status = status
  if (paymentSource) where.paymentSource = paymentSource
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
      { reference: { contains: search, mode: "insensitive" } },
    ]
  }

  const [transactions, total] = await Promise.all([
    prisma.financeTransaction.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, company: { select: { id: true, name: true } } } },
      },
    }),
    prisma.financeTransaction.count({ where }),
  ])

  return NextResponse.json({ transactions, total, page, limit })
}

export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("finance")
  if (error) return error

  const body = await request.json()
  const {
    type, category, description, amount, currency, exchangeRate,
    date, entity, recurring, recurringPeriod, paymentSource,
    bankAccountName, reference, status, reimbursable, reimbursedTo,
    contactId, notes,
  } = body

  if (!type || !category || amount == null || !date) {
    return NextResponse.json({ error: "type, category, amount, and date are required" }, { status: 400 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const parsedAmount = parseFloat(amount)
  const rate = exchangeRate ? parseFloat(exchangeRate) : 1
  const amountEur = currency === "EUR" ? parsedAmount : parsedAmount * rate

  const transaction = await prisma.financeTransaction.create({
    data: {
      type,
      category,
      description: description || null,
      amount: parsedAmount,
      currency: currency || "EUR",
      exchangeRate: rate,
      amountEur,
      date: new Date(date),
      entity: entity || "oxen",
      recurring: recurring ?? false,
      recurringPeriod: recurringPeriod || null,
      paymentSource: paymentSource || null,
      bankAccountName: bankAccountName || null,
      reference: reference || null,
      status: status || "confirmed",
      reimbursable: reimbursable ?? false,
      reimbursedTo: reimbursedTo || null,
      contactId: contactId || null,
      notes: notes || null,
      createdBy: userId,
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, company: { select: { id: true, name: true } } } },
    },
  })

  return NextResponse.json({ transaction }, { status: 201 })
}
