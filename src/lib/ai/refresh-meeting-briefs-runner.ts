// AIRA F2 PR3b — 1h-before meeting-brief refresh runner.
//
// Regenerates the brief for meetings about to start, so the BD gets a brief
// reflecting any CRM / intent-signal movement since booking. Mirrors the
// score-recompute-runner structure (per-item try/catch, batch continues on
// failure, returns a summary). Reads the Meeting DB only — NO LemCal API call,
// so it has no dependency on lemcal.ts or the booking-test outcome.
//
// Idempotency (exactly-once): Meeting.briefRefreshedAt (PR3a). The query takes
// only meetings not yet refreshed; we set briefRefreshedAt after a successful
// regenerate. A generous window absorbs cron drift without double-refreshing.
//
// Window + guard (recon B + guard #5): startTime in (now, now+75min], not yet
// refreshed, AND createdAt < now-30min — a just-booked meeting already has a
// fresh webhook brief, so refreshing it would only double-notify the owner.

import { prisma } from "@/lib/prisma"
import { generateMeetingBrief } from "./generate-meeting-brief"
import {
  buildBookingContext,
  findCompanyAnswer,
  type BookingContextQuestion,
} from "./booking-context"
import { logger, serializeError } from "@/lib/logger"

const log = logger.child({ component: "refresh-meeting-briefs-runner" })

// Window + guard (minutes).
const WINDOW_AHEAD_MIN = 75 // refresh meetings starting within ~1h (≤75min)
const RECENT_GUARD_MIN = 30 // skip bookings younger than this (fresh brief already)

// Marker shown in the refresh Telegram so the BD sees it's an update.
const REFRESH_TELEGRAM_NOTE = "🔄 Brief actualisé"

export interface MeetingBriefRefreshResult {
  /** Meetings the query returned (in-window, unrefreshed, aged). */
  processed: number
  /** Meetings whose brief was regenerated + marked. */
  refreshed: number
  /** Per-meeting errors (the runner continues on failure; audit trail). */
  errors: Array<{ meetingId: string; error: string }>
  /** Total wall clock for the run. */
  durationMs: number
}

/**
 * Refresh the brief for every imminent meeting in the window. `now` is
 * injectable for deterministic tests (mirrors score-recompute-runner).
 */
export async function runMeetingBriefRefresh(
  now: Date = new Date(),
): Promise<MeetingBriefRefreshResult> {
  const wallStart = Date.now()
  const nowMs = now.getTime()
  const windowEnd = new Date(nowMs + WINDOW_AHEAD_MIN * 60_000)
  const recentCutoff = new Date(nowMs - RECENT_GUARD_MIN * 60_000)

  const meetings = await prisma.meeting.findMany({
    where: {
      startTime: { gt: now, lte: windowEnd },
      briefRefreshedAt: null,
      createdAt: { lt: recentCutoff },
    },
    select: {
      id: true,
      lemcalBookingId: true,
      contactId: true,
      meetingTypeName: true,
      startTime: true,
      ownerEmail: true,
      primaryEmail: true,
      primaryName: true,
      questions: true,
    },
  })

  const result: MeetingBriefRefreshResult = {
    processed: 0,
    refreshed: 0,
    errors: [],
    durationMs: 0,
  }

  for (const m of meetings) {
    result.processed += 1
    try {
      const questions =
        (m.questions as unknown as BookingContextQuestion[] | null) ?? null
      const company = findCompanyAnswer(questions)
      // Same shared builder as the webhook → inherits the prompt-injection guard.
      const extraContext = buildBookingContext(
        { email: m.primaryEmail, name: m.primaryName },
        company,
        m.meetingTypeName,
        questions,
      )
      const attendees = [m.ownerEmail, m.primaryEmail].filter(
        (e): e is string => typeof e === "string" && e.length > 0,
      )

      // eventId = lemcalBookingId → upsert-by-eventId regenerates the SAME brief
      // (or creates one for a meeting that never got briefed — PR2-failure net).
      const { brief } = await generateMeetingBrief({
        eventId: m.lemcalBookingId,
        contactId: m.contactId,
        title: m.meetingTypeName || "Meeting",
        meetingDate: m.startTime,
        attendees,
        extraContext,
        telegramNote: REFRESH_TELEGRAM_NOTE,
      })

      await prisma.meeting.update({
        where: { id: m.id },
        data: { briefRefreshedAt: now, meetingBriefId: brief.id },
      })
      result.refreshed += 1
    } catch (err) {
      log.error(
        { meetingId: m.id, err: serializeError(err) },
        "meeting brief refresh failed — continuing batch",
      )
      result.errors.push({
        meetingId: m.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  result.durationMs = Date.now() - wallStart
  log.info(
    { processed: result.processed, refreshed: result.refreshed, errors: result.errors.length },
    "meeting brief refresh batch complete",
  )
  return result
}
