import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { resolved, resolvedBy, resolvedNote } = body

  const data: Record<string, unknown> = {}

  if (resolved !== undefined) {
    data.resolved = resolved
    if (resolved) {
      data.resolvedAt = new Date()
    } else {
      data.resolvedAt = null
    }
  }
  if (resolvedBy !== undefined) data.resolvedBy = resolvedBy
  if (resolvedNote !== undefined) data.resolvedNote = resolvedNote

  const updated = await prisma.seoAlert.update({
    where: { id },
    data,
  })

  return NextResponse.json(updated)
}
