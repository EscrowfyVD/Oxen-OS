import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { id } = await params
  const body = await request.json()

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.bankName !== undefined) data.bankName = body.bankName
  if (body.currency !== undefined) data.currency = body.currency
  if (body.iban !== undefined) data.iban = body.iban || null
  if (body.accountType !== undefined) data.accountType = body.accountType
  if (body.entity !== undefined) data.entity = body.entity
  if (body.currentBalance !== undefined) {
    data.currentBalance = parseFloat(body.currentBalance)
    data.lastUpdated = new Date()
  }
  if (body.isActive !== undefined) data.isActive = body.isActive
  if (body.notes !== undefined) data.notes = body.notes || null

  const account = await prisma.bankAccount.update({
    where: { id },
    data,
  })

  return NextResponse.json({ account })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { id } = await params
  await prisma.bankAccount.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
