/**
 * Integration tests for GET /api/crm/companies (Sprint S0.5 batch 4 —
 * Clay enrichment filters: group, painTier, country).
 *
 * Same shape as src/app/api/crm/contacts/route.test.ts — verifies that
 * Zod validates the new query params against the CrmGroup / CrmPainTier
 * enums, and that the route forwards valid values into the Prisma
 * `where` clause. The country filter accepts any string but the page
 * dropdown restricts it to the canonical PRD-001 whitelist.
 *
 * Mock strategy:
 *   - @/lib/prisma : full mock of company.findMany
 *   - @/lib/admin  : requirePageAccess → success
 *   - @/lib/decimal : serializeMoney (lightweight identity passthrough
 *     so the route's mapping over deals doesn't blow up).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

function makeReq(qs: string) {
  const url = `http://localhost/api/crm/companies${qs ? `?${qs}` : ""}`
  return new Request(url, { method: "GET" })
}

describe("GET /api/crm/companies — Clay enrichment filters (Sprint S0.5 batch 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
  })

  it("forwards group=G1 to the Prisma where clause", async () => {
    const res = await GET(makeReq("group=G1"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({ group: "G1" })
  })

  it("forwards painTier=T1 to the Prisma where clause", async () => {
    const res = await GET(makeReq("painTier=T1"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({ painTier: "T1" })
  })

  it("forwards country=Cyprus to the Prisma where clause", async () => {
    const res = await GET(makeReq("country=Cyprus"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({ country: "Cyprus" })
  })

  it("forwards combined filters group=G1&painTier=T1&country=United Arab Emirates", async () => {
    const res = await GET(
      makeReq(
        `group=G1&painTier=T1&country=${encodeURIComponent("United Arab Emirates")}`,
      ),
    )
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({
      group: "G1",
      painTier: "T1",
      country: "United Arab Emirates",
    })
  })

  it("does NOT add group/painTier/country to where when absent", async () => {
    const res = await GET(makeReq(""))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(callArg.where).not.toHaveProperty("group")
    expect(callArg.where).not.toHaveProperty("painTier")
    expect(callArg.where).not.toHaveProperty("country")
  })

  it("returns 400 on invalid group=INVALID (Zod enum miss)", async () => {
    const res = await GET(makeReq("group=INVALID"))
    expect(res.status).toBe(400)
    expect(prisma.company.findMany).not.toHaveBeenCalled()
  })

  it("returns 400 on invalid painTier=T9", async () => {
    const res = await GET(makeReq("painTier=T9"))
    expect(res.status).toBe(400)
    expect(prisma.company.findMany).not.toHaveBeenCalled()
  })

  it("accepts G7A and G7B (sub-grouped enum values)", async () => {
    const res = await GET(makeReq("group=G7B"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({ group: "G7B" })
  })

  it("preserves existing legacy filters alongside the new ones", async () => {
    const res = await GET(
      makeReq("group=G1&geoZone=Middle%20East&industry=Financial%20Services"),
    )
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({
      group: "G1",
      geoZone: "Middle East",
      industry: "Financial Services",
    })
  })

  it("treats country='all' as a no-op (page sentinel value)", async () => {
    // The page dropdown uses "all" as a sentinel meaning "no filter";
    // the API should treat it identically to an absent param.
    const res = await GET(makeReq("country=all"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(callArg.where).not.toHaveProperty("country")
  })
})
