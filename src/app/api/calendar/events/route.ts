import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = searchParams.get("limit")
  const upcoming = searchParams.get("upcoming")
  const start = searchParams.get("start")
  const end = searchParams.get("end")
  const owners = searchParams.get("owners") // comma-separated emails

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (upcoming === "true") {
    where.startTime = { gte: new Date() }
  } else if (start || end) {
    where.startTime = {}
    if (start) where.startTime.gte = new Date(start)
    if (end) where.startTime.lte = new Date(end)
  }

  // Filter by calendar owners if specified
  if (owners) {
    const ownerList = owners.split(",").map((o) => o.trim()).filter(Boolean)
    if (ownerList.length > 0) {
      where.calendarOwner = { in: ownerList }
    }
  }

  const dbEvents = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: { callNote: { select: { id: true, title: true } } },
    ...(limit ? { take: parseInt(limit, 10) } : {}),
  })

  // Map DB fields to the shape the frontend expects
  const events = dbEvents.map((e) => ({
    id: e.id,
    googleEventId: e.googleEventId,
    title: e.title,
    description: e.description,
    start: e.startTime.toISOString(),
    end: e.endTime.toISOString(),
    attendees: e.attendees,
    location: e.location,
    meetLink: e.meetLink,
    calendarOwner: e.calendarOwner,
    callNoteId: e.callNote?.id ?? null,
    callNoteTitle: e.callNote?.title ?? null,
  }))

  return NextResponse.json({ events })
}
