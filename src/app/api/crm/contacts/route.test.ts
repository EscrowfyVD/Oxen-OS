/**
 * Integration tests for GET /api/crm/contacts (Sprint S0.5 batch 2 —
 * Clay enrichment filters: group, painTier, persona).
 *
 * Verifies that Zod validates the new query params against the
 * CrmGroup / CrmPainTier / CrmPersona enums, and that the route
 * forwards valid values into the Prisma `where` clause.
 *
 * Mock strategy:
 *   - @/lib/prisma : full mock of crmContact (findMany + count)
 *   - @/lib/admin  : requirePageAccess → success
 *
 * The tests inspect the `where` argument actually passed to
 * prisma.crmContact.findMany — that's the boundary between the route
 * and the DB layer, so we don't need to mock more deeply.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

// requirePageAccess is referenced indirectly by the route. Lemlist module
// is imported by the route file; we don't mock it because GET doesn't
// touch Lemlist code paths, but we mock prisma globally so it cannot
// reach Lemlist's prisma usage either.

import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

function makeReq(qs: string) {
  const url = `http://localhost/api/crm/contacts${qs ? `?${qs}` : ""}`
  return new Request(url, { method: "GET" })
}

describe("GET /api/crm/contacts — Clay enrichment filters (Sprint S0.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: requirePageAccess returns success.
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
    // Default: empty result set.
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.crmContact.count).mockResolvedValue(0 as never)
  })

  it("forwards group=G1 to the Prisma where clause", async () => {
    const res = await GET(makeReq("group=G1"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({ group: "G1" })
  })

  it("forwards combined filters group=G1&painTier=T1&persona=DM", async () => {
    const res = await GET(makeReq("group=G1&painTier=T1&persona=DM"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({
      group: "G1",
      painTier: "T1",
      persona: "DM",
    })
  })

  it("does NOT add group/painTier/persona to where when absent", async () => {
    const res = await GET(makeReq(""))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(callArg.where).not.toHaveProperty("group")
    expect(callArg.where).not.toHaveProperty("painTier")
    expect(callArg.where).not.toHaveProperty("persona")
  })

  it("returns 400 on invalid group=INVALID (Zod enum miss)", async () => {
    const res = await GET(makeReq("group=INVALID"))
    expect(res.status).toBe(400)
    // Prisma should never be called when Zod fails upstream.
    expect(prisma.crmContact.findMany).not.toHaveBeenCalled()
  })

  it("returns 400 on invalid painTier=T9", async () => {
    const res = await GET(makeReq("painTier=T9"))
    expect(res.status).toBe(400)
    expect(prisma.crmContact.findMany).not.toHaveBeenCalled()
  })

  it("returns 400 on invalid persona=ROBOT", async () => {
    const res = await GET(makeReq("persona=ROBOT"))
    expect(res.status).toBe(400)
    expect(prisma.crmContact.findMany).not.toHaveBeenCalled()
  })

  it("accepts G7A and G7B (sub-grouped enum values)", async () => {
    const res = await GET(makeReq("group=G7B"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({ group: "G7B" })
  })

  it("preserves existing legacy filters alongside the new ones", async () => {
    const res = await GET(
      makeReq("group=G1&outreachGroup=group_1&lifecycleStage=new_lead"),
    )
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({
      group: "G1",
      outreachGroup: "group_1",
      lifecycleStage: "new_lead",
    })
  })
})
