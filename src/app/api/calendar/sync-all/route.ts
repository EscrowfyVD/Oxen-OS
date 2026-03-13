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

async function syncUserCalendar(
  account: { userId: string; providerAccountId: string; access_token: string | null; refresh_token: string | null; expires_at: number | null },
  userEmail: string
): Promise<{ synced: number; error?: string }> {
  console.log(`[SYNC] Starting sync for ${userEmail}`)
  console.log(`[SYNC] Has access_token: ${!!account.access_token}, Has refresh_token: ${!!account.refresh_token}, expires_at: ${account.expires_at}`)
  let accessToken = account.access_token

  // Check if token is expired
  const tokenExpired = account.expires_at
    ? account.expires_at * 1000 < Date.now()
    : true

  console.log(`[SYNC] Token expired: ${tokenExpired}`)

  // Refresh if needed
  if ((tokenExpired || !accessToken) && account.refresh_token) {
    console.log(`[SYNC] Refreshing token for ${userEmail}`)
    const newToken = await refreshAccessToken(account.refresh_token)
    if (newToken) {
      accessToken = newToken
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: newToken,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      })
      console.log(`[SYNC] Token refreshed successfully for ${userEmail}`)
    } else {
      console.error(`[SYNC] Token refresh FAILED for ${userEmail}`)
      return { synced: 0, error: `Token refresh failed for ${userEmail}. Please sign out and sign in again.` }
    }
  }

  if (!accessToken) {
    console.error(`[SYNC] No valid token for ${userEmail}`)
    return { synced: 0, error: `No valid token for ${userEmail}. Please sign out and sign in again.` }
  }

  const now = new Date()
  const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

  let { response, status } = await fetchCalendarEvents(accessToken, timeMin, timeMax)

  // Retry on 401
  if (status === 401 && account.refresh_token) {
    const newToken = await refreshAccessToken(account.refresh_token)
    if (newToken) {
      accessToken = newToken
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
        },
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
    const errorBody = await response.text()
    console.error(`[SYNC] Google API error ${status} for ${userEmail}:`, errorBody)
    return { synced: 0, error: `Google API error ${status} for ${userEmail}. Try signing out and back in.` }
  }

  const calendarData: GoogleCalendarResponse = await response.json()
  const events = calendarData.items ?? []
  console.log(`[SYNC] Got ${events.length} events from Google for ${userEmail}`)

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

  console.log(`[SYNC] Synced ${synced} events for ${userEmail}`)
  return { synced }
}

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find all users with Google accounts
  const accounts = await prisma.account.findMany({
    where: { provider: "google" },
    include: { user: { select: { email: true } } },
  })

  const results: { email: string; synced: number; error?: string }[] = []

  for (const account of accounts) {
    const email = account.user.email ?? account.userId
    const result = await syncUserCalendar(
      {
        userId: account.userId,
        providerAccountId: account.providerAccountId,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
      },
      email
    )
    results.push({ email, ...result })
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
  const errors = results.filter((r) => r.error)

  return NextResponse.json({
    success: true,
    synced: totalSynced,
    users: results.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
