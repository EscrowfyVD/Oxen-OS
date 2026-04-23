import { prisma } from "@/lib/prisma"
import { logger, serializeError } from "@/lib/logger"

const log = logger.child({ component: "google-calendar" })

export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
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

    if (!response.ok) {
      log.error({ status: response.status, body: await response.text() }, "token refresh failed")
      return null
    }

    const data = await response.json()
    return data.access_token ?? null
  } catch (error) {
    log.error({ err: serializeError(error) }, "token refresh error")
    return null
  }
}

/**
 * Get a valid access token for a user by email.
 * Refreshes if expired.
 */
export async function getAccessTokenForUser(userEmail: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: {
      provider: "google",
      user: { email: userEmail },
    },
    select: { id: true, access_token: true, refresh_token: true, expires_at: true },
  })

  if (!account) return null

  const now = Math.floor(Date.now() / 1000)
  if (account.access_token && account.expires_at && account.expires_at > now + 60) {
    return account.access_token
  }

  if (!account.refresh_token) return null
  const newToken = await refreshAccessToken(account.refresh_token)

  // Persist the refreshed token so subsequent calls use it
  if (newToken) {
    try {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: newToken,
          expires_at: Math.floor(Date.now() / 1000) + 3600, // Google tokens last ~1 hour
        },
      })
    } catch (e) {
      log.error({ err: serializeError(e) }, "failed to persist refreshed token")
    }
  }

  return newToken
}

interface GoogleEventData {
  title: string
  description?: string | null
  startTime: string
  endTime: string
  location?: string | null
  attendees?: string[]
}

/**
 * Create an event on the user's primary Google Calendar.
 * Returns the Google event ID, or null on failure.
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: GoogleEventData
): Promise<string | null> {
  try {
    const body: Record<string, unknown> = {
      summary: event.title,
      description: event.description ?? undefined,
      start: { dateTime: event.startTime, timeZone: "Europe/Amsterdam" },
      end: { dateTime: event.endTime, timeZone: "Europe/Amsterdam" },
      location: event.location ?? undefined,
    }
    if (event.attendees?.length) {
      body.attendees = event.attendees.map((email) => ({ email }))
    }

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      log.error({ status: res.status, body: await res.text() }, "create event failed")
      return null
    }

    const data = await res.json()
    return data.id ?? null
  } catch (err) {
    log.error({ err: serializeError(err) }, "create event error")
    return null
  }
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string,
  event: GoogleEventData
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      summary: event.title,
      description: event.description ?? undefined,
      start: { dateTime: event.startTime, timeZone: "Europe/Amsterdam" },
      end: { dateTime: event.endTime, timeZone: "Europe/Amsterdam" },
      location: event.location ?? undefined,
    }
    if (event.attendees?.length) {
      body.attendees = event.attendees.map((email) => ({ email }))
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      log.error({ status: res.status, body: await res.text() }, "update event failed")
      return false
    }

    return true
  } catch (err) {
    log.error({ err: serializeError(err) }, "update event error")
    return false
  }
}

/**
 * Delete an event from Google Calendar.
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!res.ok && res.status !== 410) {
      log.error({ status: res.status, body: await res.text() }, "delete event failed")
      return false
    }

    return true
  } catch (err) {
    log.error({ err: serializeError(err) }, "delete event error")
    return false
  }
}
