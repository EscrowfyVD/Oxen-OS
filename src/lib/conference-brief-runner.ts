// Orchestration for the monthly Conference Brief — fetches the data,
// formats the message, fans out to recipients via Telegram. Shared
// between the HTTP route handler (`/api/cron/conference-brief`) and
// the standalone CLI script (`scripts/cron/send-conference-brief.ts`)
// so both invocation paths run identical logic.
//
// Pure DB + Telegram wrapper — no auth, no HTTP, no logging side
// effects beyond the structured stats it returns. Callers handle
// auth, HTTP response mapping, and audit logging.
//
// Refs: PRD-001 v3.7, Sprint Conference Brief.

import type { PrismaClient } from "@prisma/client"
import { sendTelegramMessage } from "@/lib/telegram"
import {
  formatConferenceBriefHTML,
  getCurrentMonthRange,
  type ConferenceBriefEntry,
} from "@/lib/conference-brief"

// V1 recipients (per Vernon's spec) — hardcoded by email so the brief
// can run before any UI for "manage recipients" exists. Configurable
// later (Andy brief: "configurable later"). The runner only sends to
// recipients whose email matches AND who have a non-null
// telegramChatId. Missing recipients are reported in the result so
// the operator can fix env / Employee.telegramChatId on Railway.
export const DEFAULT_RECIPIENT_EMAILS = [
  "ad@oxen.finance", // Andy Dessy
  "pg@oxen.finance", // Paul Garreau (a.k.a. "Paul Louis" internally)
  "vd@oxen.finance", // Vernon Dessy
] as const

// ─────────────────────────────────────────────────────────────────────
// Result shape — same for HTTP route + CLI script consumption.
// ─────────────────────────────────────────────────────────────────────
export interface ConferenceBriefRunResult {
  success: boolean
  monthName: string
  conferenceCount: number
  recipientCount: number
  delivered: number
  failed: number
  /**
   * Emails listed in `recipientEmails` that either don't exist in
   * the Employee table OR exist but have no telegramChatId. These
   * are silently skipped during fan-out — surfaced here so the
   * operator can investigate (run team page sync, ask the user to
   * register their bot chat, etc.).
   */
  missingRecipients: string[]
  /**
   * Per-delivery breakdown for ops triage. `error` is set when
   * `sendTelegramMessage` returns ok=false.
   */
  deliveries: Array<{
    email: string
    name: string
    status: "delivered" | "failed"
    error?: string
  }>
}

interface RunOpts {
  /**
   * Optional override of the recipient email list. Defaults to
   * DEFAULT_RECIPIENT_EMAILS. Useful for tests + future "test send
   * to a single user" UI button.
   */
  recipientEmails?: readonly string[]
  /**
   * Optional override of "now" — drives the `getCurrentMonthRange`
   * computation. Defaults to `new Date()` at call time. Tests pin
   * this to deterministic values; the cron leaves it default.
   */
  now?: Date
}

/**
 * Run the conference brief end-to-end.
 *
 * 1. Compute the [monthStart, monthEnd) range from `now`.
 * 2. Fetch conferences whose `startDate` falls in that range,
 *    excluding `cancelled` and `rejected` statuses (a planned
 *    conference should still appear; a completed one in the same
 *    month is fine — it's a recap signal).
 * 3. Fetch the recipients by email + filter to those with a
 *    `telegramChatId` set. Track the missing set for the result.
 * 4. Format the brief HTML once.
 * 5. Fan out: `sendTelegramMessage` per recipient, isolated
 *    failures (one bad chat ID doesn't block the others).
 *
 * Always returns a result object. Throws only on unexpected DB
 * errors — Telegram delivery errors are aggregated into the result
 * (so a bad chat ID for one user doesn't kill the whole job).
 */
export async function runConferenceBrief(
  prisma: PrismaClient,
  opts: RunOpts = {},
): Promise<ConferenceBriefRunResult> {
  const recipientEmails = opts.recipientEmails ?? DEFAULT_RECIPIENT_EMAILS
  const now = opts.now ?? new Date()

  const { monthStart, monthEnd, monthName } = getCurrentMonthRange(now)

  // Step 1 — fetch conferences in the [monthStart, monthEnd) window.
  // Exclude cancelled / rejected (those shouldn't show in a brief
  // even if their startDate happens to be this month).
  const conferences = (await prisma.conference.findMany({
    where: {
      startDate: { gte: monthStart, lt: monthEnd },
      status: { notIn: ["cancelled", "rejected"] },
    },
    orderBy: { startDate: "asc" },
    select: {
      name: true,
      location: true,
      country: true,
      startDate: true,
      endDate: true,
      description: true,
      website: true,
    },
  })) as ConferenceBriefEntry[]

  // Step 2 — recipient lookup. Lowercase the input emails for
  // case-insensitive match against Employee.email (which is unique
  // but could be stored with mixed case).
  // NB: Employee.email is nullable in the schema, so the result rows
  // include `email: string | null`. We filter to non-null below; in
  // practice the `where: { email: { in: ... } }` clause already
  // excludes null rows, but TypeScript can't prove that.
  const lowerEmails = recipientEmails.map((e) => e.toLowerCase())
  const employeesRaw = await prisma.employee.findMany({
    where: {
      email: { in: lowerEmails, mode: "insensitive" },
    },
    select: { email: true, name: true, telegramChatId: true },
  })
  const employees = employeesRaw.filter(
    (e): e is typeof e & { email: string } => e.email !== null,
  )

  // Build the missing set: every requested email that either isn't
  // in `employees` OR has a null telegramChatId.
  const matchedByEmail = new Map(
    employees.map((e) => [e.email.toLowerCase(), e] as const),
  )
  const missingRecipients: string[] = []
  const deliverable: Array<{ email: string; name: string; chatId: string }> = []
  for (const email of recipientEmails) {
    const emp = matchedByEmail.get(email.toLowerCase())
    if (!emp || !emp.telegramChatId) {
      missingRecipients.push(email)
      continue
    }
    deliverable.push({
      email: emp.email,
      name: emp.name,
      chatId: emp.telegramChatId,
    })
  }

  // Step 3 — format the brief once.
  const html = formatConferenceBriefHTML({ monthName, conferences })

  // Step 4 — fan out, isolating per-recipient failures.
  const deliveries: ConferenceBriefRunResult["deliveries"] = []
  let delivered = 0
  let failed = 0
  for (const r of deliverable) {
    const result = await sendTelegramMessage(r.chatId, html, "HTML")
    if (result.ok) {
      delivered++
      deliveries.push({ email: r.email, name: r.name, status: "delivered" })
    } else {
      failed++
      deliveries.push({
        email: r.email,
        name: r.name,
        status: "failed",
        error: result.description ?? "Telegram delivery failed",
      })
    }
  }

  return {
    // Convention: success=true even if some deliveries failed, as
    // long as the run reached the fan-out step. Fully empty
    // recipient list (e.g. all 3 emails missing) still counts as
    // success — the cron ran, it just had nothing to send. Callers
    // who want stricter semantics can check `failed > 0` or
    // `missingRecipients.length > 0`.
    success: true,
    monthName,
    conferenceCount: conferences.length,
    recipientCount: deliverable.length,
    delivered,
    failed,
    missingRecipients,
    deliveries,
  }
}
