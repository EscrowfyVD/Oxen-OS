/**
 * Sync Worker — processes email/calendar sync jobs
 *
 * Handles: sync:email, sync:calendar
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const WORKER_ID = `sync-worker-${process.pid}`
const POLL_INTERVAL = parseInt(process.env.SYNC_POLL_INTERVAL_MS || "10000", 10)
const STALE_TIMEOUT = parseInt(process.env.STALE_JOB_TIMEOUT_MS || "300000", 10)

const SYNC_JOB_TYPES = ["sync:email", "sync:calendar"]

// ─── Job Claiming ───

async function claimNextJob() {
  const jobs = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "Job"
    SET "status" = 'processing',
        "processedBy" = ${WORKER_ID},
        "startedAt" = NOW(),
        "attempts" = "attempts" + 1,
        "updatedAt" = NOW()
    WHERE "id" = (
      SELECT "id" FROM "Job"
      WHERE "status" = 'pending'
        AND "type" = ANY(${SYNC_JOB_TYPES}::text[])
        AND "attempts" < "maxAttempts"
      ORDER BY "priority" DESC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"
  `

  if (!jobs || jobs.length === 0) return null
  return prisma.job.findUnique({ where: { id: jobs[0].id } })
}

async function completeJob(jobId: string, result: Record<string, unknown>) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "completed", result, completedAt: new Date() },
  })
}

async function failJob(jobId: string, error: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } })
  if (!job) return
  const newStatus = job.attempts >= job.maxAttempts ? "failed" : "pending"
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: newStatus,
      error,
      processedBy: newStatus === "pending" ? null : job.processedBy,
      startedAt: newStatus === "pending" ? null : job.startedAt,
    },
  })
}

// ─── Token Management ───

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.access_token || null
  } catch {
    return null
  }
}

async function getAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  })

  if (!account) return null

  let accessToken = account.access_token
  const tokenExpired = account.expires_at ? account.expires_at * 1000 < Date.now() : true

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
    }
  }

  return accessToken
}

// ─── Email Sync Handler ───

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
  if (payload.body?.data) return decodeBase64Url(payload.body.data)
  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain")
    if (textPart?.body?.data) return decodeBase64Url(textPart.body.data)
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html")
    if (htmlPart?.body?.data) return decodeBase64Url(htmlPart.body.data)
  }
  return ""
}

async function handleEmailSync(payload: Record<string, unknown>) {
  const userId = payload.userId as string
  const userEmail = payload.userEmail as string

  const accessToken = await getAccessToken(userId)
  if (!accessToken) throw new Error("No valid access token for user")

  // List recent messages (last 14 days)
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
      new URLSearchParams({ q: "newer_than:14d", maxResults: "200" }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!listRes.ok) {
    throw new Error(`Gmail API error: ${listRes.status}`)
  }

  const listData = await listRes.json()
  const messageIds: Array<{ id: string; threadId: string }> = listData.messages ?? []

  let synced = 0
  let matched = 0

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

      const toList = to.split(",").map((e) => e.trim()).filter(Boolean)
      const ccList = cc ? cc.split(",").map((e) => e.trim()).filter(Boolean) : []

      const fromEmail = extractEmail(from)
      const direction = fromEmail.includes(userEmail?.split("@")[0] || "___") ? "outbound" : "inbound"

      const bodyText = extractBodyText(message.payload)
      const hasAttachment = message.payload.parts?.some(
        (p) => p.mimeType?.startsWith("application/") || p.mimeType?.startsWith("image/")
      ) ?? false

      const allEmails = [fromEmail, ...toList.map(extractEmail), ...ccList.map(extractEmail)]
        .filter((e) => !e.includes(userEmail?.split("@")[0] || "___"))

      let contactId: string | null = null
      for (const email of allEmails) {
        const contact = await prisma.crmContact.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true },
        })
        if (contact) {
          contactId = contact.id
          matched++
          break
        }
      }

      await prisma.email.upsert({
        where: { gmailId: message.id },
        update: {
          contactId, subject,
          snippet: message.snippet || null,
          bodyText: bodyText.substring(0, 10000) || null,
          date, labelIds: message.labelIds || [],
          hasAttachment, direction,
        },
        create: {
          gmailId: message.id,
          threadId: message.threadId || null,
          from, to: toList, cc: ccList, subject,
          snippet: message.snippet || null,
          bodyText: bodyText.substring(0, 10000) || null,
          date, labelIds: message.labelIds || [],
          hasAttachment, direction,
          contactId, syncedBy: userEmail,
        },
      })
      synced++
    }
  }

  return { synced, matched }
}

// ─── Calendar Sync Handler (placeholder) ───

async function handleCalendarSync(payload: Record<string, unknown>) {
  console.log(`[${WORKER_ID}] Calendar sync job received`, payload)
  return { status: "not_implemented_yet" }
}

// ─── Main Loop ───

async function processJob(job: { id: string; type: string; payload: unknown }) {
  const payload = job.payload as Record<string, unknown>

  switch (job.type) {
    case "sync:email":
      return handleEmailSync(payload)
    case "sync:calendar":
      return handleCalendarSync(payload)
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}

async function resetStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_TIMEOUT)
  const result = await prisma.job.updateMany({
    where: { status: "processing", startedAt: { lt: cutoff } },
    data: { status: "pending", processedBy: null, startedAt: null },
  })
  if (result.count > 0) {
    console.log(`[${WORKER_ID}] Reset ${result.count} stale jobs`)
  }
}

let running = true

async function poll() {
  while (running) {
    try {
      await resetStaleJobs()

      const job = await claimNextJob()
      if (job) {
        console.log(`[${WORKER_ID}] Processing job ${job.id} (${job.type}) attempt ${job.attempts}`)
        try {
          const result = await processJob(job)
          await completeJob(job.id, result || {})
          console.log(`[${WORKER_ID}] Completed job ${job.id}`)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          console.error(`[${WORKER_ID}] Failed job ${job.id}: ${errorMessage}`)
          await failJob(job.id, errorMessage)
        }
      }
    } catch (err) {
      console.error(`[${WORKER_ID}] Poll error:`, err)
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
  }
}

process.on("SIGINT", () => { console.log(`[${WORKER_ID}] Shutting down...`); running = false })
process.on("SIGTERM", () => { console.log(`[${WORKER_ID}] Shutting down...`); running = false })

console.log(`[${WORKER_ID}] Starting Sync Worker (poll every ${POLL_INTERVAL}ms)`)
poll().then(() => {
  console.log(`[${WORKER_ID}] Worker stopped`)
  prisma.$disconnect()
})
