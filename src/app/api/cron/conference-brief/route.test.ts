/**
 * Integration tests for POST /api/cron/conference-brief — Sprint
 * Conference Brief.
 *
 * Verifies the auth gate + the runner orchestration end-to-end via
 * mocked Prisma + mocked Telegram fetch (no real HTTP egress, no
 * real DB).
 *
 * Test scenarios cover the matrix Vernon spec'd:
 *   - 401 without bearer
 *   - 401 with wrong bearer
 *   - 503 if CRON_SECRET unset (fail-closed)
 *   - 200 happy path: 3 conferences, 3 recipients, 3/3 delivered
 *   - 200 empty month (0 conferences)
 *   - 200 partial fail (1 of 3 telegram deliveries fails)
 *   - 200 missing recipient (email not in DB → missingRecipients)
 *   - Recipient with telegramChatId=null filtered out
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// vi.hoisted runs BEFORE the route module imports — captures the
// CRON_SECRET into the test value. Without this, the lazy
// `process.env.CRON_SECRET` read inside POST() would still see the
// test value at runtime; we set it here for symmetry with the
// /api/lemlist/enroll test pattern (Sprint S0.6) and to make the
// "unset" branch easy to exercise via `delete` per-test.
vi.hoisted(() => {
  process.env.CRON_SECRET = "test-cron-secret-32-bytes-deadbeef-cafe"
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conference: {
      findMany: vi.fn(),
    },
    employee: {
      findMany: vi.fn(),
    },
  },
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"

const SECRET = "test-cron-secret-32-bytes-deadbeef-cafe"

function makeReq(opts: { bearer?: string | null } = {}): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (opts.bearer === undefined) {
    headers.set("authorization", `Bearer ${SECRET}`)
  } else if (opts.bearer !== null) {
    headers.set("authorization", `Bearer ${opts.bearer}`)
  }
  return new Request("http://localhost/api/cron/conference-brief", {
    method: "POST",
    headers,
  })
}

const SAMPLE_CONFERENCES = [
  {
    name: "SiGMA Europe",
    location: "Ta' Qali",
    country: "Malta",
    startDate: new Date("2027-05-03T00:00:00Z"),
    endDate: new Date("2027-05-05T00:00:00Z"),
    description: "Premier gaming summit.",
    website: "https://sigma.world",
  },
  {
    name: "Token2049",
    location: "Dubaï",
    country: "UAE",
    startDate: new Date("2027-05-12T00:00:00Z"),
    endDate: new Date("2027-05-13T00:00:00Z"),
    description: "Largest digital asset conference.",
    website: null,
  },
  {
    name: "Family Office Forum",
    location: "Riyadh",
    country: "Saudi Arabia",
    startDate: new Date("2027-05-20T00:00:00Z"),
    endDate: null,
    description: null,
    website: null,
  },
]

const ALL_THREE_RECIPIENTS = [
  { email: "ad@oxen.finance", name: "Andy Dessy", telegramChatId: "111" },
  { email: "pg@oxen.finance", name: "Paul Garreau", telegramChatId: "222" },
  { email: "vd@oxen.finance", name: "Vernon Dessy", telegramChatId: "333" },
]

describe("POST /api/cron/conference-brief (Sprint Conference Brief)", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Restore CRON_SECRET (in case a previous test deleted it)
    process.env.CRON_SECRET = SECRET

    // Default: empty conference + empty recipient. Tests override.
    vi.mocked(prisma.conference.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never)

    // Default Telegram fetch — successful send
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof global.fetch
  })

  // ─── Auth ──────────────────────────────────────────────────────────
  it("[1] returns 401 when no bearer header is provided", async () => {
    const res = await POST(makeReq({ bearer: null }))
    expect(res.status).toBe(401)
    expect(prisma.conference.findMany).not.toHaveBeenCalled()
  })

  it("[2] returns 401 when bearer token is wrong", async () => {
    const res = await POST(makeReq({ bearer: "wrong-secret" }))
    expect(res.status).toBe(401)
    expect(prisma.conference.findMany).not.toHaveBeenCalled()
  })

  it("[3] returns 503 when CRON_SECRET is not configured (fail-closed)", async () => {
    delete process.env.CRON_SECRET
    const res = await POST(makeReq())
    expect(res.status).toBe(503)
    expect(prisma.conference.findMany).not.toHaveBeenCalled()
  })

  // ─── Happy path ────────────────────────────────────────────────────
  it("[4] happy path — 3 conferences × 3 recipients → 3/3 delivered", async () => {
    vi.mocked(prisma.conference.findMany).mockResolvedValue(
      SAMPLE_CONFERENCES as never,
    )
    vi.mocked(prisma.employee.findMany).mockResolvedValue(
      ALL_THREE_RECIPIENTS as never,
    )

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      success: true,
      conferenceCount: 3,
      recipientCount: 3,
      delivered: 3,
      failed: 0,
      missingRecipients: [],
    })
    expect(body.deliveries).toHaveLength(3)
    // 3 Telegram fetches were made
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  // ─── Empty month ──────────────────────────────────────────────────
  it("[5] empty month — 0 conferences but recipients still receive a brief", async () => {
    vi.mocked(prisma.conference.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.employee.findMany).mockResolvedValue(
      ALL_THREE_RECIPIENTS as never,
    )

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conferenceCount).toBe(0)
    expect(body.delivered).toBe(3)
    // The HTML sent should contain the "No conferences listed" fallback
    const fetchCall = vi.mocked(global.fetch).mock.calls[0]
    const requestBody = JSON.parse(
      (fetchCall[1] as RequestInit).body as string,
    )
    expect(requestBody.text).toContain("No conferences listed")
  })

  // ─── Partial failure ──────────────────────────────────────────────
  it("[6] partial fail — 1 of 3 deliveries fails → 200 with delivered=2 failed=1", async () => {
    vi.mocked(prisma.conference.findMany).mockResolvedValue(
      SAMPLE_CONFERENCES as never,
    )
    vi.mocked(prisma.employee.findMany).mockResolvedValue(
      ALL_THREE_RECIPIENTS as never,
    )

    // First 2 calls succeed, 3rd one returns Telegram-style failure
    let callIdx = 0
    global.fetch = vi.fn(async () => {
      callIdx++
      if (callIdx === 3) {
        return new Response(
          JSON.stringify({ ok: false, description: "chat not found" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        )
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof global.fetch

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.delivered).toBe(2)
    expect(body.failed).toBe(1)
    expect(body.deliveries).toHaveLength(3)
    const failed = body.deliveries.find(
      (d: { status: string }) => d.status === "failed",
    )
    expect(failed.error).toContain("chat not found")
  })

  // ─── Missing recipients ───────────────────────────────────────────
  it("[7] missing recipient — vd@ not in DB → reported in missingRecipients", async () => {
    vi.mocked(prisma.conference.findMany).mockResolvedValue([] as never)
    // Only 2 of the 3 default emails exist in DB
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { email: "ad@oxen.finance", name: "Andy Dessy", telegramChatId: "111" },
      { email: "pg@oxen.finance", name: "Paul Garreau", telegramChatId: "222" },
    ] as never)

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recipientCount).toBe(2)
    expect(body.delivered).toBe(2)
    expect(body.missingRecipients).toEqual(["vd@oxen.finance"])
  })

  it("[8] recipient with telegramChatId=null is filtered out and reported missing", async () => {
    vi.mocked(prisma.conference.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      { email: "ad@oxen.finance", name: "Andy Dessy", telegramChatId: "111" },
      { email: "pg@oxen.finance", name: "Paul Garreau", telegramChatId: null },
      { email: "vd@oxen.finance", name: "Vernon Dessy", telegramChatId: "333" },
    ] as never)

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recipientCount).toBe(2) // Andy + Vernon
    expect(body.delivered).toBe(2)
    expect(body.missingRecipients).toEqual(["pg@oxen.finance"])
  })

  // ─── Filter forwarding ────────────────────────────────────────────
  it("[9] forwards [monthStart, monthEnd) range + status filter to Prisma", async () => {
    vi.mocked(prisma.conference.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.employee.findMany).mockResolvedValue([] as never)

    await POST(makeReq())
    const callArg = vi.mocked(prisma.conference.findMany).mock.calls[0][0]!
    expect(callArg.where).toHaveProperty("startDate")
    expect(callArg.where).toMatchObject({
      status: { notIn: ["cancelled", "rejected"] },
    })
    expect(callArg.orderBy).toEqual({ startDate: "asc" })
  })

  // ─── Conference status filter (cancelled/rejected excluded) ──────
  it("[10] does NOT include cancelled or rejected conferences (status filter applied)", async () => {
    // The filter is applied at the Prisma layer (test [9] verifies);
    // here we just check the contract: if Prisma returns empty
    // (because status filter excluded everything), the brief still
    // emits the "no conferences listed" message instead of 500ing.
    vi.mocked(prisma.conference.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.employee.findMany).mockResolvedValue(
      ALL_THREE_RECIPIENTS as never,
    )

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conferenceCount).toBe(0)
    expect(body.delivered).toBe(3) // recipients still get the empty-month message
  })
})
