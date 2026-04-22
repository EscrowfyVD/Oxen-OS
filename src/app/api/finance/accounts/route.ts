import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createBankAccountSchema, listBankAccountsQuery } from "../_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const v = validateSearchParams(searchParams, listBankAccountsQuery)
  if ("error" in v) return v.error
  const { entity, active } = v.data

  const where: Record<string, unknown> = {}
  if (entity && entity !== "all") where.entity = entity
  if (active === "true") where.isActive = true

  const accounts = await prisma.bankAccount.findMany({
    where,
    orderBy: [{ entity: "asc" }, { name: "asc" }],
  })

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0)

  return NextResponse.json({ accounts, totalBalance })
}

export async function POST(request: Request) {
  const { error, session } = await requirePageAccess("finance")
  if (error) return error

  const v = await validateBody(request, createBankAccountSchema)
  if ("error" in v) return v.error
  const { name, bankName, currency, iban, accountType, entity, currentBalance, notes } = v.data

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const account = await prisma.bankAccount.create({
    data: {
      name,
      bankName,
      currency,
      iban: iban || null,
      accountType,
      entity,
      currentBalance: currentBalance ?? 0,
      notes: notes || null,
      createdBy: userId,
    },
  })

  return NextResponse.json({ account }, { status: 201 })
}
