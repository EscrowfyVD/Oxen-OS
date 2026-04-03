import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const entity = searchParams.get("entity")
  const active = searchParams.get("active")

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

  const body = await request.json()
  const { name, bankName, currency, iban, accountType, entity, currentBalance, notes } = body

  if (!name || !bankName) {
    return NextResponse.json({ error: "name and bankName are required" }, { status: 400 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const account = await prisma.bankAccount.create({
    data: {
      name,
      bankName,
      currency: currency || "EUR",
      iban: iban || null,
      accountType: accountType || "operating",
      entity: entity || "oxen",
      currentBalance: currentBalance ? parseFloat(currentBalance) : 0,
      notes: notes || null,
      createdBy: userId,
    },
  })

  return NextResponse.json({ account }, { status: 201 })
}
