import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { bulkFinanceEntriesEnvelope } from "../_schemas"

const VALID_TYPES = ["revenue", "expense", "budget"]

export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("finance")
  if (error) return error

  const v = await validateBody(request, bulkFinanceEntriesEnvelope)
  if ("error" in v) return v.error
  const { rows } = v.data

  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  const errors: Array<{ row: number; error: string }> = []
  const valid: Array<{
    type: string
    category: string
    description: string | null
    amount: number
    currency: string
    date: Date
    entity: string
    recurring: boolean
    notes: string | null
    createdBy: string
  }> = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const type = (r.type || "").toLowerCase().trim()
    const category = (r.category || "").trim()
    const amount = parseFloat(r.amount)
    const date = r.date ? new Date(r.date) : null

    if (!VALID_TYPES.includes(type)) {
      errors.push({ row: i + 1, error: `Invalid type: ${r.type}` })
      continue
    }
    if (!category) {
      errors.push({ row: i + 1, error: "Missing category" })
      continue
    }
    if (isNaN(amount)) {
      errors.push({ row: i + 1, error: `Invalid amount: ${r.amount}` })
      continue
    }
    if (!date || isNaN(date.getTime())) {
      errors.push({ row: i + 1, error: `Invalid date: ${r.date}` })
      continue
    }

    valid.push({
      type,
      category,
      description: r.description || null,
      amount,
      currency: r.currency || "EUR",
      date,
      entity: r.entity || "oxen",
      recurring: r.recurring === "true",
      notes: r.notes || null,
      createdBy: userId,
    })
  }

  let created = 0
  if (valid.length > 0) {
    const result = await prisma.financeEntry.createMany({ data: valid })
    created = result.count
  }

  return NextResponse.json({ created, errors, total: rows.length }, { status: 201 })
}
