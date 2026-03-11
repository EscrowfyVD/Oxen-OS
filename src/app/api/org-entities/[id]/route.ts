import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { name, jurisdiction, type, parentId, order } = body

  const existing = await prisma.orgEntity.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  const entity = await prisma.orgEntity.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(jurisdiction !== undefined && { jurisdiction }),
      ...(type !== undefined && { type }),
      ...(parentId !== undefined && { parentId }),
      ...(order !== undefined && { order }),
    },
  })

  return NextResponse.json({ entity })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.orgEntity.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  // Re-parent children to root before deleting
  await prisma.orgEntity.updateMany({
    where: { parentId: id },
    data: { parentId: null },
  })

  await prisma.orgEntity.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
