import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params

  const view = await prisma.smartView.findUnique({ where: { id } })
  if (!view) {
    return NextResponse.json({ error: "View not found" }, { status: 404 })
  }

  // Only the creator can delete their view
  if (view.createdBy !== session.user?.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.smartView.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
