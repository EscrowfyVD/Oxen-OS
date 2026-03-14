import { prisma } from "@/lib/prisma"

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
      console.error("Token refresh failed:", response.status, await response.text())
      return null
    }

    const data = await response.json()
    return data.access_token ?? null
  } catch (error) {
    console.error("Token refresh error:", error)
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
    select: { access_token: true, refresh_token: true, expires_at: true },
  })

  if (!account) return null

  const now = Math.floor(Date.now() / 1000)
  if (account.access_token && account.expires_at && account.expires_at > now + 60) {
    return account.access_token
  }

  if (!account.refresh_token) return null
  return refreshAccessToken(account.refresh_token)
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
      console.error("[GoogleCal] Create failed:", res.status, await res.text())
      return null
    }

    const data = await res.json()
    return data.id ?? null
  } catch (err) {
    console.error("[GoogleCal] Create error:", err)
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
      console.error("[GoogleCal] Update failed:", res.status, await res.text())
      return false
    }

    return true
  } catch (err) {
    console.error("[GoogleCal] Update error:", err)
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
      console.error("[GoogleCal] Delete failed:", res.status, await res.text())
      return false
    }

    return true
  } catch (err) {
    console.error("[GoogleCal] Delete error:", err)
    return false
  }
}
