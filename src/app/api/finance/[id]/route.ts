import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/admin"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole("admin")
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { type, category, description, amount, currency, date, entity, recurring, notes } = body

  const existing = await prisma.financeEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  const entry = await prisma.financeEntry.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description: description || null }),
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(currency !== undefined && { currency }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(entity !== undefined && { entity }),
      ...(recurring !== undefined && { recurring }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  })

  return NextResponse.json({ entry })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole("admin")
  if (error) return error

  const { id } = await params

  const existing = await prisma.financeEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  await prisma.financeEntry.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
