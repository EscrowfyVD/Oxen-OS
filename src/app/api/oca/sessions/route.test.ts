/**
 * Tests for GET /api/oca/sessions (SP16-002 Slice 2).
 *
 * Mock strategy:
 *   - @/lib/admin           : requirePageAccess → success / 403 per case
 *   - @/lib/onboarding/feature-flag : isOnboardingConsoleEnabled toggled per case
 *   - global fetch          : vi.spyOn(globalThis, "fetch") to stub OCA upstream
 *                             (no real network reach)
 *
 * Coverage targets (per EXEC Slice 2 brief):
 *   [1] Happy path — OCA returns 200 with data, proxy passes through
 *   [2] Flag off → 404
 *   [3] Access denied (requirePageAccess fails)
 *   [4] x-operator-email injected from session (NOT inbound request)
 *   [5] x-operator-email cannot be overridden by inbound request header
 *   [6] OCA 401 → 403 not_authorized (recognizable error shape)
 *   [7] OCA unreachable (fetch throws) → 502 oca_unreachable
 *   [8] Env not configured → 500 oca_not_configured
 *   [9] Query params forwarded verbatim
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

function makeReq(qs = "", extraHeaders: Record<string, string> = {}) {
  const url = `http://localhost/api/oca/sessions${qs ? `?${qs}` : ""}`
  return new Request(url, { method: "GET", headers: extraHeaders })
}

function mockOcaResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("GET /api/oca/sessions", () => {
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
    // Defaults: flag ON, access granted with session email present.
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
  it("[1] happy path: proxies OCA 200 + data verbatim", async () => {
    fetchSpy.mockResolvedValue(
      mockOcaResponse(200, {
        data: [{ id: "sess-1", status: "active" }],
        total: 1,
        page: 1,
        limit: 20,
      }),
    )
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  // ─── [2] Flag off → 404 ────────────────────────────────────────────
  it("[2] returns 404 when ONBOARDING_CONSOLE_ENABLED is off", async () => {
    vi.mocked(isOnboardingConsoleEnabled).mockReturnValue(false)
    const res = await GET(makeReq())
    expect(res.status).toBe(404)
    // No upstream call should have been attempted.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ─── [3] Access denied ─────────────────────────────────────────────
  it("[3] forwards 403 when requirePageAccess refuses", async () => {
    const { NextResponse } = await import("next/server")
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
      employee: null,
      roleLevel: null,
    } as never)
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ─── [4] x-operator-email from session ─────────────────────────────
  it("[4] injects x-operator-email from session (not request)", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(200, { data: [], total: 0, page: 1, limit: 20 }))
    await GET(makeReq())
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["x-operator-email"]).toBe(OPERATOR_EMAIL)
    expect(headers["x-api-key"]).toBe(FAKE_API_KEY)
  })

  // ─── [5] x-operator-email cannot be overridden ─────────────────────
  it("[5] ignores inbound x-operator-email header (cannot be forged)", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(200, { data: [], total: 0, page: 1, limit: 20 }))
    // Caller tries to set their own email — must be discarded.
    await GET(makeReq("", { "x-operator-email": "attacker@evil.com" }))
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["x-operator-email"]).toBe(OPERATOR_EMAIL)
    expect(headers["x-operator-email"]).not.toBe("attacker@evil.com")
  })

  // ─── [6] OCA 401 → 403 not_authorized ──────────────────────────────
  it("[6] OCA 401 → 403 with not_authorized error shape", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(401, { error: "Unauthorized" }))
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("not_authorized")
    expect(body.message).toMatch(/OPERATOR_ALLOWLIST_EMAILS/)
  })

  // ─── [7] OCA unreachable ───────────────────────────────────────────
  it("[7] OCA unreachable (fetch throws) → 502 oca_unreachable", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"))
    const res = await GET(makeReq())
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe("oca_unreachable")
  })

  // ─── [8] Env not configured ────────────────────────────────────────
  it("[8] returns 500 oca_not_configured when env vars are unset", async () => {
    const savedBase = process.env.OCA_API_BASE_URL
    delete process.env.OCA_API_BASE_URL
    const res = await GET(makeReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("oca_not_configured")
    process.env.OCA_API_BASE_URL = savedBase
  })

  // ─── [9] Query params forwarded ────────────────────────────────────
  it("[9] forwards query params verbatim to upstream URL", async () => {
    fetchSpy.mockResolvedValue(mockOcaResponse(200, { data: [], total: 0, page: 2, limit: 50 }))
    await GET(makeReq("platform=escrowfy&status=active,review&page=2&limit=50"))
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/api/admin/sessions")
    expect(url).toContain("platform=escrowfy")
    expect(url).toContain("status=active%2Creview") // URLSearchParams encodes comma
    expect(url).toContain("page=2")
    expect(url).toContain("limit=50")
  })
})
