import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params

  const note = await prisma.callNote.findUnique({
    where: { id },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startTime: true,
          attendees: true,
          meetLink: true,
        },
      },
    },
  })

  if (!note) {
    return NextResponse.json({ error: "Call note not found" }, { status: 404 })
  }

  return NextResponse.json({ note })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { title, date, htmlContent, noteData, eventId } = body

  const existing = await prisma.callNote.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Call note not found" }, { status: 404 })
  }

  const note = await prisma.callNote.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(htmlContent !== undefined && { htmlContent }),
      ...(noteData !== undefined && { noteData }),
      ...(eventId !== undefined && { eventId }),
    },
  })

  return NextResponse.json({ note })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params

  const existing = await prisma.callNote.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Call note not found" }, { status: 404 })
  }

  await prisma.callNote.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
