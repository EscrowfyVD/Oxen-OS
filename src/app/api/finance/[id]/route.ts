import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { updateFinanceEntrySchema } from "../_schemas"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { id } = await params
  const v = await validateBody(request, updateFinanceEntrySchema)
  if ("error" in v) return v.error
  const { type, category, description, amount, currency, date, entity, recurring, notes } = v.data

  const existing = await prisma.financeEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  const entry = await prisma.financeEntry.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description: description || null }),
      ...(amount !== undefined && { amount }),
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
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { id } = await params

  const existing = await prisma.financeEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  await prisma.financeEntry.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
