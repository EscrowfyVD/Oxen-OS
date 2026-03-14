import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserRole } from "@/lib/admin"
import { canAccess } from "@/lib/permissions"
import { logActivity } from "@/lib/activity"
import { getAccessTokenForUser, createGoogleCalendarEvent } from "@/lib/google-calendar"

export async function GET(request: Request) {
  const { session, employee, roleLevel } = await getUserRole()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const start = searchParams.get("start")
  const end = searchParams.get("end")
  const owners = searchParams.get("owners")

  const userEmail = session.user.email?.toLowerCase() ?? ""
  const isAdmin = canAccess(roleLevel, "admin")
  const isManager = canAccess(roleLevel, "manager")

  // ── Google Calendar Events ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleWhere: any = {}
  if (start || end) {
    googleWhere.startTime = {}
    if (start) googleWhere.startTime.gte = new Date(start)
    if (end) googleWhere.startTime.lte = new Date(end)
  }
  if (owners) {
    const ownerList = owners.split(",").map((o) => o.trim().toLowerCase()).filter(Boolean)
    if (ownerList.length > 0) googleWhere.calendarOwner = { in: ownerList }
  }
  if (!isAdmin) {
    if (isManager && employee?.id) {
      const reportEmails = await prisma.employee.findMany({
        where: { managerId: employee.id },
        select: { email: true },
      })
      const teamEmails = [userEmail, ...reportEmails.map((r) => r.email?.toLowerCase()).filter(Boolean)] as string[]
      googleWhere.OR = [
        { calendarOwner: { in: teamEmails } },
        { attendees: { hasSome: teamEmails } },
      ]
    } else {
      googleWhere.OR = [
        { calendarOwner: { equals: userEmail, mode: "insensitive" } },
        { attendees: { has: userEmail } },
      ]
    }
  }

  // ── Internal Events ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internalWhere: any = {}
  if (start || end) {
    internalWhere.startTime = {}
    if (start) internalWhere.startTime.gte = new Date(start)
    if (end) internalWhere.startTime.lte = new Date(end)
  }
  if (!isAdmin) {
    if (isManager && employee?.id) {
      const reportEmails = await prisma.employee.findMany({
        where: { managerId: employee.id },
        select: { email: true },
      })
      const teamEmails = [userEmail, ...reportEmails.map((r) => r.email?.toLowerCase()).filter(Boolean)] as string[]
      internalWhere.OR = [
        { createdBy: { in: teamEmails } },
        { attendees: { hasSome: teamEmails } },
      ]
    } else {
      internalWhere.OR = [
        { createdBy: { equals: userEmail, mode: "insensitive" } },
        { attendees: { has: userEmail } },
      ]
    }
  }

  const [googleEvents, internalEvents] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: googleWhere,
      orderBy: { startTime: "asc" },
      include: { callNote: { select: { id: true, title: true } } },
    }),
    prisma.internalEvent.findMany({
      where: internalWhere,
      orderBy: { startTime: "asc" },
      include: { callNote: { select: { id: true, title: true } } },
    }),
  ])

  const events = [
    ...googleEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      start: e.startTime.toISOString(),
      end: e.endTime.toISOString(),
      attendees: e.attendees,
      location: e.location,
      meetLink: e.meetLink,
      calendarOwner: e.calendarOwner,
      callNoteId: e.callNote?.id ?? null,
      source: "google" as const,
      type: "google_synced",
      color: "rgba(255,255,255,0.15)",
      recurring: null,
      googleEventId: e.googleEventId,
    })),
    ...internalEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      start: e.startTime.toISOString(),
      end: e.endTime.toISOString(),
      attendees: e.attendees,
      location: e.location,
      meetLink: e.meetLink,
      calendarOwner: e.createdBy,
      callNoteId: e.callNote?.id ?? null,
      source: "internal" as const,
      type: e.type,
      color: e.color,
      recurring: e.recurring,
      googleEventId: e.googleEventId,
    })),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  return NextResponse.json({ events })
}

export async function POST(request: Request) {
  const { session } = await getUserRole()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, startTime, endTime, location, meetLink, attendees, color, type, recurring, recurringUntil } = body

  if (!title || !startTime || !endTime) {
    return NextResponse.json({ error: "Missing required fields: title, startTime, endTime" }, { status: 400 })
  }

  const userEmail = session.user.email ?? "unknown"

  const event = await prisma.internalEvent.create({
    data: {
      title,
      description: description ?? null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location: location ?? null,
      meetLink: meetLink ?? null,
      attendees: attendees ?? [],
      color: color ?? null,
      type: type ?? "meeting",
      recurring: recurring ?? null,
      recurringUntil: recurringUntil ? new Date(recurringUntil) : null,
      createdBy: userEmail,
    },
  })

  // Attempt Google Calendar sync
  let googleEventId: string | null = null
  let syncWarning: string | null = null
  try {
    const accessToken = await getAccessTokenForUser(userEmail)
    if (accessToken) {
      googleEventId = await createGoogleCalendarEvent(accessToken, {
        title,
        description,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        location,
        attendees,
      })
      if (googleEventId) {
        await prisma.internalEvent.update({
          where: { id: event.id },
          data: { googleEventId },
        })
      } else {
        syncWarning = "Event saved but failed to sync to Google Calendar"
      }
    } else {
      syncWarning = "Event saved but Google Calendar sync unavailable"
    }
  } catch {
    syncWarning = "Event saved but Google Calendar sync failed"
  }

  logActivity("meeting_created", `Meeting created — ${title}`, userEmail, event.id, "/calendar")

  return NextResponse.json({
    event: {
      ...event,
      start: event.startTime.toISOString(),
      end: event.endTime.toISOString(),
      source: "internal",
      googleEventId,
    },
    syncWarning,
  }, { status: 201 })
}
