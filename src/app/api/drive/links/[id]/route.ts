import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.driveLink.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 })
  }

  await prisma.driveLink.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
