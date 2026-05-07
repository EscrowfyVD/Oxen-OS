/**
 * Integration tests for GET /api/crm/contacts/list-for-push
 * (Sprint S0.6 Lemlist hardening — fixes the "Push all 597"
 * pagination footgun where the modal pushed only the page-50
 * current rows despite a UI label claiming the full filtered count).
 *
 * Verifies:
 *   - Filter forwarding to Prisma where clause (mirrors the
 *     /api/crm/contacts test patterns)
 *   - Hard cap at 5000 (count > cap → 400 with hint)
 *   - Server-side compliance pre-filtering (email NOT NULL,
 *     doNotContact=false) so the cap math counts only push-eligible
 *     rows
 *   - Auth required (requirePageAccess fail → propagated)
 *   - Response shape minimal (id, email, doNotContact, persona,
 *     fullName, companyName)
 *
 * Mock strategy mirrors the existing src/app/api/crm/contacts/
 * route.test.ts setup (Sprint S0.5 batch 2).
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

import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

function makeReq(qs: string) {
  const url = `http://localhost/api/crm/contacts/list-for-push${qs ? `?${qs}` : ""}`
  return new Request(url, { method: "GET" })
}

describe("GET /api/crm/contacts/list-for-push (Sprint S0.6 Lemlist hardening)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.crmContact.count).mockResolvedValue(0 as never)
  })

  // ─── Filter forwarding ─────────────────────────────────────────────
  it("forwards group=G1 + painTier=T1 + persona=DM to where clause", async () => {
    const res = await GET(makeReq("group=G1&painTier=T1&persona=DM"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({
      group: "G1",
      painTier: "T1",
      persona: "DM",
    })
  })

  it("preserves legacy filters alongside the new ones", async () => {
    const res = await GET(
      makeReq(
        `group=G1&geoZone=${encodeURIComponent("Middle East")}&dealOwner=${encodeURIComponent("Andy Dessy")}`,
      ),
    )
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({
      group: "G1",
      geoZone: "Middle East",
      dealOwner: "Andy Dessy",
    })
  })

  // ─── Compliance pre-filtering ─────────────────────────────────────
  it("always applies email NOT NULL + doNotContact=false at SQL layer", async () => {
    const res = await GET(makeReq(""))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(callArg.where).toHaveProperty("AND")
    const andConds = (callArg.where as { AND: Array<Record<string, unknown>> }).AND
    expect(andConds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: { not: null } }),
        expect.objectContaining({ doNotContact: false }),
      ]),
    )
  })

  it("compliance pre-filter still applies when other filters are set", async () => {
    await GET(makeReq("group=G1"))
    const callArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    // Both the AND compliance filter AND the group filter present
    expect(callArg.where).toHaveProperty("AND")
    expect(callArg.where).toMatchObject({ group: "G1" })
  })

  // ─── Cap behavior ──────────────────────────────────────────────────
  it("returns 400 when filtered count exceeds the 5000 cap", async () => {
    vi.mocked(prisma.crmContact.count).mockResolvedValue(5001 as never)
    const res = await GET(makeReq(""))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Filter too broad")
    expect(body.details).toMatchObject({ total: 5001, cap: 5000 })
    expect(body.details.hint).toContain("Narrow the filter")
    // findMany must NOT have been called (cap short-circuits)
    expect(prisma.crmContact.findMany).not.toHaveBeenCalled()
  })

  it("allows a count of exactly 5000 (boundary)", async () => {
    vi.mocked(prisma.crmContact.count).mockResolvedValue(5000 as never)
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    const res = await GET(makeReq(""))
    expect(res.status).toBe(200)
    expect(prisma.crmContact.findMany).toHaveBeenCalledTimes(1)
  })

  // ─── Auth ──────────────────────────────────────────────────────────
  it("propagates the requirePageAccess error response", async () => {
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: new Response("Forbidden", { status: 403 }),
    } as never)
    const res = await GET(makeReq(""))
    expect(res.status).toBe(403)
    expect(prisma.crmContact.count).not.toHaveBeenCalled()
  })

  // ─── Response shape ────────────────────────────────────────────────
  it("returns the minimal shape: id, email, doNotContact, persona, fullName, companyName", async () => {
    vi.mocked(prisma.crmContact.count).mockResolvedValue(2 as never)
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      {
        id: "ct-1",
        email: "alice@example.com",
        doNotContact: false,
        persona: "DM",
        firstName: "Alice",
        lastName: "Smith",
        company: { name: "Acme Corp" },
      },
      {
        id: "ct-2",
        email: "bob@example.com",
        doNotContact: false,
        persona: "OP",
        firstName: "Bob",
        lastName: "Jones",
        company: null,
      },
    ] as never)

    const res = await GET(makeReq(""))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.contacts).toEqual([
      {
        id: "ct-1",
        email: "alice@example.com",
        doNotContact: false,
        persona: "DM",
        fullName: "Alice Smith",
        companyName: "Acme Corp",
      },
      {
        id: "ct-2",
        email: "bob@example.com",
        doNotContact: false,
        persona: "OP",
        fullName: "Bob Jones",
        companyName: null,
      },
    ])
  })

  // ─── Zod validation ───────────────────────────────────────────────
  it("returns 400 on invalid group enum (Zod miss)", async () => {
    const res = await GET(makeReq("group=INVALID"))
    expect(res.status).toBe(400)
    expect(prisma.crmContact.count).not.toHaveBeenCalled()
    expect(prisma.crmContact.findMany).not.toHaveBeenCalled()
  })

  it("returns 400 on invalid persona enum", async () => {
    const res = await GET(makeReq("persona=ROBOT"))
    expect(res.status).toBe(400)
    expect(prisma.crmContact.count).not.toHaveBeenCalled()
  })
})
