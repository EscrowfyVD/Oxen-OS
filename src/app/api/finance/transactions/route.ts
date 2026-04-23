import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { serializeMoney } from "@/lib/decimal"
import { createFinanceTransactionSchema, listFinanceTransactionsQuery } from "../_schemas"

// Sprint 3.2 — centralize transaction Decimal serialization for JSON responses.
function serializeTx<
  T extends {
    amount: import("@prisma/client").Prisma.Decimal
    amountEur: import("@prisma/client").Prisma.Decimal | null
    exchangeRate: import("@prisma/client").Prisma.Decimal | null
  },
>(t: T) {
  return {
    ...t,
    amount: serializeMoney(t.amount) ?? 0,
    amountEur: serializeMoney(t.amountEur),
    exchangeRate: serializeMoney(t.exchangeRate),
  }
}

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const v = validateSearchParams(searchParams, listFinanceTransactionsQuery)
  if ("error" in v) return v.error
  const { type, category, entity, dateFrom, dateTo, search, status, paymentSource, page, limit } = v.data
  const sortBy = v.data.sortBy || "date"
  const sortDir = v.data.sortDir || "desc"

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

  return NextResponse.json({
    transactions: transactions.map(serializeTx),
    total,
    page,
    limit,
  })
}

export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("finance")
  if (error) return error

  const v = await validateBody(request, createFinanceTransactionSchema)
  if ("error" in v) return v.error
  const {
    type, category, description, amount, currency, exchangeRate,
    date, entity, recurring, recurringPeriod, paymentSource,
    bankAccountName, reference, status, reimbursable, reimbursedTo,
    contactId, notes,
  } = v.data

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const rate = exchangeRate ?? 1
  const amountEur = currency === "EUR" ? amount : amount * rate

  const transaction = await prisma.financeTransaction.create({
    data: {
      type,
      category,
      description: description || null,
      amount,
      currency,
      exchangeRate: rate,
      amountEur,
      date: new Date(date),
      entity,
      recurring: recurring ?? false,
      recurringPeriod: recurringPeriod || null,
      paymentSource: paymentSource || null,
      bankAccountName: bankAccountName || null,
      reference: reference || null,
      status,
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

  return NextResponse.json({ transaction: serializeTx(transaction) }, { status: 201 })
}
