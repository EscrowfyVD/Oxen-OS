import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { refreshAccessToken } from "@/lib/google-calendar"

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
  nextPageToken?: string
}

// Fetch ALL calendar events with pagination (Google limits to 250 per page)
async function fetchAllCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<{ events: GoogleCalendarEvent[]; error?: string; status?: number }> {
  const allEvents: GoogleCalendarEvent[] = []
  let pageToken: string | undefined

  for (let page = 0; page < 10; page++) {
    const params: Record<string, string> = {
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    }
    if (pageToken) params.pageToken = pageToken

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams(params),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!res.ok) {
      const errorBody = await res.text()
      return { events: allEvents, error: errorBody, status: res.status }
    }

    const data: GoogleCalendarResponse = await res.json()
    if (data.items) allEvents.push(...data.items)

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }

  return { events: allEvents }
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const userEmail = session.user.email ?? userId

  // Look up the user's Google account for stored tokens
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  })

  if (!account) {
    return NextResponse.json(
      { error: "No Google account linked. Please sign out and sign in again." },
      { status: 400 }
    )
  }

  if (!account.access_token && !account.refresh_token) {
    return NextResponse.json(
      { error: "No tokens stored. Please sign out and sign in again to grant calendar access." },
      { status: 400 }
    )
  }

  let accessToken = account.access_token

  // Calculate time range: 1 month ago to 3 months ahead
  const now = new Date()
  const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

  // Check if token is likely expired (expires_at is seconds since epoch)
  const tokenExpired = account.expires_at
    ? account.expires_at * 1000 < Date.now()
    : true // If no expires_at, assume expired and refresh

  // Refresh the token if expired or if we don't have an access_token
  if ((tokenExpired || !accessToken) && account.refresh_token) {
    const newToken = await refreshAccessToken(account.refresh_token)
    if (newToken) {
      accessToken = newToken
      await prisma.account.update({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } },
        data: {
          access_token: newToken,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      })
    } else {
      return NextResponse.json(
        { error: "Failed to refresh Google token. Please sign out and sign in again." },
        { status: 401 }
      )
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "No valid access token. Please sign out and sign in again." },
      { status: 401 }
    )
  }

  // Fetch events with pagination
  let result = await fetchAllCalendarEvents(accessToken, timeMin, timeMax)

  // If 401, try refreshing the token one more time
  if (result.status === 401 && account.refresh_token) {
    const newToken = await refreshAccessToken(account.refresh_token)
    if (newToken) {
      accessToken = newToken
      await prisma.account.update({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } },
        data: {
          access_token: newToken,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      })
      result = await fetchAllCalendarEvents(accessToken, timeMin, timeMax)
    }
  }

  if (result.error && result.events.length === 0) {
    console.error("Google Calendar API error:", result.status, result.error)
    return NextResponse.json(
      { error: "Failed to fetch Google Calendar events", status: result.status, details: result.error },
      { status: 502 }
    )
  }

  const events = result.events

  let synced = 0
  for (const event of events) {
    if (!event.id || !event.start) continue

    const startTime = event.start.dateTime ?? event.start.date
    const endTime = event.end?.dateTime ?? event.end?.date
    if (!startTime || !endTime) continue

    // Normalize emails to lowercase for consistent matching
    const normalizedOwner = userEmail.toLowerCase()
    const normalizedAttendees = event.attendees?.map((a) => a.email.toLowerCase()) ?? []

    await prisma.calendarEvent.upsert({
      where: {
        googleEventId_calendarOwner: {
          googleEventId: event.id,
          calendarOwner: normalizedOwner,
        },
      },
      update: {
        title: event.summary ?? "Untitled",
        description: event.description ?? null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        attendees: normalizedAttendees,
        location: event.location ?? null,
        meetLink: event.hangoutLink ?? null,
      },
      create: {
        googleEventId: event.id,
        title: event.summary ?? "Untitled",
        description: event.description ?? null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        attendees: normalizedAttendees,
        calendarOwner: normalizedOwner,
        location: event.location ?? null,
        meetLink: event.hangoutLink ?? null,
      },
    })
    synced++
  }

  return NextResponse.json({ success: true, synced })
}
