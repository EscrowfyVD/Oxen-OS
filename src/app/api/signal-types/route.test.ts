/**
 * Tests for GET /api/signal-types (Sprint Intent Feed UI V1).
 *
 * Mock strategy mirrors /api/crm/contacts/route.test.ts pattern.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    signalTypeRegistry: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

function makeReq() {
  return new Request("http://localhost/api/signal-types", { method: "GET" })
}

describe("GET /api/signal-types", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
  })

  it("[1] returns only active SignalTypeRegistry rows", async () => {
    vi.mocked(prisma.signalTypeRegistry.findMany).mockResolvedValue([
      { code: "clay_business_loss", label: "Clay — Business Loss", category: "INTENT", defaultPoints: 10 },
      { code: "trigify_competitor_engagement", label: "Trigify — Competitor", category: "INTENT", defaultPoints: 6 },
    ] as never)

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.signal_types).toHaveLength(2)

    const findManyArg = vi.mocked(prisma.signalTypeRegistry.findMany).mock.calls[0][0]!
    expect(findManyArg.where).toEqual({ isActive: true })
  })

  it("[2] sorts results by code ASC at the Prisma layer", async () => {
    vi.mocked(prisma.signalTypeRegistry.findMany).mockResolvedValue([] as never)

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const findManyArg = vi.mocked(prisma.signalTypeRegistry.findMany).mock.calls[0][0]!
    expect(findManyArg.orderBy).toEqual({ code: "asc" })
  })
})
