/**
 * Tests for POST /api/ai/brief (AIRA F2 PR1) — proves the route is now a
 * thin caller: auth gate + input validation, then delegates to
 * generateMeetingBrief (which is mocked here).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/ai/generate-meeting-brief", () => ({
  generateMeetingBrief: vi.fn(),
}))

import { POST } from "./route"
import { auth } from "@/lib/auth"
import { generateMeetingBrief } from "@/lib/ai/generate-meeting-brief"

function makeReq(body: unknown) {
  return new Request("http://localhost/api/ai/brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/ai/brief (thin caller)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { email: "bd@oxen.finance" } } as never)
    vi.mocked(generateMeetingBrief).mockResolvedValue({
      brief: { id: "br-1" },
      telegramSentTo: ["Andy"],
    } as never)
  })

  it("[1] 401 when unauthenticated — does not call the generator", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const res = await POST(makeReq({ title: "x", meetingDate: "2026-06-10" }))
    expect(res.status).toBe(401)
    expect(generateMeetingBrief).not.toHaveBeenCalled()
  })

  it("[2] 400 when title/meetingDate missing — does not call the generator", async () => {
    const res = await POST(makeReq({ title: "x" }))
    expect(res.status).toBe(400)
    expect(generateMeetingBrief).not.toHaveBeenCalled()
  })

  it("[3] delegates to generateMeetingBrief and returns its result", async () => {
    const res = await POST(
      makeReq({
        title: "Acme intro",
        meetingDate: "2026-06-10T09:00:00Z",
        contactId: "ct-1",
        attendees: ["andy@oxen.finance"],
      }),
    )
    expect(res.status).toBe(200)
    expect(generateMeetingBrief).toHaveBeenCalledTimes(1)
    expect(vi.mocked(generateMeetingBrief).mock.calls[0][0]).toMatchObject({
      title: "Acme intro",
      contactId: "ct-1",
      attendees: ["andy@oxen.finance"],
    })
    const json = await res.json()
    expect(json).toEqual({ brief: { id: "br-1" }, telegramSentTo: ["Andy"] })
  })

  it("[4] 500 when the generator throws", async () => {
    vi.mocked(generateMeetingBrief).mockRejectedValue(new Error("boom"))
    const res = await POST(makeReq({ title: "x", meetingDate: "2026-06-10" }))
    expect(res.status).toBe(500)
  })
})
