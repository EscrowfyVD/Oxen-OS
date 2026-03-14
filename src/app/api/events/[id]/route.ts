import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserRole } from "@/lib/admin"
import { logActivity } from "@/lib/activity"
import { getAccessTokenForUser, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from "@/lib/google-calendar"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session } = await getUserRole()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Try internal event first
  const internal = await prisma.internalEvent.findUnique({
    where: { id },
    include: { callNote: { select: { id: true, title: true } } },
  })
  if (internal) {
    return NextResponse.json({
      event: {
        id: internal.id,
        title: internal.title,
        description: internal.description,
        start: internal.startTime.toISOString(),
        end: internal.endTime.toISOString(),
        attendees: internal.attendees,
        location: internal.location,
        meetLink: internal.meetLink,
        calendarOwner: internal.createdBy,
        callNoteId: internal.callNote?.id ?? null,
        source: "internal",
        type: internal.type,
        color: internal.color,
        recurring: internal.recurring,
        googleEventId: internal.googleEventId,
      },
    })
  }

  // Try Google event
  const google = await prisma.calendarEvent.findUnique({
    where: { id },
    include: { callNote: { select: { id: true, title: true } } },
  })
  if (google) {
    return NextResponse.json({
      event: {
        id: google.id,
        title: google.title,
        description: google.description,
        start: google.startTime.toISOString(),
        end: google.endTime.toISOString(),
        attendees: google.attendees,
        location: google.location,
        meetLink: google.meetLink,
        calendarOwner: google.calendarOwner,
        callNoteId: google.callNote?.id ?? null,
        source: "google",
        type: "google_synced",
        color: "rgba(255,255,255,0.15)",
        recurring: null,
        googleEventId: google.googleEventId,
      },
    })
  }

  return NextResponse.json({ error: "Event not found" }, { status: 404 })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session } = await getUserRole()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const existing = await prisma.internalEvent.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Only internal events can be edited" }, { status: 400 })
  }

  const { title, description, startTime, endTime, location, meetLink, attendees, color, type, recurring, recurringUntil } = body

  const updated = await prisma.internalEvent.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(startTime !== undefined && { startTime: new Date(startTime) }),
      ...(endTime !== undefined && { endTime: new Date(endTime) }),
      ...(location !== undefined && { location }),
      ...(meetLink !== undefined && { meetLink }),
      ...(attendees !== undefined && { attendees }),
      ...(color !== undefined && { color }),
      ...(type !== undefined && { type }),
      ...(recurring !== undefined && { recurring }),
      ...(recurringUntil !== undefined && { recurringUntil: recurringUntil ? new Date(recurringUntil) : null }),
    },
  })

  // Sync update to Google Calendar
  let syncWarning: string | null = null
  if (updated.googleEventId) {
    try {
      const userEmail = session.user.email ?? ""
      const accessToken = await getAccessTokenForUser(userEmail)
      if (accessToken) {
        const ok = await updateGoogleCalendarEvent(accessToken, updated.googleEventId, {
          title: updated.title,
          description: updated.description,
          startTime: updated.startTime.toISOString(),
          endTime: updated.endTime.toISOString(),
          location: updated.location,
          attendees: updated.attendees,
        })
        if (!ok) syncWarning = "Event updated locally but Google Calendar sync failed"
      }
    } catch {
      syncWarning = "Event updated locally but Google Calendar sync failed"
    }
  }

  logActivity("meeting_updated", `Meeting updated — ${updated.title}`, session.user.email ?? "unknown", updated.id, "/calendar")

  return NextResponse.json({
    event: {
      ...updated,
      start: updated.startTime.toISOString(),
      end: updated.endTime.toISOString(),
      source: "internal",
    },
    syncWarning,
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session } = await getUserRole()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.internalEvent.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Only internal events can be deleted" }, { status: 400 })
  }

  // Delete linked call note if any
  await prisma.callNote.deleteMany({ where: { internalEventId: id } })

  // Sync deletion to Google Calendar
  let syncWarning: string | null = null
  if (existing.googleEventId) {
    try {
      const userEmail = session.user.email ?? ""
      const accessToken = await getAccessTokenForUser(userEmail)
      if (accessToken) {
        const ok = await deleteGoogleCalendarEvent(accessToken, existing.googleEventId)
        if (!ok) syncWarning = "Event deleted locally but Google Calendar removal failed"
      }
    } catch {
      syncWarning = "Event deleted locally but Google Calendar removal failed"
    }
  }

  await prisma.internalEvent.delete({ where: { id } })

  logActivity("meeting_deleted", `Meeting deleted — ${existing.title}`, session.user.email ?? "unknown", id, "/calendar")

  return NextResponse.json({ success: true, syncWarning })
}
