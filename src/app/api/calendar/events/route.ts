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
  const teamView = searchParams.get("teamView") // admin: show all team events

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (upcoming === "true") {
    where.startTime = { gte: new Date() }
  } else if (start || end) {
    where.startTime = {}
    if (start) where.startTime.gte = new Date(start)
    if (end) where.startTime.lte = new Date(end)
  }

  // Filter by calendar owners if specified (case-insensitive)
  if (owners) {
    const ownerList = owners.split(",").map((o) => o.trim().toLowerCase()).filter(Boolean)
    if (ownerList.length > 0) {
      where.calendarOwner = { in: ownerList }
    }
  }

  // User-scoped visibility: show own calendar + events where user is attendee
  // Admin with teamView=true bypasses this filter
  const userEmail = session.user?.email?.toLowerCase()
  if (userEmail && teamView !== "true") {
    // Check if user is admin
    const employee = await prisma.employee.findFirst({
      where: { email: { equals: userEmail, mode: "insensitive" } },
      select: { isAdmin: true },
    })
    const isAdmin = employee?.isAdmin === true

    if (!isAdmin) {
      // Non-admin: only see own calendar or events where they're an attendee
      // Attendees are stored as lowercase, so we match with lowercase email
      where.OR = [
        { calendarOwner: { equals: userEmail, mode: "insensitive" } },
        { attendees: { has: userEmail } },
      ]
    }
  }

  console.log("[CALENDAR EVENTS] Query where:", JSON.stringify(where, null, 2))

  const dbEvents = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: { callNote: { select: { id: true, title: true } } },
    ...(limit ? { take: parseInt(limit, 10) } : {}),
  })

  console.log(`[CALENDAR EVENTS] Found ${dbEvents.length} events`)

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
