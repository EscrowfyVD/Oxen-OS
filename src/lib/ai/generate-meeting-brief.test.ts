/**
 * Tests for generateMeetingBrief (AIRA F2 PR1) — first coverage for the
 * extracted generation lib. Mocks the boundaries (anthropic, prisma, telegram)
 * and asserts: IntentSignals are in the assembled context, Claude is called,
 * the MeetingBrief is saved, and Telegram delivery fires.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: { findUnique: vi.fn(), findFirst: vi.fn() },
    intentSignal: { findMany: vi.fn() },
    supportTicket: { findMany: vi.fn() },
    meetingBrief: { create: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    employee: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/telegram", () => ({
  sendTelegramMessage: vi.fn(),
  formatBriefForTelegram: vi.fn(() => "formatted-brief"),
}))

import { generateMeetingBrief } from "./generate-meeting-brief"
import { prisma } from "@/lib/prisma"
import { sendTelegramMessage, formatBriefForTelegram } from "@/lib/telegram"

const BRIEF_JSON = {
  company_context: "ctx",
  relationship_history: "hist",
  deal_status: "stage",
  recent_news: "news",
  talking_points: ["a", "b"],
  risks: ["r"],
  opportunities: ["o"],
  suggested_ask: "ask",
}

function mockContact(over: Record<string, unknown> = {}) {
  return {
    id: "ct-1",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@acme.com",
    lifecycleStage: "replied",
    relationshipStrength: "warm",
    vertical: ["FinTech"],
    icpFit: "high",
    country: "MT",
    pinnedNote: null,
    company: { name: "Acme" },
    activities: [],
    deals: [],
    companyIntel: [],
    ...over,
  }
}

const SIGNAL = {
  source: "trigify",
  signalType: "trigify_profile_visit",
  title: "Viewed pricing page",
  detail: "from LinkedIn",
  points: 10,
  intentCategory: "A",
  signalLevel: "contact",
  createdAt: new Date("2026-06-01T00:00:00Z"),
}

describe("generateMeetingBrief", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(BRIEF_JSON) }],
    })
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(mockContact() as never)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([SIGNAL] as never)
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([] as never)
    const savedBrief = {
      id: "br-1",
      contactId: "ct-1",
      briefContent: BRIEF_JSON,
      contact: { id: "ct-1", firstName: "Jane", lastName: "Doe", company: { name: "Acme" } },
    }
    vi.mocked(prisma.meetingBrief.create).mockResolvedValue(savedBrief as never)
    vi.mocked(prisma.meetingBrief.upsert).mockResolvedValue(savedBrief as never)
    vi.mocked(prisma.meetingBrief.update).mockResolvedValue({} as never)
    vi.mocked(prisma.employee.findFirst).mockResolvedValue(null as never)
    vi.mocked(sendTelegramMessage).mockResolvedValue({ ok: true } as never)
  })

  it("[1] includes IntentSignals in the Claude context + calls Claude + saves the brief", async () => {
    const res = await generateMeetingBrief({
      contactId: "ct-1",
      meetingDate: "2026-06-10T09:00:00Z",
      title: "Acme intro",
      attendees: [],
    })

    // IntentSignals queried by contact, non-expired
    expect(prisma.intentSignal.findMany).toHaveBeenCalledTimes(1)
    const sigArgs = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0] as {
      where: { contactId: string; OR: unknown[] }
    }
    expect(sigArgs.where.contactId).toBe("ct-1")
    expect(Array.isArray(sigArgs.where.OR)).toBe(true) // expiresAt null | gt now

    // Claude called, and the prompt carries the signal in context
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const prompt = vi.mocked(mockCreate).mock.calls[0][0].messages[0].content as string
    expect(prompt).toContain("Intent Signals")
    expect(prompt).toContain("Viewed pricing page")
    expect(prompt).toContain("trigify_profile_visit")

    // Brief saved with the parsed content + returned
    expect(prisma.meetingBrief.create).toHaveBeenCalledTimes(1)
    const createArgs = vi.mocked(prisma.meetingBrief.create).mock.calls[0][0] as {
      data: { briefContent: unknown; contactId: string | null }
    }
    expect(createArgs.data.briefContent).toEqual(BRIEF_JSON)
    expect(createArgs.data.contactId).toBe("ct-1")
    expect(res.brief.id).toBe("br-1")
  })

  it("[2] delivers via Telegram to a matched employee + records sentVia", async () => {
    vi.mocked(prisma.employee.findFirst).mockResolvedValue({
      name: "Andy",
      telegramChatId: "123",
    } as never)

    const res = await generateMeetingBrief({
      contactId: "ct-1",
      meetingDate: "2026-06-10T09:00:00Z",
      title: "Acme intro",
      attendees: ["andy@oxen.finance"],
    })

    expect(sendTelegramMessage).toHaveBeenCalledWith("123", "formatted-brief")
    expect(prisma.meetingBrief.update).toHaveBeenCalledTimes(1)
    const upd = vi.mocked(prisma.meetingBrief.update).mock.calls[0][0] as {
      data: { sentVia: string }
    }
    expect(upd.data.sentVia).toBe("telegram:Andy")
    expect(res.telegramSentTo).toEqual(["Andy"])
  })

  it("[3] generates with no contact (no CRM match) — no signal query, brief saved with null contact", async () => {
    const res = await generateMeetingBrief({
      meetingDate: "2026-06-10T09:00:00Z",
      title: "Cold intro",
      attendees: [],
    })
    expect(prisma.intentSignal.findMany).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const prompt = vi.mocked(mockCreate).mock.calls[0][0].messages[0].content as string
    expect(prompt).toContain("No CRM data available")
    expect(res.brief.id).toBe("br-1")
  })

  it("[5] injects caller extraContext into the prompt — even with no matched contact", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue(null as never)
    const res = await generateMeetingBrief({
      meetingDate: "2026-06-10T09:00:00Z",
      title: "Cold intro",
      attendees: [],
      extraContext:
        "Prospect: Jane Doe — Sosa (jane@sosa.com)\nBooking questions & answers:\n- Company Name: Sosa\n- Banking setup: EMI + crypto",
    })
    // No CRM contact → no signal query, but the booking Q&A still reaches Claude
    expect(prisma.intentSignal.findMany).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const prompt = vi.mocked(mockCreate).mock.calls[0][0].messages[0].content as string
    expect(prompt).toContain("Booking Details")
    expect(prompt).toContain("Banking setup: EMI + crypto")
    expect(prompt).toContain("Sosa")
    // and it is NOT the empty-context fallback (the Q&A populated CONTEXT)
    expect(prompt).not.toContain("No CRM data available")
    expect(res.brief.id).toBe("br-1")
  })

  it("[6] eventId set → upserts the brief by eventId (no create; no P2002 on re-gen)", async () => {
    const res = await generateMeetingBrief({
      eventId: "mee_123",
      contactId: "ct-1",
      meetingDate: "2026-06-10T09:00:00Z",
      title: "Acme intro",
      attendees: [],
    })
    expect(prisma.meetingBrief.upsert).toHaveBeenCalledTimes(1)
    expect(prisma.meetingBrief.create).not.toHaveBeenCalled()
    const up = vi.mocked(prisma.meetingBrief.upsert).mock.calls[0][0] as {
      where: { eventId: string }
      create: { eventId: string }
      update: Record<string, unknown>
    }
    expect(up.where.eventId).toBe("mee_123")
    expect(up.create.eventId).toBe("mee_123")
    // update regenerates content but preserves identity fields
    expect(up.update.briefContent).toEqual(BRIEF_JSON)
    expect(up.update).not.toHaveProperty("eventId")
    expect(up.update).not.toHaveProperty("createdBy")
    expect(res.brief.id).toBe("br-1")
  })

  it("[7] no eventId → create (UI path unchanged; multiple NULLs allowed)", async () => {
    await generateMeetingBrief({
      contactId: "ct-1",
      meetingDate: "2026-06-10T09:00:00Z",
      title: "UI brief",
      attendees: [],
    })
    expect(prisma.meetingBrief.create).toHaveBeenCalledTimes(1)
    expect(prisma.meetingBrief.upsert).not.toHaveBeenCalled()
    const cr = vi.mocked(prisma.meetingBrief.create).mock.calls[0][0] as {
      data: { eventId: string | null }
    }
    expect(cr.data.eventId).toBeNull()
  })

  it("[8] telegramNote → marker passed through to the Telegram formatter", async () => {
    vi.mocked(prisma.employee.findFirst).mockResolvedValue({
      name: "Andy",
      telegramChatId: "123",
    } as never)
    await generateMeetingBrief({
      eventId: "mee_123",
      meetingDate: "2026-06-10T09:00:00Z",
      title: "Acme intro",
      attendees: ["andy@oxen.finance"],
      telegramNote: "🔄 Brief actualisé",
    })
    expect(formatBriefForTelegram).toHaveBeenCalled()
    const fmtArg = vi.mocked(formatBriefForTelegram).mock.calls[0][0] as { note?: string }
    expect(fmtArg.note).toBe("🔄 Brief actualisé")
  })

  it("[4] throws when Claude returns no JSON", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "sorry, no json" }] })
    await expect(
      generateMeetingBrief({ meetingDate: "2026-06-10", title: "x", attendees: [] }),
    ).rejects.toThrow("Failed to parse brief content")
  })
})
