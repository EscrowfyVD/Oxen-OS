// AIRA F2 PR2 — LemCal booking webhook → meeting brief.
//
// LemCal fires on booking CREATION only (v1). It sends NO signature (spike
// confirmed), so the URL token is the only barrier and the call-back re-fetch
// by _id is the anti-forge defense (NON-NEGOTIABLE before any brief).
//
// Flow: token → parse _id → call-back verify → extract owner/primary/Q&A →
// match-only contact (option a: NEVER create) → upsert Meeting (idempotent by
// lemcalBookingId) → generateMeetingBrief (subject=prospect, delivery=owner) →
// link briefId. Errors swallowed (never 500 — LemCal would retry).

import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { verifyLemcalMeeting } from "@/lib/lemcal"
import { generateMeetingBrief } from "@/lib/ai/generate-meeting-brief"
import { buildBookingContext, findCompanyAnswer } from "@/lib/ai/booking-context"

const LEMCAL_WEBHOOK_SECRET = process.env.LEMCAL_WEBHOOK_SECRET || ""

export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({ webhook: "lemcal" })

  // 1. Token check (URL query) — the only barrier; LemCal sends no signature.
  const token = new URL(request.url).searchParams.get("token") ?? ""
  if (!LEMCAL_WEBHOOK_SECRET || token !== LEMCAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const bookingId: unknown = body?._id
    if (!bookingId || typeof bookingId !== "string") {
      log.warn("lemcal: missing _id — ignoring")
      return NextResponse.json({ ok: true, action: "ignored_no_id" })
    }

    // 2. Call-back verify (anti-forge) BEFORE any brief.
    const verified = await verifyLemcalMeeting(
      bookingId,
      typeof body?.meetingTypeId === "string" ? body.meetingTypeId : null,
    )
    if (!verified) {
      log.warn({ bookingId }, "lemcal: booking not found on call-back — ignoring (anti-forge)")
      return NextResponse.json({ ok: true, action: "ignored_unverified" })
    }

    // 3. Extract from the VERIFIED payload.
    const attendees = verified.attendees ?? []
    const owner = attendees.find((a) => a?.owner === true) ?? null
    const primary = attendees.find((a) => a?.primary === true) ?? null
    const company = findCompanyAnswer(verified.questions)
    const start = verified.start ? new Date(verified.start) : null
    const end = verified.end ? new Date(verified.end) : null
    const meetingTypeName = verified.meetingTypeName ?? null

    if (!primary?.email || !start || isNaN(start.getTime())) {
      log.warn({ bookingId }, "lemcal: verified booking missing primary email / start — ignoring")
      return NextResponse.json({ ok: true, action: "ignored_incomplete" })
    }

    // 4. Match-ONLY contact lookup (option a). matchContact() auto-creates —
    //    forbidden here — so we resolve by email without creating anything.
    const matched = await prisma.crmContact.findFirst({
      where: { email: { equals: primary.email, mode: "insensitive" } },
      select: { id: true },
    })
    const contactId = matched?.id ?? null

    // 5. Upsert Meeting by lemcalBookingId (idempotent); store the raw payload.
    const questionsJson = verified.questions as unknown as
      | Prisma.InputJsonValue
      | undefined
    const rawJson = verified as unknown as Prisma.InputJsonValue
    const mutable = {
      meetingTypeId: verified.meetingTypeId ?? null,
      meetingTypeName,
      startTime: start,
      endTime: end,
      primaryName: primary.name ?? null,
      ownerEmail: owner?.email ?? null,
      attendeeTimezone: verified.timezone ?? null,
      googleEventId: verified.eventId ?? null,
      questions: questionsJson,
      contactId,
      raw: rawJson,
    }
    const meeting = await prisma.meeting.upsert({
      where: { lemcalBookingId: bookingId },
      create: { lemcalBookingId: bookingId, primaryEmail: primary.email, ...mutable },
      update: mutable,
    })

    // Idempotency: a re-delivery whose Meeting already has a brief → skip.
    if (meeting.meetingBriefId) {
      log.info({ bookingId, briefId: meeting.meetingBriefId }, "lemcal: already briefed — skipping")
      return NextResponse.json({ ok: true, action: "duplicate_already_briefed", meetingId: meeting.id })
    }

    // 6. Generate the brief. Subject = prospect (contactId). Delivery → OWNER:
    //    pass BOTH attendee emails so the lib matches owner→Employee for Telegram.
    const briefAttendees = [owner?.email, primary.email].filter(
      (e): e is string => typeof e === "string" && e.length > 0,
    )

    // Booking context (prospect + company + Q&A) for the prompt. Most actionable
    // info from the booking — and for a no-match booking, often the ONLY context.
    const extraContext = buildBookingContext(
      primary,
      company,
      meetingTypeName,
      verified.questions,
    )

    const { brief, telegramSentTo } = await generateMeetingBrief({
      title: meetingTypeName || "Meeting",
      meetingDate: start,
      contactId,
      attendees: briefAttendees,
      extraContext,
      eventId: bookingId, // stable per-booking key on MeetingBrief.eventId (@unique)
    })

    // FALLBACK: owner email matches no Employee → brief still saved; warn, no crash.
    if (telegramSentTo.length === 0) {
      log.warn(
        { bookingId, ownerEmail: owner?.email, company },
        "lemcal: brief saved but no Telegram recipient matched (owner not an Employee?)",
      )
    }

    // 7. Link the brief onto the Meeting.
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { meetingBriefId: brief.id },
    })

    return NextResponse.json({
      ok: true,
      action: "briefed",
      meetingId: meeting.id,
      briefId: brief.id,
      contactMatched: !!contactId,
      telegramSentTo,
    })
  } catch (error) {
    // Never 500 back to LemCal (it would retry); idempotency guards dups.
    log.error({ err: serializeError(error) }, "lemcal webhook processing failed")
    return NextResponse.json({ ok: true, action: "error" })
  }
}
