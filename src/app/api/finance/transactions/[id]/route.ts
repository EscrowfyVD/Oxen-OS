import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { serializeMoney } from "@/lib/decimal"
import { updateFinanceTransactionSchema } from "../../_schemas"

// Sprint 3.2 — serialize Decimal fields on a FinanceTransaction for JSON.
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { id } = await params
  const transaction = await prisma.financeTransaction.findUnique({
    where: { id },
    include: { contact: { select: { id: true, firstName: true, lastName: true, company: { select: { id: true, name: true } } } } },
  })

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  }

  return NextResponse.json({ transaction: serializeTx(transaction) })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { id } = await params
  const v = await validateBody(request, updateFinanceTransactionSchema)
  if ("error" in v) return v.error
  const body = v.data

  const data: Record<string, unknown> = {}
  const fields = [
    "type", "category", "description", "currency", "entity",
    "recurringPeriod", "paymentSource", "bankAccountName", "reference",
    "status", "reimbursedTo", "contactId", "notes", "attachmentUrl", "attachmentName",
  ] as const
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f] || null
  }
  if (body.amount !== undefined) {
    data.amount = body.amount
    const rate = body.exchangeRate ?? 1
    data.exchangeRate = rate
    const cur = body.currency || "EUR"
    data.amountEur = cur === "EUR" ? data.amount : (data.amount as number) * rate
  }
  if (body.date !== undefined) data.date = new Date(body.date)
  if (body.recurring !== undefined) data.recurring = body.recurring
  if (body.reimbursable !== undefined) data.reimbursable = body.reimbursable
  if (body.reimbursedDate !== undefined) data.reimbursedDate = body.reimbursedDate ? new Date(body.reimbursedDate) : null

  const transaction = await prisma.financeTransaction.update({
    where: { id },
    data,
    include: { contact: { select: { id: true, firstName: true, lastName: true, company: { select: { id: true, name: true } } } } },
  })

  return NextResponse.json({ transaction: serializeTx(transaction) })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { id } = await params
  await prisma.financeTransaction.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
