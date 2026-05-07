/**
 * Integration tests for POST /api/cron/signal-decay — Sprint
 * Activate Signal Decay.
 *
 * Verifies the auth gate + the runner orchestration end-to-end via
 * mocked Prisma (no real DB). The runner's per-table behavior is
 * already covered by signal-decay-runner.test.ts (10 tests including
 * idempotency, chunking, mixed curves) — these tests focus on the
 * route's contract: auth gates + JSON response shape + that the
 * runner is actually invoked.
 *
 * Test scenarios (mirror of conference-brief route tests):
 *   - 401 without bearer
 *   - 401 with wrong bearer
 *   - 503 if CRON_SECRET unset (fail-closed)
 *   - 200 happy path: signals exist → recomputed counts cohérents
 *   - 200 empty DB: 0 signals → success: true, totalUpdated: 0
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// vi.hoisted runs BEFORE the route module imports — captures
// CRON_SECRET into the test value. Same pattern as
// /api/cron/conference-brief/route.test.ts (commit 8b0a785).
vi.hoisted(() => {
  process.env.CRON_SECRET = "test-cron-secret-32-bytes-deadbeef-cafe"
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intentSignal: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    marketSignal: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
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
  return new Request("http://localhost/api/cron/signal-decay", {
    method: "POST",
    headers,
  })
}

const ANCHOR = new Date("2026-01-01T00:00:00Z")

describe("POST /api/cron/signal-decay (Sprint Activate Signal Decay)", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Restore CRON_SECRET (in case a previous test deleted it)
    process.env.CRON_SECRET = SECRET

    // Default: empty tables. Tests override.
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.marketSignal.findMany).mockResolvedValue([] as never)
    // $transaction default — function form: just await the callback
    // with a tx proxy that delegates back to the mocked update spies.
    vi.mocked(prisma.$transaction).mockImplementation(
      (async (
        arg: ((tx: unknown) => Promise<unknown>) | unknown[],
      ) => {
        if (typeof arg === "function") {
          return arg({
            intentSignal: { update: prisma.intentSignal.update },
            marketSignal: { update: prisma.marketSignal.update },
          })
        }
        return Promise.all(arg as unknown[])
      }) as never,
    )
  })

  // ─── Auth ──────────────────────────────────────────────────────────
  it("[1] returns 401 when no bearer header is provided", async () => {
    const res = await POST(makeReq({ bearer: null }))
    expect(res.status).toBe(401)
    expect(prisma.intentSignal.findMany).not.toHaveBeenCalled()
    expect(prisma.marketSignal.findMany).not.toHaveBeenCalled()
  })

  it("[2] returns 401 when bearer token is wrong", async () => {
    const res = await POST(makeReq({ bearer: "wrong-secret" }))
    expect(res.status).toBe(401)
    expect(prisma.intentSignal.findMany).not.toHaveBeenCalled()
  })

  it("[3] returns 503 when CRON_SECRET is not configured (fail-closed)", async () => {
    delete process.env.CRON_SECRET
    const res = await POST(makeReq())
    expect(res.status).toBe(503)
    expect(prisma.intentSignal.findMany).not.toHaveBeenCalled()
  })

  // ─── Happy path ────────────────────────────────────────────────────
  it("[4] happy path — 1 intent + 1 market stale signal → 2 updates", async () => {
    // 1 IntentSignal at 100 pts / LINEAR / 90 days, 45 days elapsed
    // → expected decayedPoints = 50 (currently stored as 100 = stale)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValueOnce([
      {
        id: "sig-i-1",
        points: 100,
        decayedPoints: 100,
        createdAt: ANCHOR,
        expiresAt: null,
        signalTypeRef: { decayDays: 90, decayCurve: "LINEAR" },
      },
    ] as never)
    // 1 MarketSignal at 50 pts / STEP / 180 days, 90 days elapsed
    // → STEP at ratio 0.5 = 50% tier → 25 (currently stored as 50)
    vi.mocked(prisma.marketSignal.findMany).mockResolvedValueOnce([
      {
        id: "msig-m-1",
        points: 50,
        decayedPoints: 50,
        occurredAt: ANCHOR,
        expiresAt: null,
        signalTypeRef: { decayDays: 180, decayCurve: "STEP" },
      },
    ] as never)

    // Stub second findMany page to return [] so the cursor loop terminates.
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.marketSignal.findMany).mockResolvedValue([] as never)

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      success: true,
      intent: { scanned: 1, updated: 1 },
      market: { scanned: 1, updated: 1 },
      totalScanned: 2,
      totalUpdated: 2,
    })
    expect(typeof body.startedAt).toBe("string")
    expect(typeof body.finishedAt).toBe("string")
    expect(typeof body.durationMs).toBe("number")
  })

  // ─── Empty DB ──────────────────────────────────────────────────────
  it("[5] empty DB — 0 signals → success: true, totalUpdated: 0", async () => {
    // Defaults from beforeEach are empty arrays.
    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      success: true,
      intent: {
        scanned: 0,
        updated: 0,
        skippedUnchanged: 0,
        skippedTerminal: 0,
      },
      market: {
        scanned: 0,
        updated: 0,
        skippedUnchanged: 0,
        skippedTerminal: 0,
      },
      totalScanned: 0,
      totalUpdated: 0,
    })
    // No transaction was opened — no rows to update
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // ─── Idempotency ──────────────────────────────────────────────────
  it("[6] idempotent — terminal-state row is skipped (no transaction opened)", async () => {
    // Use the terminal-state fast path: expiresAt in the past +
    // decayedPoints already 0 → skipped without recomputing math.
    // Deterministic regardless of the runner's `new Date()` since
    // any plausible `now` is past the expiresAt below.
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValueOnce([
      {
        id: "sig-i-terminal",
        points: 100,
        decayedPoints: 0, // ← already terminal
        createdAt: ANCHOR,
        // expiresAt was Jan 90 days after ANCHOR = April 1 2026 —
        // tests run after this date so the fast path triggers.
        expiresAt: new Date(ANCHOR.getTime() + 90 * 24 * 60 * 60 * 1000),
        signalTypeRef: { decayDays: 90, decayCurve: "LINEAR" },
      },
    ] as never)

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      success: true,
      intent: {
        scanned: 1,
        updated: 0,
        skippedTerminal: 1,
      },
    })
    // No transaction opened — terminal row was skipped before any
    // queue formed.
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
