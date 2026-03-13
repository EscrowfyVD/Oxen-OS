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
  error?: { message: string; code: number }
}

async function fetchCalendarEvents(accessToken: string, timeMin: string, timeMax: string) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      }),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  return { response: res, status: res.status }
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
          expires_at: Math.floor(Date.now() / 1000) + 3600, // Google tokens last 1 hour
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

  // Fetch events from Google Calendar API
  let { response, status } = await fetchCalendarEvents(accessToken, timeMin, timeMax)

  // If 401, try refreshing the token one more time
  if (status === 401 && account.refresh_token) {
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
      const retry = await fetchCalendarEvents(accessToken, timeMin, timeMax)
      response = retry.response
      status = retry.status
    }
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Google Calendar API error:", status, errorText)
    return NextResponse.json(
      { error: "Failed to fetch Google Calendar events", status, details: errorText },
      { status: 502 }
    )
  }

  const calendarData: GoogleCalendarResponse = await response.json()
  const events = calendarData.items ?? []

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
