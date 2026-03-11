import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: { email: string }[]
  location?: string
  hangoutLink?: string
}

interface GoogleCalendarResponse {
  items?: GoogleCalendarEvent[]
  error?: { message: string }
}

export async function POST() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user?.id
  if (!userId) {
    return NextResponse.json({ error: "User ID not found" }, { status: 400 })
  }

  // Look up the user's Google account to get the access_token
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
  })

  if (!account || !account.access_token) {
    return NextResponse.json(
      { error: "Google account not linked or access token missing" },
      { status: 400 }
    )
  }

  // Fetch events from Google Calendar API
  const now = new Date()
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString()

  const calendarResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      }),
    {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    }
  )

  if (!calendarResponse.ok) {
    const errorText = await calendarResponse.text()
    return NextResponse.json(
      { error: "Failed to fetch Google Calendar events", details: errorText },
      { status: 502 }
    )
  }

  const calendarData: GoogleCalendarResponse = await calendarResponse.json()
  const events = calendarData.items ?? []

  let synced = 0
  const calendarOwner = session.user?.email ?? userId

  for (const event of events) {
    if (!event.id || !event.start) continue

    const startTime = event.start.dateTime ?? event.start.date
    const endTime = event.end?.dateTime ?? event.end?.date

    if (!startTime || !endTime) continue

    await prisma.calendarEvent.upsert({
      where: { googleEventId: event.id },
      update: {
        title: event.summary ?? "Untitled",
        description: event.description ?? null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        attendees: event.attendees?.map((a) => a.email) ?? [],
        location: event.location ?? null,
        meetLink: event.hangoutLink ?? null,
      },
      create: {
        googleEventId: event.id,
        title: event.summary ?? "Untitled",
        description: event.description ?? null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        attendees: event.attendees?.map((a) => a.email) ?? [],
        calendarOwner,
        location: event.location ?? null,
        meetLink: event.hangoutLink ?? null,
      },
    })

    synced++
  }

  return NextResponse.json({ success: true, synced })
}
