import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { starred, read, actionable, dismissed } = body

  const data: Record<string, unknown> = {}
  if (starred !== undefined) data.starred = starred
  if (read !== undefined) data.read = read
  if (actionable !== undefined) data.actionable = actionable
  if (dismissed !== undefined) data.dismissed = dismissed

  const result = await prisma.intelResult.update({ where: { id }, data })
  return NextResponse.json({ result })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.intelResult.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
