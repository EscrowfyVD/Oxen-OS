import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { refreshAccessToken } from "@/lib/google-calendar"

interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
    parts?: Array<{ mimeType: string; body?: { data?: string } }>
    body?: { data?: string }
    mimeType?: string
  }
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ""
}

function extractEmail(str: string): string {
  const match = str.match(/<([^>]+)>/)
  return match ? match[1].toLowerCase() : str.toLowerCase().trim()
}

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
    return Buffer.from(base64, "base64").toString("utf-8")
  } catch {
    return ""
  }
}

function extractBodyText(payload: GmailMessage["payload"]): string {
  if (!payload) return ""

  // Simple message (no parts)
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Multipart message
  if (payload.parts) {
    // Prefer text/plain
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain")
    if (textPart?.body?.data) return decodeBase64Url(textPart.body.data)

    // Fallback to text/html
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html")
    if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data)
  }

  return ""
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const userEmail = session.user.email ?? userId

  // Get Google account tokens
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
      { error: "No tokens stored. Please sign out and sign in again to grant Gmail access." },
      { status: 400 }
    )
  }

  let accessToken = account.access_token

  // Refresh token if expired
  const tokenExpired = account.expires_at
    ? account.expires_at * 1000 < Date.now()
    : true

  if ((tokenExpired || !accessToken) && account.refresh_token) {
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
    } else {
      return NextResponse.json(
        { error: "Failed to refresh Google token. Please sign out and sign in again." },
        { status: 401 }
      )
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "No valid access token." },
      { status: 401 }
    )
  }

  try {
    // List recent messages (last 14 days)
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
        new URLSearchParams({
          q: "newer_than:14d",
          maxResults: "200",
        }),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!listRes.ok) {
      // Try token refresh on 401
      if (listRes.status === 401 && account.refresh_token) {
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
            data: { access_token: newToken, expires_at: Math.floor(Date.now() / 1000) + 3600 },
          })
        }
      }
      const errorText = await listRes.text()
      console.error("Gmail API list error:", listRes.status, errorText)
      return NextResponse.json(
        { error: "Failed to fetch Gmail messages. Gmail scope may not be granted.", details: errorText },
        { status: 502 }
      )
    }

    const listData: GmailListResponse = await listRes.json()
    const messageIds = listData.messages ?? []

    let synced = 0
    let matched = 0

    // Fetch each message in batches of 10
    for (let i = 0; i < messageIds.length; i += 10) {
      const batch = messageIds.slice(i, i + 10)
      const results = await Promise.all(
        batch.map(async (msg) => {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          if (!res.ok) return null
          return res.json() as Promise<GmailMessage>
        })
      )

      for (const message of results) {
        if (!message?.id || !message.payload) continue

        const headers = message.payload.headers || []
        const from = getHeader(headers, "From")
        const to = getHeader(headers, "To")
        const cc = getHeader(headers, "Cc")
        const subject = getHeader(headers, "Subject") || "(no subject)"
        const dateStr = getHeader(headers, "Date")
        const date = dateStr ? new Date(dateStr) : new Date()

        // Parse To/Cc into arrays
        const toList = to.split(",").map((e) => e.trim()).filter(Boolean)
        const ccList = cc ? cc.split(",").map((e) => e.trim()).filter(Boolean) : []

        // Determine direction
        const fromEmail = extractEmail(from)
        const direction = fromEmail.includes(userEmail?.split("@")[0] || "___")
          ? "outbound"
          : "inbound"

        // Extract body text
        const bodyText = extractBodyText(message.payload)

        // Check for attachments
        const hasAttachment = message.payload.parts?.some(
          (p) => p.mimeType?.startsWith("application/") || p.mimeType?.startsWith("image/")
        ) ?? false

        // Match to contact by email
        const allEmails = [fromEmail, ...toList.map(extractEmail), ...ccList.map(extractEmail)]
          .filter((e) => !e.includes(userEmail?.split("@")[0] || "___"))

        let contactId: string | null = null
        for (const email of allEmails) {
          const contact = await prisma.contact.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
          })
          if (contact) {
            contactId = contact.id
            matched++
            break
          }
        }

        // Upsert email
        await prisma.email.upsert({
          where: { gmailId: message.id },
          update: {
            contactId,
            subject,
            snippet: message.snippet || null,
            bodyText: bodyText.substring(0, 10000) || null,
            date,
            labelIds: message.labelIds || [],
            hasAttachment,
            direction,
          },
          create: {
            gmailId: message.id,
            threadId: message.threadId || null,
            from,
            to: toList,
            cc: ccList,
            subject,
            snippet: message.snippet || null,
            bodyText: bodyText.substring(0, 10000) || null,
            date,
            labelIds: message.labelIds || [],
            hasAttachment,
            direction,
            contactId,
            syncedBy: userEmail,
          },
        })
        synced++
      }
    }

    return NextResponse.json({ success: true, synced, matched })
  } catch (error) {
    console.error("Email sync error:", error)
    return NextResponse.json({ error: "Email sync failed" }, { status: 500 })
  }
}
