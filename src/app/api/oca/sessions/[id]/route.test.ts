/**
 * Tests for GET /api/oca/sessions/[id] (SP16-002 Slice 2).
 *
 * Same proxy helper as the list route — these tests focus on the
 * id-bearing path construction and the 404 pass-through (detail
 * fetches frequently 404 when an id is stale).
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest"

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

vi.mock("@/lib/onboarding/feature-flag", () => ({
  isOnboardingConsoleEnabled: vi.fn(),
}))

import { GET } from "./route"
import { requirePageAccess } from "@/lib/admin"
import { isOnboardingConsoleEnabled } from "@/lib/onboarding/feature-flag"

const OPERATOR_EMAIL = "andy@oxen.finance"
const FAKE_BASE_URL = "https://oca-fake.example.test"
const FAKE_API_KEY = "fake-oca-key-deadbeef"

function makeReq() {
  return new Request("http://localhost/api/oca/sessions/sess-abc-123", {
    method: "GET",
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

describe("GET /api/oca/sessions/[id]", () => {
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

  // ─── [1] Happy path with consolidated session payload ──────────────
  it("[1] happy path: proxies OCA 200 + consolidated session data", async () => {
    fetchSpy.mockResolvedValue(
      mockOcaResponse(200, {
        session: { id: "sess-abc-123", status: "collecting" },
        data: { personal_info: { _source_first_name: "user" } },
        chat: { messages: [], truncated: false, total: 0 },
      }),
    )
    const res = await GET(makeReq(), params("sess-abc-123"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session.id).toBe("sess-abc-123")
  })

  // ─── [2] id flows into upstream URL ───────────────────────────────
  it("[2] forwards id into the upstream URL path (encoded)", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(200, {}))
    await GET(makeReq(), params("sess-abc-123"))
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${FAKE_BASE_URL}/api/admin/sessions/sess-abc-123`)
  })

  // ─── [3] Flag off → 404 ────────────────────────────────────────────
  it("[3] returns 404 when ONBOARDING_CONSOLE_ENABLED is off", async () => {
    vi.mocked(isOnboardingConsoleEnabled).mockReturnValue(false)
    const res = await GET(makeReq(), params("sess-abc-123"))
    expect(res.status).toBe(404)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ─── [4] OCA 404 → pass through ────────────────────────────────────
  it("[4] OCA 404 (stale id) passes through as 404", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(404, { error: "Session not found" }))
    const res = await GET(makeReq(), params("sess-missing"))
    expect(res.status).toBe(404)
  })

  // ─── [5] OCA 401 → 403 not_authorized ──────────────────────────────
  it("[5] OCA 401 → 403 not_authorized (same mapping as list route)", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(401, { error: "Unauthorized" }))
    const res = await GET(makeReq(), params("sess-abc-123"))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("not_authorized")
  })

  // ─── [6] x-operator-email from session ─────────────────────────────
  it("[6] injects x-operator-email from session", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(200, {}))
    await GET(makeReq(), params("sess-abc-123"))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["x-operator-email"]).toBe(OPERATOR_EMAIL)
    expect(headers["x-api-key"]).toBe(FAKE_API_KEY)
  })
})
