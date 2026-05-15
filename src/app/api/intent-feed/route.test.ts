/**
 * Integration tests for GET /api/intent-feed (Sprint Intent Feed UI V1).
 *
 * Mock strategy follows the pattern from
 * src/app/api/crm/contacts/route.test.ts:
 *   - @/lib/prisma : intentSignal { findMany, count }
 *   - @/lib/admin  : requirePageAccess → success by default
 *
 * Tests inspect the `where` argument actually passed to
 * prisma.intentSignal.findMany — that's the boundary between the route
 * and the DB layer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intentSignal: {
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
  const url = `http://localhost/api/intent-feed${qs ? `?${qs}` : ""}`
  return new Request(url, { method: "GET" })
}

/**
 * Build a single fake row matching the eager-loaded include shape.
 * Each row supplies `signalTypeRef` because the route relies on it
 * for formatting (label + decay). Defaults keep tests succinct;
 * overrides let individual cases tweak only what they care about.
 */
function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sig-1",
    source: "trigify",
    signalType: "competitor_engagement",
    title: "Trigify — Competitor Engagement",
    detail: "Liked competitor post",
    points: 6,
    decayedPoints: null,
    expiresAt: null,
    metadata: null,
    sourceUrl: null,
    createdAt: new Date("2026-05-14T12:00:00Z"),
    contactId: "ct-1",
    companyId: null,
    contact: {
      id: "ct-1",
      firstName: "JP",
      lastName: "Chetcuti",
      email: "jp@inter-serv.com",
      jobTitle: "CEO",
      linkedinUrl: "https://linkedin.com/in/jp",
      group: "G1",
      painTier: "T1",
      persona: "DM",
      company: { id: "co-1", name: "Inter-Serv", country: "Malta" },
    },
    company: null,
    signalTypeRef: {
      id: "reg-1",
      code: "trigify_competitor_engagement",
      label: "Trigify — Competitor Engagement",
      category: "INTENT",
      defaultPoints: 6,
      decayDays: 60,
    },
    ...overrides,
  }
}

describe("GET /api/intent-feed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePageAccess).mockResolvedValue({
      error: null,
      session: { user: { email: "andy@oxen.finance" } },
      employee: null,
      roleLevel: "admin",
    } as never)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(0 as never)
  })

  // ─── [1] Empty filters ─────────────────────────────────────────────
  it("[1] returns paginated signals with empty filters", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      fakeRow(),
    ] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(1 as never)

    const res = await GET(makeReq(""))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.signals).toHaveLength(1)
    expect(body.signals[0].id).toBe("sig-1")
    expect(body.signals[0].contact.name).toBe("JP Chetcuti")
    expect(body.signals[0].company.name).toBe("Inter-Serv")
    expect(body.pagination).toMatchObject({
      limit: 50,
      offset: 0,
      total: 1,
      hasMore: false,
    })
  })

  // ─── [2] Source filter ─────────────────────────────────────────────
  it("[2] forwards source=trigify to the Prisma where clause", async () => {
    const res = await GET(makeReq("source=trigify"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({ source: "trigify" })
  })

  // ─── [3] Date range filter ─────────────────────────────────────────
  it("[3] forwards date_from + date_to as createdAt range", async () => {
    const res = await GET(
      makeReq("date_from=2026-05-01T00:00:00Z&date_to=2026-05-15T23:59:59Z"),
    )
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!
    expect(callArg.where).toHaveProperty("createdAt")
    expect((callArg.where as { createdAt: { gte: Date; lte: Date } }).createdAt.gte).toBeInstanceOf(Date)
    expect((callArg.where as { createdAt: { gte: Date; lte: Date } }).createdAt.lte).toBeInstanceOf(Date)
  })

  // ─── [4] Status unactioned ─────────────────────────────────────────
  it("[4] forwards status=unactioned as metadata.actioned_at IS NULL filter", async () => {
    const res = await GET(makeReq("status=unactioned"))
    expect(res.status).toBe(200)
    const callArg = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({
      metadata: { path: ["actioned_at"], equals: Prisma.JsonNull },
    })
  })

  // ─── [5] proxy_score sort branch ───────────────────────────────────
  it("[5] sort=proxy_score_desc sorts in-memory and respects pagination", async () => {
    // 3 rows with the same points but different timestamps.
    // Recency boost will order them: newest first (1.5x), 5d (1.0x), 30d (0.7x).
    const now = new Date("2026-05-15T12:00:00Z")
    vi.setSystemTime(now)

    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      fakeRow({ id: "sig-old", points: 10, createdAt: new Date("2026-04-15T12:00:00Z") }), // 30d → 0.7x = 7
      fakeRow({ id: "sig-mid", points: 10, createdAt: new Date("2026-05-10T12:00:00Z") }), // 5d → 1.0x = 10
      fakeRow({ id: "sig-new", points: 10, createdAt: new Date("2026-05-15T08:00:00Z") }), // <24h → 1.5x = 15
    ] as never)

    const res = await GET(makeReq("sort=proxy_score_desc"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.signals.map((s: { id: string }) => s.id)).toEqual([
      "sig-new",
      "sig-mid",
      "sig-old",
    ])
    vi.useRealTimers()
  })

  // ─── [6] Pagination hasMore ────────────────────────────────────────
  it("[6] pagination.hasMore=true when total > offset + page", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      fakeRow({ id: "sig-1" }),
    ] as never)
    vi.mocked(prisma.intentSignal.count).mockResolvedValue(100 as never)

    const res = await GET(makeReq("limit=1&offset=0"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pagination.total).toBe(100)
    expect(body.pagination.hasMore).toBe(true)
  })

  // ─── [7] hot_only branch ───────────────────────────────────────────
  it("[7] hot_only=1 filters out cold signals in-memory", async () => {
    const now = new Date("2026-05-15T12:00:00Z")
    vi.setSystemTime(now)

    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      // 30pt × 1.5 = 45 (hot, > 7 threshold)
      fakeRow({ id: "hot-sig", points: 30, createdAt: new Date("2026-05-15T08:00:00Z") }),
      // 3pt × 1.5 = 4.5 (cold, ≤ 7 threshold)
      fakeRow({ id: "cold-sig", points: 3, createdAt: new Date("2026-05-15T08:00:00Z") }),
    ] as never)

    const res = await GET(makeReq("hot_only=1"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.signals).toHaveLength(1)
    expect(body.signals[0].id).toBe("hot-sig")
    vi.useRealTimers()
  })
})
