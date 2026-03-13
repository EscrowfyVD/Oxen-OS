import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("marketing")
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { title, description, platform, type, status, priority, scheduledFor, publishedAt, assignedTo, tags, notes } = body

  const existing = await prisma.contentIdea.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Idea not found" }, { status: 404 })

  const idea = await prisma.contentIdea.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(platform !== undefined && { platform: platform || null }),
      ...(type !== undefined && { type: type || null }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(scheduledFor !== undefined && { scheduledFor: scheduledFor ? new Date(scheduledFor) : null }),
      ...(publishedAt !== undefined && { publishedAt: publishedAt ? new Date(publishedAt) : null }),
      ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
      ...(tags !== undefined && { tags }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  })

  return NextResponse.json({ idea })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: delErr } = await requirePageAccess("marketing")
  if (delErr) return delErr

  const { id } = await params

  const existing = await prisma.contentIdea.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Idea not found" }, { status: 404 })

  await prisma.contentIdea.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
