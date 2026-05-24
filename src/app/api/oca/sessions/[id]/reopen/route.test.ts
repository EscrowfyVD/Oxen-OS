/**
 * Tests for POST /api/oca/sessions/[id]/reopen (SP16-003 Slice 1).
 *
 * Same mock pattern as the other 2 mutation routes. The reopen-
 * specific coverage point is the OCA-409 → 409 status_conflict
 * distinct mapping (a new addition vs SP16-002's proxy).
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest"

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

vi.mock("@/lib/onboarding/feature-flag", () => ({
  isOnboardingConsoleEnabled: vi.fn(),
}))

import { POST } from "./route"
import { requirePageAccess } from "@/lib/admin"
import { isOnboardingConsoleEnabled } from "@/lib/onboarding/feature-flag"

const OPERATOR_EMAIL = "vd@oxen.finance"
const ATTACKER_EMAIL = "attacker@evil.example"
const FAKE_BASE_URL = "https://oca-fake.example.test"
const FAKE_API_KEY = "fake-oca-key-deadbeef"
const SID = "sess-abc-123"

function makeReq(body: unknown = {}, opts: { extraHeaders?: Record<string, string> } = {}) {
  return new Request(`http://localhost/api/oca/sessions/${SID}/reopen`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockOcaResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/oca/sessions/[id]/reopen", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>
  const ORIGINAL_BASE = process.env.OCA_API_BASE_URL
  const ORIGINAL_KEY = process.env.OCA_OPERATOR_API_KEY

  beforeAll(() => {
    process.env.OCA_API_BASE_URL = FAKE_BASE_URL
    process.env.OCA_OPERATOR_API_KEY = FAKE_API_KEY
  })

  afterAll(() => {
    if (ORIGINAL_BASE === undefined) delete process.env.OCA_API_BASE_URL
    else process.env.OCA_API_BASE_URL = ORIGINAL_BASE
    if (ORIGINAL_KEY === undefined) delete process.env.OCA_OPERATOR_API_KEY
    else process.env.OCA_OPERATOR_API_KEY = ORIGINAL_KEY
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isOnboardingConsoleEnabled).mockReturnValue(true)
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: OPERATOR_EMAIL } },
      employee: null,
      roleLevel: "manager",
    } as never)
    fetchSpy = vi.spyOn(globalThis, "fetch")
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  // ─── [1] Happy path — 200 + canonical response shape ───────────────
  it("[1] happy path: 200 with reopen response shape", async () => {
    fetchSpy.mockResolvedValue(
      mockOcaResponse(200, {
        session_id: SID,
        previous_status: "rejected",
        new_status: "review",
        reopened_at: "2026-05-23T16:00:00.000Z",
      }),
    )
    const res = await POST(makeReq({}), params(SID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      session_id: SID,
      previous_status: "rejected",
      new_status: "review",
    })

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${FAKE_BASE_URL}/api/admin/sessions/${SID}/reopen`)
    expect(init.method).toBe("POST")
    // Fastify requires a non-empty body with content-type:json; we send {}.
    expect(JSON.parse(init.body as string)).toEqual({})
  })

  // ─── [2] Flag off → 404 ────────────────────────────────────────────
  it("[2] returns 404 when ONBOARDING_CONSOLE_ENABLED is off", async () => {
    vi.mocked(isOnboardingConsoleEnabled).mockReturnValue(false)
    const res = await POST(makeReq({}), params(SID))
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ─── [3] x-operator-email server-derived ───────────────────────────
  it("[3] x-operator-email is injected from session, NOT from request", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(200, {}))
    await POST(
      makeReq({}, { extraHeaders: { "x-operator-email": ATTACKER_EMAIL } }),
      params(SID),
    )
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["x-operator-email"]).toBe(OPERATOR_EMAIL)
    expect(headers["x-operator-email"]).not.toBe(ATTACKER_EMAIL)
  })

  // ─── [4] OCA 409 → distinct status_conflict mapping (NEW) ──────────
  it("[4] OCA 409 → 409 status_conflict with recognizable error", async () => {
    fetchSpy.mockResolvedValue(
      mockOcaResponse(409, {
        error: "Conflict",
        message: "Only 'rejected' sessions can be reopened via this endpoint; current status is 'review'",
        statusCode: 409,
        session_status: "review",
      }),
    )
    const res = await POST(makeReq({}), params(SID))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("status_conflict")
    // Upstream message surfaces through so the UI can render it.
    expect(body.message).toContain("rejected")
    expect(body.upstream).toMatchObject({ session_status: "review" })
  })

  // ─── [5] OCA 401 → 403 not_authorized ──────────────────────────────
  it("[5] OCA 401 → 403 not_authorized", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(401, { error: "Unauthorized" }))
    const res = await POST(makeReq({}), params(SID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("not_authorized")
  })

  // ─── [6] OCA unreachable → 502 oca_unreachable ─────────────────────
  it("[6] network error → 502 oca_unreachable", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"))
    const res = await POST(makeReq({}), params(SID))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe("oca_unreachable")
  })

  // ─── [7] Body validation: extra keys rejected (strict) ─────────────
  it("[7] rejects body with extra keys → 400, no OCA call", async () => {
    const res = await POST(makeReq({ extra: "data" }), params(SID))
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
