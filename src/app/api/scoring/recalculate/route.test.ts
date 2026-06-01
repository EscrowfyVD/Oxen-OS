/**
 * Tests for POST /api/scoring/recalculate (Sprint 3c B5).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/admin", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/scoring/config-loader", () => ({
  getActiveScoringConfigWithVersion: vi.fn(),
}))

vi.mock("@/lib/scoring/persist-score", () => ({
  persistScore: vi.fn(),
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { getActiveScoringConfigWithVersion } from "@/lib/scoring/config-loader"
import { persistScore } from "@/lib/scoring/persist-score"
import { buildScoringConfigV1 } from "../../../../../scripts/db/seed-scoring-config"

function makeReq(body: unknown) {
  return new Request("http://localhost/api/scoring/recalculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/scoring/recalculate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({
      error: null,
      session: { user: { email: "vd@oxen.finance" } },
      employee: { id: "emp-1", email: "vd@oxen.finance", isAdmin: true },
    } as never)
    vi.mocked(getActiveScoringConfigWithVersion).mockResolvedValue({
      config: buildScoringConfigV1(),
      version: 2,
    })
  })

  it("[1] 403 when not admin (requireAdmin returns error)", async () => {
    const { NextResponse } = await import("next/server")
    vi.mocked(requireAdmin).mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
      employee: null,
    } as never)
    const res = await POST(makeReq({ accountId: "ct-x" }))
    expect(res.status).toBe(403)
  })

  it("[2] 404 when contact not found", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(null)
    const res = await POST(makeReq({ accountId: "ct-missing" }))
    expect(res.status).toBe(404)
    expect(persistScore).not.toHaveBeenCalled()
  })

  it("[3] 200 + before/after on success", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
      id: "ct-x",
      priorityScore: 20,
      priorityLevel: "Monitor",
      icpScore: 20,
      intentScore: 0,
      signalCount: 0,
      painTier: null,
      lastScoredAt: null,
    } as never)
    vi.mocked(persistScore).mockResolvedValue({
      accountId: "ct-x",
      accountType: "contact",
      previousLevel: "Monitor",
      newLevel: "P3",
      promoted: true,
      icpScore: 40,
      intentScore: 5,
      priorityScore: 45,
      signalCount: 2,
      painTier: null,
      excluded: false,
      actions: [],
    } as never)
    const res = await POST(makeReq({ accountId: "ct-x" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accountId).toBe("ct-x")
    expect(body.before.priorityLevel).toBe("Monitor")
    expect(body.after.priorityLevel).toBe("P3")
    expect(body.after.promoted).toBe(true)
    expect(typeof body.durationMs).toBe("number")
    // Version threads from the loader into persistScore (Finding 1).
    expect(persistScore).toHaveBeenCalledWith(
      "ct-x",
      "contact",
      expect.anything(),
      2,
    )
  })

  it("[4] 400 on invalid body", async () => {
    const res = await POST(makeReq({ wrong: "shape" }))
    expect(res.status).toBe(400)
  })
})
