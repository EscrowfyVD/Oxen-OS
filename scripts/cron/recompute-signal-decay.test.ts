// Unit tests for the signal-decay cron (Sprint S1 batch 3).
//
// Mocks Prisma to verify the chunking + idempotency contract without a
// real DB:
//   - chunks of 1000 are respected (cursor advances correctly)
//   - rows whose computed decayedPoints match the stored value are
//     skipped (no DB write)
//   - rows whose expiresAt has passed AND decayedPoints is already 0
//     are skipped via the terminal-state fast path
//   - $transaction is called once per batch with the update array
//   - running twice produces 0 updates on the second pass (true
//     idempotency: post-first-run, every row is "unchanged")

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { PrismaClient } from "@prisma/client"
import {
  recomputeIntentSignals,
  recomputeMarketSignals,
} from "./recompute-signal-decay"

const ANCHOR = new Date("2026-01-01T00:00:00Z")

// ─────────────────────────────────────────────────────────────────────
// Helpers — build mocked PrismaClient surfaces
// ─────────────────────────────────────────────────────────────────────

interface IntentRow {
  id: string
  points: number
  decayedPoints: number | null
  createdAt: Date
  expiresAt: Date | null
  signalTypeRef: { decayDays: number; decayCurve: "LINEAR" | "EXPONENTIAL" | "STEP" }
}

interface MarketRow {
  id: string
  points: number
  decayedPoints: number | null
  occurredAt: Date
  expiresAt: Date | null
  signalTypeRef: { decayDays: number; decayCurve: "LINEAR" | "EXPONENTIAL" | "STEP" }
}

function makeIntentMock(rows: IntentRow[]) {
  // Cursor-aware findMany: each call returns the next CHUNK_SIZE rows
  // after the cursor, mimicking the production behavior.
  const findMany = vi.fn(async (args: {
    take: number
    skip?: number
    cursor?: { id: string }
  }) => {
    let startIdx = 0
    if (args.cursor) {
      const idx = rows.findIndex((r) => r.id === args.cursor!.id)
      startIdx = idx >= 0 ? idx + (args.skip ?? 0) : 0
    }
    return rows.slice(startIdx, startIdx + args.take)
  })

  const update = vi.fn(async () => ({ id: "updated" }))
  // Function-form $transaction: receives a callback that takes a `tx`
  // proxy and runs operations against it. For test purposes we forward
  // tx == client (no real isolation) and just await the callback.
  const transaction = vi.fn(
    async (
      arg: ((tx: unknown) => Promise<unknown>) | unknown[],
    ) => {
      if (typeof arg === "function") {
        return arg({
          intentSignal: { update },
          marketSignal: { update: vi.fn() },
        })
      }
      // Array form (legacy / unused in our cron) — resolve all promises.
      return Promise.all(arg)
    },
  )

  return {
    intentSignal: { findMany, update },
    marketSignal: {
      findMany: vi.fn(async () => []),
      update: vi.fn(),
    },
    $transaction: transaction,
  } as unknown as PrismaClient
}

function makeMarketMock(rows: MarketRow[]) {
  const findMany = vi.fn(async (args: {
    take: number
    skip?: number
    cursor?: { id: string }
  }) => {
    let startIdx = 0
    if (args.cursor) {
      const idx = rows.findIndex((r) => r.id === args.cursor!.id)
      startIdx = idx >= 0 ? idx + (args.skip ?? 0) : 0
    }
    return rows.slice(startIdx, startIdx + args.take)
  })

  const update = vi.fn(async () => ({ id: "updated" }))
  // Function-form $transaction — forward the market update mock as
  // tx.marketSignal.update so the cron's `tx.marketSignal.update(args)`
  // call hits the real spy.
  const transaction = vi.fn(
    async (arg: ((tx: unknown) => Promise<unknown>) | unknown[]) => {
      if (typeof arg === "function") {
        return arg({
          intentSignal: { update: vi.fn() },
          marketSignal: { update },
        })
      }
      return Promise.all(arg)
    },
  )

  return {
    intentSignal: { findMany: vi.fn(async () => []), update: vi.fn() },
    marketSignal: { findMany, update },
    $transaction: transaction,
  } as unknown as PrismaClient
}

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

describe("recomputeIntentSignals (Sprint S1 batch 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates rows whose decayedPoints differ from computed value", async () => {
    // 100 points / 90-day LINEAR / 45 days elapsed → 50 expected.
    // Stored decayedPoints = 100 (stale) → cron should update to 50.
    const rows: IntentRow[] = [
      {
        id: "sig-1",
        points: 100,
        decayedPoints: 100, // stale
        createdAt: ANCHOR,
        expiresAt: new Date(ANCHOR.getTime() + 90 * 24 * 60 * 60 * 1000),
        signalTypeRef: { decayDays: 90, decayCurve: "LINEAR" },
      },
    ]
    const client = makeIntentMock(rows)
    const now = new Date(ANCHOR.getTime() + 45 * 24 * 60 * 60 * 1000)

    const stats = await recomputeIntentSignals(client, now)

    expect(stats.scanned).toBe(1)
    expect(stats.updated).toBe(1)
    expect(stats.skippedUnchanged).toBe(0)
    expect(stats.skippedTerminal).toBe(0)
    expect(client.intentSignal.update).toHaveBeenCalledTimes(1)
    const args = vi.mocked(client.intentSignal.update).mock.calls[0][0]
    expect(args.where.id).toBe("sig-1")
    expect(args.data.decayedPoints).toBe(50)
  })

  it("skips rows where stored decayedPoints already matches computed value (idempotent)", async () => {
    // Same scenario but stored = 50 already. Cron should skip the write.
    const rows: IntentRow[] = [
      {
        id: "sig-2",
        points: 100,
        decayedPoints: 50, // already correct
        createdAt: ANCHOR,
        expiresAt: new Date(ANCHOR.getTime() + 90 * 24 * 60 * 60 * 1000),
        signalTypeRef: { decayDays: 90, decayCurve: "LINEAR" },
      },
    ]
    const client = makeIntentMock(rows)
    const now = new Date(ANCHOR.getTime() + 45 * 24 * 60 * 60 * 1000)

    const stats = await recomputeIntentSignals(client, now)

    expect(stats.scanned).toBe(1)
    expect(stats.updated).toBe(0)
    expect(stats.skippedUnchanged).toBe(1)
    expect(client.intentSignal.update).not.toHaveBeenCalled()
    expect(client.$transaction).not.toHaveBeenCalled()
  })

  it("skips terminal-state rows (expiresAt passed + decayedPoints=0) via fast path", async () => {
    const rows: IntentRow[] = [
      {
        id: "sig-3",
        points: 100,
        decayedPoints: 0,
        createdAt: ANCHOR,
        // expiresAt 200 days ago — already terminal
        expiresAt: new Date(ANCHOR.getTime() + 90 * 24 * 60 * 60 * 1000),
        signalTypeRef: { decayDays: 90, decayCurve: "LINEAR" },
      },
    ]
    const client = makeIntentMock(rows)
    // now is 1 year past anchor — well past expiresAt
    const now = new Date(ANCHOR.getTime() + 365 * 24 * 60 * 60 * 1000)

    const stats = await recomputeIntentSignals(client, now)

    expect(stats.scanned).toBe(1)
    expect(stats.skippedTerminal).toBe(1)
    expect(stats.updated).toBe(0)
    expect(client.intentSignal.update).not.toHaveBeenCalled()
  })

  it("respects the chunk size (advances cursor correctly across pages)", async () => {
    // 2500 rows → 3 pages: 1000, 1000, 500. All stale → all updated.
    const rows: IntentRow[] = Array.from({ length: 2500 }, (_, i) => ({
      id: `sig-${i.toString().padStart(5, "0")}`,
      points: 100,
      decayedPoints: 99, // stale by 1
      createdAt: ANCHOR,
      expiresAt: null,
      signalTypeRef: { decayDays: 90, decayCurve: "LINEAR" },
    }))
    const client = makeIntentMock(rows)
    // 1 day elapsed → ratio ≈ 0.011 → 100 * 0.989 = round(98.89) = 99
    // Wait, that means computed = 99 = stored. So no update.
    // Let me use a larger elapsed: 9 days → 100 * (1 - 9/90) = 90.
    const now = new Date(ANCHOR.getTime() + 9 * 24 * 60 * 60 * 1000)

    const stats = await recomputeIntentSignals(client, now)

    expect(stats.scanned).toBe(2500)
    expect(stats.updated).toBe(2500)
    // findMany called 3 times (page 1, 2, 3)
    expect(client.intentSignal.findMany).toHaveBeenCalledTimes(3)
    // $transaction called 3 times (one per page with updates)
    expect(client.$transaction).toHaveBeenCalledTimes(3)
  })

  it("returns 0 updates on the second run (true idempotency)", async () => {
    // Track decayedPoints across runs by mutating the rows array.
    const rows: IntentRow[] = [
      {
        id: "sig-4",
        points: 100,
        decayedPoints: null, // never computed yet
        createdAt: ANCHOR,
        expiresAt: null,
        signalTypeRef: { decayDays: 90, decayCurve: "LINEAR" },
      },
    ]
    // Wire the mocked update to mutate the row in place. Prisma's
    // real IntentSignalUpdateArgs is wider than what the cron uses;
    // we cast through `unknown` to avoid pulling the full type into
    // the test (the cron only reads `args.where.id` + `args.data.
    // decayedPoints`).
    const client = makeIntentMock(rows)
    vi.mocked(client.intentSignal.update).mockImplementation(
      (async (args: unknown) => {
        const a = args as {
          where: { id: string }
          data: { decayedPoints: number }
        }
        const row = rows.find((r) => r.id === a.where.id)
        if (row) row.decayedPoints = a.data.decayedPoints
        return { id: a.where.id }
      }) as never,
    )

    const now = new Date(ANCHOR.getTime() + 45 * 24 * 60 * 60 * 1000)

    // First run — computes and writes.
    const stats1 = await recomputeIntentSignals(client, now)
    expect(stats1.updated).toBe(1)

    // Second run with same `now` — stored matches computed → skip.
    const stats2 = await recomputeIntentSignals(client, now)
    expect(stats2.updated).toBe(0)
    expect(stats2.skippedUnchanged).toBe(1)
  })

  it("returns zero stats when no rows exist (empty table)", async () => {
    const client = makeIntentMock([])
    const stats = await recomputeIntentSignals(client, new Date())
    expect(stats.scanned).toBe(0)
    expect(stats.updated).toBe(0)
    expect(client.$transaction).not.toHaveBeenCalled()
  })
})

describe("recomputeMarketSignals (Sprint S1 batch 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("anchors decay on `occurredAt` (not createdAt)", async () => {
    const rows: MarketRow[] = [
      {
        id: "msig-1",
        points: 50,
        decayedPoints: 50,
        occurredAt: ANCHOR,
        expiresAt: new Date(ANCHOR.getTime() + 180 * 24 * 60 * 60 * 1000),
        signalTypeRef: { decayDays: 180, decayCurve: "STEP" },
      },
    ]
    const client = makeMarketMock(rows)
    // STEP curve at ratio = 0.5 → 50%. 50 → 25.
    const now = new Date(ANCHOR.getTime() + 90 * 24 * 60 * 60 * 1000)

    const stats = await recomputeMarketSignals(client, now)

    expect(stats.updated).toBe(1)
    const args = vi.mocked(client.marketSignal.update).mock.calls[0][0]
    expect(args.data.decayedPoints).toBe(25)
  })

  it("processes a clean MarketSignal table without touching IntentSignal", async () => {
    const rows: MarketRow[] = [
      {
        id: "msig-2",
        points: 100,
        decayedPoints: 100,
        occurredAt: ANCHOR,
        expiresAt: null,
        signalTypeRef: { decayDays: 30, decayCurve: "LINEAR" },
      },
    ]
    const client = makeMarketMock(rows)
    const now = new Date(ANCHOR.getTime() + 15 * 24 * 60 * 60 * 1000)

    await recomputeMarketSignals(client, now)
    expect(client.intentSignal.findMany).not.toHaveBeenCalled()
  })
})
