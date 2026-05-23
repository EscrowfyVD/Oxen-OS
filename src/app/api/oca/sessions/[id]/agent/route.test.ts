/**
 * Tests for PATCH /api/oca/sessions/[id]/agent (SP16-003 Slice 1).
 *
 * Pattern mirrors SP16-002's sessions/[id]/route.test.ts. The
 * mutation-specific assertions are:
 *   - body validation (Zod rejects bad shapes before any OCA call)
 *   - x-operator-email is server-derived, NOT from the request
 *   - 7-gate contract preserved (flag, access, env, fetch errors,
 *     OCA-401 mapping)
 *
 * Real OCA fetch is mocked — never hit live OCA from tests.
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

import { PATCH } from "./route"
import { requirePageAccess } from "@/lib/admin"
import { isOnboardingConsoleEnabled } from "@/lib/onboarding/feature-flag"

const OPERATOR_EMAIL = "vd@oxen.finance"
const ATTACKER_EMAIL = "attacker@evil.example"
const FAKE_BASE_URL = "https://oca-fake.example.test"
const FAKE_API_KEY = "fake-oca-key-deadbeef"
const SID = "sess-abc-123"

function makeReq(body: unknown, opts: { extraHeaders?: Record<string, string> } = {}) {
  return new Request(`http://localhost/api/oca/sessions/${SID}/agent`, {
    method: "PATCH",
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

describe("PATCH /api/oca/sessions/[id]/agent", () => {
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

  // ─── [1] Happy path ────────────────────────────────────────────────
  it("[1] happy path: forwards body + returns OCA 200", async () => {
    fetchSpy.mockResolvedValue(
      mockOcaResponse(200, {
        session_id: SID,
        agent_active: false,
        changed: true,
      }),
    )
    const res = await PATCH(makeReq({ active: false }), params(SID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ session_id: SID, agent_active: false })

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${FAKE_BASE_URL}/api/admin/sessions/${SID}/agent`)
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body as string)).toEqual({ active: false })
  })

  // ─── [2] Flag off → 404 ────────────────────────────────────────────
  it("[2] returns 404 when ONBOARDING_CONSOLE_ENABLED is off", async () => {
    vi.mocked(isOnboardingConsoleEnabled).mockReturnValue(false)
    const res = await PATCH(makeReq({ active: true }), params(SID))
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ─── [3] Access denied (requirePageAccess returns an error response)
  it("[3] forwards requirePageAccess error verbatim (403)", async () => {
    const { NextResponse } = await import("next/server")
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
      employee: null,
      roleLevel: null,
    } as never)
    const res = await PATCH(makeReq({ active: true }), params(SID))
    expect(res.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ─── [4] x-operator-email server-derived (header forgery defense) ──
  it("[4] x-operator-email is injected from session, NOT from request", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(200, {}))
    // Attacker tries to override the operator email via a request header.
    await PATCH(
      makeReq({ active: true }, { extraHeaders: { "x-operator-email": ATTACKER_EMAIL } }),
      params(SID),
    )
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["x-operator-email"]).toBe(OPERATOR_EMAIL) // session wins
    expect(headers["x-operator-email"]).not.toBe(ATTACKER_EMAIL)
    expect(headers["x-api-key"]).toBe(FAKE_API_KEY)
  })

  // ─── [5] Body validation: missing `active` → 400, no OCA call ──────
  it("[5] rejects body without `active` boolean → 400, no OCA call", async () => {
    const res = await PATCH(makeReq({ paused: true }), params(SID))
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ─── [6] OCA 401 → 403 not_authorized ──────────────────────────────
  it("[6] OCA 401 → 403 not_authorized with recognizable error", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(401, { error: "Unauthorized" }))
    const res = await PATCH(makeReq({ active: true }), params(SID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("not_authorized")
  })

  // ─── [7] OCA unreachable → 502 oca_unreachable ─────────────────────
  it("[7] network error → 502 oca_unreachable", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"))
    const res = await PATCH(makeReq({ active: true }), params(SID))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe("oca_unreachable")
  })
})
