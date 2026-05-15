/**
 * Tests for POST /api/intent-feed/[id]/action (Sprint Intent Feed V1).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intentSignal: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

function makeReq(id: string, body: unknown) {
  return new Request(`http://localhost/api/intent-feed/${id}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe("POST /api/intent-feed/[id]/action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
  })

  // ─── [1] Success path ──────────────────────────────────────────────
  it("[1] mark_actioned: 200 + writes actioned_at/by into metadata JSON", async () => {
    vi.mocked(prisma.intentSignal.findUnique).mockResolvedValue({
      id: "sig-1",
      metadata: { foo: "bar" },
    } as never)
    vi.mocked(prisma.intentSignal.update).mockResolvedValue({} as never)

    const res = await POST(makeReq("sig-1", { type: "mark_actioned" }), params("sig-1"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.signal_id).toBe("sig-1")
    expect(body.actioned_by).toBe("andy@oxen.finance")
    expect(typeof body.actioned_at).toBe("string")

    // The update call must preserve existing metadata + add new fields.
    const updateArg = vi.mocked(prisma.intentSignal.update).mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: "sig-1" })
    expect(updateArg.data.metadata).toMatchObject({
      foo: "bar",
      actioned_by: "andy@oxen.finance",
    })
  })

  // ─── [2] 404 when signal missing ───────────────────────────────────
  it("[2] returns 404 if signal not found", async () => {
    vi.mocked(prisma.intentSignal.findUnique).mockResolvedValue(null as never)

    const res = await POST(makeReq("sig-missing", { type: "mark_actioned" }), params("sig-missing"))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Signal not found")
  })

  // ─── [3] 401 when not authenticated ────────────────────────────────
  it("[3] returns 401 when not authenticated", async () => {
    // requirePageAccess returns a 401 NextResponse in its `error` field.
    const { NextResponse } = await import("next/server")
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
      employee: null,
      roleLevel: null,
    } as never)

    const res = await POST(makeReq("sig-1", { type: "mark_actioned" }), params("sig-1"))
    expect(res.status).toBe(401)
  })
})
