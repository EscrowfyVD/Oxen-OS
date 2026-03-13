import { NextResponse } from "next/server"
import { getUserRole } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { canAccess } from "@/lib/permissions"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session } = await getUserRole()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
  const { session } = await getUserRole()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
  const { session, roleLevel } = await getUserRole()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const existing = await prisma.callNote.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Call note not found" }, { status: 404 })
  }

  // Only admin+ or the creator can delete
  const isAdmin = canAccess(roleLevel, "admin")
  const isCreator = existing.createdBy === session.user.email
  if (!isAdmin && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.callNote.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
