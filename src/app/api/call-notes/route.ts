import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const notes = await prisma.callNote.findMany({
    orderBy: { date: "desc" },
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

  return NextResponse.json({ notes })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, date, htmlContent, noteData, eventId } = body

  if (!title || !date || !htmlContent) {
    return NextResponse.json(
      { error: "Missing required fields: title, date, htmlContent" },
      { status: 400 }
    )
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

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
