import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { title, query, status, frequency } = body

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title
  if (query !== undefined) data.query = query
  if (status !== undefined) data.status = status
  if (frequency !== undefined) data.frequency = frequency

  const research = await prisma.intelResearch.update({ where: { id }, data })
  return NextResponse.json({ research })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.intelResearch.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
