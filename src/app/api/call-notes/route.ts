import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const notes = await prisma.callNote.findMany({
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      date: true,
      createdBy: true,
      createdAt: true,
      eventId: true,
      event: {
        select: {
          id: true,
          title: true,
          startTime: true,
          attendees: true,
        },
      },
    },
  })

  return NextResponse.json({ notes })
}

export async function POST(request: Request) {
  const { error, session } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { title, date, htmlContent, noteData, eventId } = body

  if (!title || !date || !htmlContent) {
    return NextResponse.json(
      { error: "Missing required fields: title, date, htmlContent" },
      { status: 400 }
    )
  }

  const userId = session!.user?.id ?? session!.user?.email ?? "unknown"

  const note = await prisma.callNote.create({
    data: {
      title,
      date: new Date(date),
      htmlContent,
      noteData: noteData ?? null,
      eventId: eventId ?? null,
      createdBy: userId,
    },
  })

  return NextResponse.json({ note }, { status: 201 })
}
