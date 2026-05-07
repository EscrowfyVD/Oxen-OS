// Pure formatting + date math for the monthly Conference Brief
// (Sprint Conference Brief, scoped from Andy's
// `Monthly_Conference_Brief.docx`).
//
// No I/O — exports are testable against deterministic inputs. The
// orchestration (DB fetch, recipient lookup, Telegram fan-out) lives
// in `src/lib/conference-brief-runner.ts`.
//
// Refs: PRD-001 v3.7 §11.5 + Monthly_Conference_Brief.docx.

import { escHtml } from "@/lib/telegram"

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface ConferenceBriefRecipient {
  email: string
  name: string
  telegramChatId: string
}

export interface ConferenceBriefEntry {
  name: string
  location: string
  country: string | null
  startDate: Date
  endDate: Date | null
  description: string | null
  website: string | null
}

export interface ConferenceBriefData {
  monthName: string // e.g. "May 2026"
  conferences: ConferenceBriefEntry[]
}

// ─────────────────────────────────────────────────────────────────────
// Date math
// ─────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

/**
 * Compute the [start, end) range of the calendar month that contains
 * `now`. End is **exclusive** (i.e. it points at the first day of the
 * next month, midnight UTC) so callers can use it directly as a
 * `Prisma.where.startDate.lt` upper bound without off-by-one risk.
 *
 * Anchored on UTC midnight on purpose — Conference dates in the DB
 * are stored as `DateTime` at `T00:00:00.000Z` (verified via the
 * audit on 5 sampled rows: SiGMA Europe, MEBAA Show, etc.). Mixing
 * local-time anchors here would risk shifting the month boundary by
 * 24h depending on the server's TZ.
 *
 * `monthName` is the human label `"May 2026"` used in the brief
 * heading.
 */
export function getCurrentMonthRange(now: Date = new Date()): {
  monthStart: Date
  monthEnd: Date
  monthName: string
} {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-indexed
  const monthStart = new Date(Date.UTC(year, month, 1))
  // Date.UTC handles month rollover automatically for month=12 → next year.
  const monthEnd = new Date(Date.UTC(year, month + 1, 1))
  const monthName = `${MONTH_NAMES[month]} ${year}`
  return { monthStart, monthEnd, monthName }
}

/**
 * Format a conference date range for display in the brief.
 *
 * Examples (UTC dates):
 *   - same day or no endDate  → "May 5"
 *   - same month              → "May 5-7"
 *   - cross-month              → "May 28 - Jun 2"
 *   - cross-year               → "Dec 30 - Jan 2" (no year shown
 *                                 since the brief heading already
 *                                 says the month/year context)
 *
 * Day numbers are not padded (no leading zero).
 */
export function formatDateRange(
  startDate: Date,
  endDate: Date | null,
): string {
  const sm = MONTH_NAMES[startDate.getUTCMonth()].slice(0, 3)
  const sd = startDate.getUTCDate()

  if (!endDate) return `${sm} ${sd}`

  const em = MONTH_NAMES[endDate.getUTCMonth()].slice(0, 3)
  const ed = endDate.getUTCDate()
  const sameDay =
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth() &&
    sd === ed
  if (sameDay) return `${sm} ${sd}`

  const sameMonth =
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth()
  if (sameMonth) return `${sm} ${sd}-${ed}`

  // Cross-month (or cross-year)
  return `${sm} ${sd} - ${em} ${ed}`
}

// ─────────────────────────────────────────────────────────────────────
// HTML rendering for Telegram (parse_mode=HTML)
// ─────────────────────────────────────────────────────────────────────

/**
 * Render the brief as an HTML string suitable for Telegram
 * `parse_mode: "HTML"`. Each user-supplied field (name, location,
 * description, etc.) is escaped via `escHtml` so that names containing
 * `<`, `&`, `"` don't break the markup.
 *
 * Layout per conference (in order):
 *   1. <b>Name</b>
 *   2. Location[, Country] — Date range
 *   3. Description sentence (skipped entirely if null)
 *   4. blank line separator
 *
 * Empty month falls back to a single line "No conferences listed for
 * this month." so the operator team still gets a Telegram ping
 * confirming the cron ran.
 */
export function formatConferenceBriefHTML(
  data: ConferenceBriefData,
): string {
  const heading = `<b>Conferences — ${escHtml(data.monthName)}</b>`

  if (data.conferences.length === 0) {
    return `${heading}\n\nNo conferences listed for this month.`
  }

  const blocks: string[] = []
  for (const c of data.conferences) {
    const nameLine = `<b>${escHtml(c.name)}</b>`

    const locationParts = [c.location, c.country].filter(
      (p): p is string => p != null && p.trim().length > 0,
    )
    const locationStr = locationParts.map((p) => escHtml(p)).join(", ")
    const dateStr = formatDateRange(c.startDate, c.endDate)
    const locDateLine = `${locationStr} — ${dateStr}`

    const lines = [nameLine, locDateLine]
    if (c.description && c.description.trim().length > 0) {
      lines.push(escHtml(c.description.trim()))
    }
    blocks.push(lines.join("\n"))
  }

  return `${heading}\n\n${blocks.join("\n\n")}`
}
