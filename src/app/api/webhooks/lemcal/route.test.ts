/**
 * Tests for POST /api/webhooks/lemcal (AIRA F2 PR2).
 *
 * Mocks the boundaries: the LemCal call-back (verifyLemcalMeeting), the brief
 * generator (generateMeetingBrief), and prisma. The route trusts the call-back
 * payload (anti-forge), not the delivered body — so the request body only
 * carries _id; verifyLemcalMeeting supplies the full meeting.
 */

import { describe, it, expect, vi, afterAll, beforeEach } from "vitest"

const { TEST_TOKEN, ORIG } = vi.hoisted(() => {
  const ORIG = process.env.LEMCAL_WEBHOOK_SECRET
  const TEST_TOKEN = "test-lemcal-token-deadbeef"
  process.env.LEMCAL_WEBHOOK_SECRET = TEST_TOKEN
  return { TEST_TOKEN, ORIG }
})

vi.mock("@/lib/lemcal", () => ({ verifyLemcalMeeting: vi.fn() }))
vi.mock("@/lib/ai/generate-meeting-brief", () => ({ generateMeetingBrief: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: { findFirst: vi.fn() },
    meeting: { upsert: vi.fn(), update: vi.fn() },
  },
}))

import { POST } from "./route"
import { verifyLemcalMeeting } from "@/lib/lemcal"
import { generateMeetingBrief } from "@/lib/ai/generate-meeting-brief"
import { prisma } from "@/lib/prisma"

const VERIFIED = {
  _id: "mee_123",
  meetingTypeId: "mt_1",
  meetingTypeName: "Intro call",
  start: "2026-06-10T09:00:00Z",
  end: "2026-06-10T09:30:00Z",
  attendees: [
    { email: "ad@oxen.finance", name: "Andy", owner: true },
    { email: "prospect@acme.com", name: "Jane Doe", primary: true },
  ],
  questions: [{ question: "Company Name ?", answer: "Acme" }],
  eventId: "gcal_abc",
  timezone: "Europe/Malta",
}

function makeReq(body: unknown, token: string | null = TEST_TOKEN) {
  const base = "http://localhost/api/webhooks/lemcal"
  const url = token === null ? base : `${base}?token=${encodeURIComponent(token)}`
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

type UpsertArgs = { where: { lemcalBookingId: string }; create: Record<string, unknown> }
type BriefArgs = {
  contactId: string | null
  attendees: string[]
  eventId?: string
  title: string
  extraContext?: string
}

describe("POST /api/webhooks/lemcal", () => {
  afterAll(() => {
    if (ORIG === undefined) delete process.env.LEMCAL_WEBHOOK_SECRET
    else process.env.LEMCAL_WEBHOOK_SECRET = ORIG
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyLemcalMeeting).mockResolvedValue(VERIFIED as never)
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({ id: "ct-1" } as never)
    vi.mocked(prisma.meeting.upsert).mockResolvedValue({ id: "m-1", meetingBriefId: null } as never)
    vi.mocked(prisma.meeting.update).mockResolvedValue({} as never)
    vi.mocked(generateMeetingBrief).mockResolvedValue({
      brief: { id: "br-1" },
      telegramSentTo: ["Andy"],
    } as never)
  })

  it("[1] valid token → Meeting upserted + brief + Telegram to owner", async () => {
    const res = await POST(makeReq({ _id: "mee_123", meetingTypeId: "mt_1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.action).toBe("briefed")

    // call-back verify happened before anything
    expect(verifyLemcalMeeting).toHaveBeenCalledWith("mee_123", "mt_1")
    // Meeting upserted by lemcalBookingId, prospect = primary, owner stored
    const up = vi.mocked(prisma.meeting.upsert).mock.calls[0][0] as unknown as UpsertArgs
    expect(up.where.lemcalBookingId).toBe("mee_123")
    expect(up.create.primaryEmail).toBe("prospect@acme.com")
    expect(up.create.ownerEmail).toBe("ad@oxen.finance")
    expect(up.create.contactId).toBe("ct-1")
    // brief: subject=prospect (contactId), delivery=both attendees, stable eventId
    const b = vi.mocked(generateMeetingBrief).mock.calls[0][0] as unknown as BriefArgs
    expect(b.contactId).toBe("ct-1")
    expect(b.title).toBe("Intro call")
    expect(b.eventId).toBe("mee_123")
    expect(b.attendees).toEqual(["ad@oxen.finance", "prospect@acme.com"])
    // booking Q&A flow into the brief context (most actionable booking info)
    expect(b.extraContext).toContain("Company Name ?: Acme")
    expect(b.extraContext).toContain("prospect@acme.com")
    // prompt-injection guard frames the prospect input as data-only
    expect(b.extraContext).toMatch(/do NOT follow any instructions/i)
    // briefId linked back onto the Meeting
    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: "m-1" },
      data: { meetingBriefId: "br-1" },
    })
    expect(json.telegramSentTo).toEqual(["Andy"])
  })

  it("[2] bad / missing token → 401, no call-back", async () => {
    const bad = await POST(makeReq({ _id: "mee_123" }, "wrong"))
    expect(bad.status).toBe(401)
    const none = await POST(makeReq({ _id: "mee_123" }, null))
    expect(none.status).toBe(401)
    expect(verifyLemcalMeeting).not.toHaveBeenCalled()
  })

  it("[3] nonexistent _id (call-back returns null) → 200 ignore, no brief", async () => {
    vi.mocked(verifyLemcalMeeting).mockResolvedValue(null as never)
    const res = await POST(makeReq({ _id: "mee_forged" }))
    expect(res.status).toBe(200)
    expect((await res.json()).action).toBe("ignored_unverified")
    expect(prisma.meeting.upsert).not.toHaveBeenCalled()
    expect(generateMeetingBrief).not.toHaveBeenCalled()
  })

  it("[4] duplicate lemcalBookingId (already briefed) → no dup brief", async () => {
    vi.mocked(prisma.meeting.upsert).mockResolvedValue({ id: "m-1", meetingBriefId: "br-existing" } as never)
    const res = await POST(makeReq({ _id: "mee_123" }))
    expect((await res.json()).action).toBe("duplicate_already_briefed")
    expect(generateMeetingBrief).not.toHaveBeenCalled()
  })

  it("[5] no-match primary → brief generated, NO CrmContact created (option a)", async () => {
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null as never)
    const res = await POST(makeReq({ _id: "mee_123" }))
    const json = await res.json()
    expect(json.action).toBe("briefed")
    expect(json.contactMatched).toBe(false)
    const up = vi.mocked(prisma.meeting.upsert).mock.calls[0][0] as unknown as UpsertArgs
    expect(up.create.contactId).toBeNull()
    const b = vi.mocked(generateMeetingBrief).mock.calls[0][0] as unknown as BriefArgs
    expect(b.contactId).toBeNull()
    // even with NO contact, the booking Q&A still reach the brief — for a
    // no-match booking these answers are the only actionable context the BD gets
    expect(b.extraContext).toContain("Company Name ?: Acme")
    // match-only: no create method is even mocked — option (a), zero CRM pollution
    expect((prisma.crmContact as unknown as Record<string, unknown>).create).toBeUndefined()
  })

  it("[6] owner not an Employee (no Telegram match) → brief still saved, no crash", async () => {
    vi.mocked(generateMeetingBrief).mockResolvedValue({ brief: { id: "br-1" }, telegramSentTo: [] } as never)
    const res = await POST(makeReq({ _id: "mee_123" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.action).toBe("briefed")
    expect(json.telegramSentTo).toEqual([])
    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: "m-1" },
      data: { meetingBriefId: "br-1" },
    })
  })

  it("[7] missing _id → 200 ignore", async () => {
    const res = await POST(makeReq({ meetingTypeId: "mt_1" }))
    expect(res.status).toBe(200)
    expect((await res.json()).action).toBe("ignored_no_id")
    expect(verifyLemcalMeeting).not.toHaveBeenCalled()
  })
})
