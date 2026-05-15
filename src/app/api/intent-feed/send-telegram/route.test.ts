/**
 * Tests for POST /api/intent-feed/send-telegram (Sprint Intent Feed V1).
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intentSignal: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

vi.mock("@/lib/telegram", () => ({
  notifyEmployee: vi.fn(),
  // escHtml is imported transitively by the template helper; provide
  // a passthrough so we don't have to mock the template separately.
  escHtml: (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { notifyEmployee } from "@/lib/telegram"

function makeReq(body: unknown) {
  return new Request("http://localhost/api/intent-feed/send-telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function fakeSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: "sig-1",
    source: "trigify",
    points: 30,
    detail: "Liked competitor post",
    contact: {
      id: "ct-1",
      firstName: "JP",
      lastName: "Chetcuti",
      jobTitle: "CEO",
      linkedinUrl: "https://linkedin.com/in/jp",
      group: "G1",
      company: { name: "Inter-Serv", country: "Malta" },
    },
    company: null,
    signalTypeRef: { label: "Trigify — Competitor Engagement", code: "trigify_competitor_engagement" },
    ...overrides,
  }
}

describe("POST /api/intent-feed/send-telegram", () => {
  const ORIGINAL_BD_EMAILS = process.env.CRM_BD_EMAILS

  beforeAll(() => {
    process.env.CRM_BD_EMAILS = "andy@oxen.finance,paullouis@oxen.finance"
  })

  afterAll(() => {
    if (ORIGINAL_BD_EMAILS === undefined) delete process.env.CRM_BD_EMAILS
    else process.env.CRM_BD_EMAILS = ORIGINAL_BD_EMAILS
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
    vi.mocked(notifyEmployee).mockResolvedValue(true)
  })

  // ─── [1] Default template path ─────────────────────────────────────
  it("[1] 200 with default template (no custom_message)", async () => {
    vi.mocked(prisma.intentSignal.findUnique).mockResolvedValue(
      fakeSignal() as never,
    )

    const res = await POST(makeReq({ signal_id: "sig-1" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, sent_to: 2, succeeded: 2, failed: 0 })

    // notifyEmployee called once per BD email with a message containing
    // the contact name. The exact format is exercised by the template
    // helper unit — here we just assert it received SOMETHING non-empty.
    expect(notifyEmployee).toHaveBeenCalledTimes(2)
    const [email, message] = vi.mocked(notifyEmployee).mock.calls[0]
    expect(email).toBe("andy@oxen.finance")
    expect(message).toContain("JP Chetcuti")
    expect(message).toContain("Inter-Serv")
  })

  // ─── [2] Custom message override ───────────────────────────────────
  it("[2] 200 with custom_message (overrides the template)", async () => {
    vi.mocked(prisma.intentSignal.findUnique).mockResolvedValue(
      fakeSignal() as never,
    )

    const customMessage = "Hey team — please follow up on this one ASAP"
    const res = await POST(
      makeReq({ signal_id: "sig-1", custom_message: customMessage }),
    )
    expect(res.status).toBe(200)

    // The custom message must reach notifyEmployee verbatim (no template
    // prepending or wrapping — the user wrote what they wanted sent).
    const [, message] = vi.mocked(notifyEmployee).mock.calls[0]
    expect(message).toBe(customMessage)
  })

  // ─── [3] 404 when signal missing ───────────────────────────────────
  it("[3] returns 404 if signal not found", async () => {
    vi.mocked(prisma.intentSignal.findUnique).mockResolvedValue(null as never)

    const res = await POST(makeReq({ signal_id: "sig-missing" }))
    expect(res.status).toBe(404)
    expect(notifyEmployee).not.toHaveBeenCalled()
  })
})
