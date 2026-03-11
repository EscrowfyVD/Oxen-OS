import { prisma } from "./prisma"

interface GoogleEvent {
  id: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: Array<{ email: string }>
  location?: string
  hangoutLink?: string
}

interface GoogleCalendarResponse {
  items?: GoogleEvent[]
}

export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) return null
  const data = await response.json()
  return data.access_token ?? null
}

export async function syncCalendarEvents(userId: string, userEmail: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  })

  if (!account?.access_token) {
    throw new Error("No Google account linked")
  }

  let accessToken = account.access_token

  // Try refreshing the token
  if (account.refresh_token) {
    const newToken = await refreshAccessToken(account.refresh_token)
    if (newToken) {
      accessToken = newToken
      await prisma.account.update({
        where: { id: account.id },
        data: { access_token: newToken },
      })
    }
  }

  const now = new Date()
  const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Google Calendar API error: ${response.status}`)
  }

  const data: GoogleCalendarResponse = await response.json()
  const events = data.items ?? []

  let synced = 0
  for (const event of events) {
    if (!event.id || !event.summary) continue

    const startTime = event.start?.dateTime ?? event.start?.date
    const endTime = event.end?.dateTime ?? event.end?.date
    if (!startTime || !endTime) continue

    await prisma.calendarEvent.upsert({
      where: { googleEventId: event.id },
      update: {
        title: event.summary,
        description: event.description ?? null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        attendees: event.attendees?.map((a) => a.email) ?? [],
        location: event.location ?? null,
        meetLink: event.hangoutLink ?? null,
      },
      create: {
        googleEventId: event.id,
        title: event.summary,
        description: event.description ?? null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        attendees: event.attendees?.map((a) => a.email) ?? [],
        calendarOwner: userEmail,
        location: event.location ?? null,
        meetLink: event.hangoutLink ?? null,
      },
    })
    synced++
  }

  return { synced }
}
