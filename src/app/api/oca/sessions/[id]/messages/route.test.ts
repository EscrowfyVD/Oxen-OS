/**
 * Tests for POST /api/oca/sessions/[id]/messages (SP16-003 Slice 1).
 *
 * Same mock pattern as agent/route.test.ts. The mutation-specific
 * coverage points here are the OCA-side asymmetric field naming
 * (request `message`, response `content`) — the proxy forwards
 * verbatim, so the test asserts the upstream call body has `message`.
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

function makeReq(body: unknown, opts: { extraHeaders?: Record<string, string> } = {}) {
  return new Request(`http://localhost/api/oca/sessions/${SID}/messages`, {
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

describe("POST /api/oca/sessions/[id]/messages", () => {
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

  // ─── [1] Happy path — 201 + canonical response shape ──────────────
  it("[1] happy path: forwards `message` body, returns OCA 201", async () => {
    fetchSpy.mockResolvedValue(
      mockOcaResponse(201, {
        id: "msg-1",
        session_id: SID,
        sender: "operator",
        operator_email: OPERATOR_EMAIL,
        content: "Hello applicant",
        created_at: "2026-05-23T15:35:31.536Z",
      }),
    )
    const res = await POST(makeReq({ message: "Hello applicant" }), params(SID))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({
      id: "msg-1",
      sender: "operator",
      content: "Hello applicant",
    })

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${FAKE_BASE_URL}/api/admin/sessions/${SID}/messages`)
    expect(init.method).toBe("POST")
    // OCA asymmetry: request field is `message` (not `content`).
    expect(JSON.parse(init.body as string)).toEqual({ message: "Hello applicant" })
  })

  // ─── [2] Flag off → 404 ────────────────────────────────────────────
  it("[2] returns 404 when ONBOARDING_CONSOLE_ENABLED is off", async () => {
    vi.mocked(isOnboardingConsoleEnabled).mockReturnValue(false)
    const res = await POST(makeReq({ message: "Hi" }), params(SID))
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ─── [3] x-operator-email server-derived ───────────────────────────
  it("[3] x-operator-email is injected from session, NOT from request", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(201, {}))
    await POST(
      makeReq({ message: "Hi" }, { extraHeaders: { "x-operator-email": ATTACKER_EMAIL } }),
      params(SID),
    )
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["x-operator-email"]).toBe(OPERATOR_EMAIL)
    expect(headers["x-operator-email"]).not.toBe(ATTACKER_EMAIL)
  })

  // ─── [4] Empty message → 400 (Zod min(1)), no OCA call ─────────────
  it("[4] rejects empty message → 400, no OCA call", async () => {
    const res = await POST(makeReq({ message: "" }), params(SID))
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ─── [5] OCA 401 → 403 not_authorized ──────────────────────────────
  it("[5] OCA 401 → 403 not_authorized with recognizable error", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(401, { error: "Unauthorized" }))
    const res = await POST(makeReq({ message: "Hi" }), params(SID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("not_authorized")
  })

  // ─── [6] OCA unreachable → 502 oca_unreachable ─────────────────────
  it("[6] network error → 502 oca_unreachable", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"))
    const res = await POST(makeReq({ message: "Hi" }), params(SID))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe("oca_unreachable")
  })
})
