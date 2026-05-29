/**
 * Tests for POST /api/scoring/recalculate-all (Sprint 3c B5).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/admin", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/scoring/score-recompute-runner", () => ({
  runScoreRecompute: vi.fn(),
}))

import { POST } from "./route"
import { requireAdmin } from "@/lib/admin"
import { runScoreRecompute } from "@/lib/scoring/score-recompute-runner"

function makeReq() {
  return new Request("http://localhost/api/scoring/recalculate-all", {
    method: "POST",
  })
}

describe("POST /api/scoring/recalculate-all", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({
      error: null,
      session: { user: { email: "vd@oxen.finance" } },
      employee: { id: "emp-1", email: "vd@oxen.finance", isAdmin: true },
    } as never)
  })

  it("[1] 403 when not admin", async () => {
    const { NextResponse } = await import("next/server")
    vi.mocked(requireAdmin).mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
      employee: null,
    } as never)
    const res = await POST(makeReq())
    expect(res.status).toBe(403)
  })

  it("[2] 200 + runner result on admin", async () => {
    vi.mocked(runScoreRecompute).mockResolvedValue({
      processed: 10,
      promoted: 1,
      errors: [],
    })
    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(10)
    expect(body.promoted).toBe(1)
    expect(typeof body.durationMs).toBe("number")
  })

  it("[3] 500 when runner throws", async () => {
    vi.mocked(runScoreRecompute).mockRejectedValue(new Error("DB outage"))
    const res = await POST(makeReq())
    expect(res.status).toBe(500)
  })
})
