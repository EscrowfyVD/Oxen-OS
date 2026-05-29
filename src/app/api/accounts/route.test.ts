/**
 * Integration tests for GET /api/accounts (Sprint 3d B5).
 *
 * Mock @/lib/prisma at the model layer and @/lib/admin for auth;
 * tests inspect the shape of `where` arguments and the union
 * response — that's the boundary between route + DB + auth.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: { findMany: vi.fn() },
    crmContact: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/admin", () => ({
  requirePageAccess: vi.fn(),
}))

import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

const SECRET = "test_accounts_secret_b5"

function makeReq(qs: string, opts: { bearer?: string } = {}) {
  const headers: Record<string, string> = {}
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`
  return new Request(`http://localhost/api/accounts${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers,
  })
}

describe("GET /api/accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SIGNALS_INGESTION_SECRET = SECRET
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
  })

  // ─── [1] ILIKE on Company.name ──────────────────────────────────
  it("[1] returns company hits matching ILIKE on Company.name", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "co-1", name: "Acme Trust", country: "Cyprus" },
    ] as never)

    const res = await GET(makeReq("q=Acme"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.results).toHaveLength(1)
    expect(body.results[0]).toMatchObject({
      kind: "company",
      id: "co-1",
      displayName: "Acme Trust",
      jurisdiction: "Cyprus",
    })

    const whereArg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(whereArg.where).toEqual({
      name: { contains: "Acme", mode: "insensitive" },
    })
  })

  // ─── [2] ILIKE on CrmContact.email ──────────────────────────────
  it("[2] returns contact hits matching ILIKE on email/name", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      {
        id: "ct-1",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@acme.com",
        country: null,
        company: { country: "Singapore" },
      },
    ] as never)

    const res = await GET(makeReq("q=alice"))
    const body = await res.json()
    expect(body.results[0]).toMatchObject({
      kind: "contact",
      id: "ct-1",
      displayName: "Alice Smith",
      jurisdiction: "Singapore",
      email: "alice@acme.com",
    })

    const whereArg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(whereArg.where).toMatchObject({
      OR: [
        { email: { contains: "alice", mode: "insensitive" } },
        { firstName: { contains: "alice", mode: "insensitive" } },
        { lastName: { contains: "alice", mode: "insensitive" } },
      ],
    })
  })

  // ─── [3] Tiered scoring: exact > starts-with > contains ────────
  it("[3] sorts hits by score (exact > starts-with > contains)", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "co-contains", name: "Big Acme Holdings", country: null }, // contains
      { id: "co-starts",   name: "Acme Capital",       country: null }, // starts-with
      { id: "co-exact",    name: "Acme",                country: null }, // exact
    ] as never)

    const res = await GET(makeReq("q=Acme"))
    const body = await res.json()
    const ids = body.results.map((r: { id: string }) => r.id)
    expect(ids).toEqual(["co-exact", "co-starts", "co-contains"])
    expect(body.results[0].score).toBe(90)
    expect(body.results[1].score).toBe(70)
    expect(body.results[2].score).toBe(40)
  })

  // ─── [4] Auth gate — bad Bearer rejected ───────────────────────
  it("[4] rejects with 401 when Bearer token is wrong", async () => {
    const res = await GET(makeReq("q=Acme", { bearer: "wrong_secret" }))
    expect(res.status).toBe(401)
    // Session fallback was NOT consulted on bearer mismatch (security).
    expect(requirePageAccess).not.toHaveBeenCalled()
  })

  // ─── [5] Response shape = union {kind, id, displayName, score} ─
  it("[5] union response covers both kinds with the agreed shape", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      // exact name match on "Acme" → 90
      { id: "co-1", name: "Acme", country: "Cyprus" },
    ] as never)
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      // email starts with "acme" → 70
      {
        id: "ct-1",
        firstName: "Bob",
        lastName: "Roe",
        email: "acme.support@example.com",
        country: null,
        company: { country: "Cyprus" },
      },
    ] as never)

    const res = await GET(makeReq("q=Acme"))
    const body = await res.json()
    expect(body.results).toHaveLength(2)

    // Every hit has the union shape — D8.
    for (const hit of body.results) {
      expect(hit).toHaveProperty("kind")
      expect(hit).toHaveProperty("id")
      expect(hit).toHaveProperty("displayName")
      expect(hit).toHaveProperty("score")
      expect(["company", "contact"]).toContain(hit.kind)
    }

    // Company exact-name (90) beats contact email-starts-with (70).
    expect(body.results[0]).toMatchObject({ kind: "company", score: 90 })
    expect(body.results[1]).toMatchObject({ kind: "contact", score: 70 })
  })
})
