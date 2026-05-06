// Cron job: recompute IntentSignal.decayedPoints + MarketSignal.decayedPoints
// for every active signal in the system (Sprint S1 batch 3).
//
// The scoring engine reads `decayedPoints` (cached) instead of running
// the time-decay math on every dashboard query. This cron materializes
// that cache.
//
// Usage:
//   npx tsx scripts/cron/recompute-signal-decay.ts
//
// Recommended schedule: once per day at 03:00 UTC. The job is fully
// idempotent — running it more often is safe but pointless. Running
// it less often means the dashboard reads slightly stale points (up
// to one day's worth of decay).
//
// Idempotency contract:
//   - For each signal, compute the new decayedPoints via
//     calculateDecayedPoints(...).
//   - If new === stored, skip the write (no DB churn for unchanged
//     rows; cuts trash write traffic on long-tail terminal signals
//     where decayedPoints stays at 0 forever after expiry).
//   - Otherwise, update via prisma.$transaction in chunks of 1000.
//
// Refs: PRD-001 §4.2 Signal Decay (Sprint S1 batch 3)
// Doc:  docs/signal-decay-cron.md

import {
  PrismaClient,
  type Prisma,
  type SignalDecayCurve,
} from "@prisma/client"
import { calculateDecayedPoints } from "../../src/lib/signal-decay"

const CHUNK_SIZE = 1000
const TRANSACTION_TIMEOUT_MS = 60_000 // 60s — generous for 1000 row updates

interface RecomputeStats {
  scanned: number
  updated: number
  skippedUnchanged: number
  skippedTerminal: number
}

interface IntentSignalRow {
  id: string
  points: number
  decayedPoints: number | null
  createdAt: Date
  expiresAt: Date | null
  signalTypeRef: { decayDays: number; decayCurve: SignalDecayCurve }
}

interface MarketSignalRow {
  id: string
  points: number
  decayedPoints: number | null
  occurredAt: Date
  expiresAt: Date | null
  signalTypeRef: { decayDays: number; decayCurve: SignalDecayCurve }
}

/**
 * Process IntentSignal rows in chunks. Returns aggregated stats.
 *
 * Anchors decay math on `createdAt` (not `occurredAt` — IntentSignal
 * has no separate occurredAt field; the route handler sets createdAt
 * to the real-world event timestamp at insert time, see
 * src/app/api/signals/route.ts).
 */
export async function recomputeIntentSignals(
  client: PrismaClient,
  now: Date = new Date(),
): Promise<RecomputeStats> {
  const stats: RecomputeStats = {
    scanned: 0,
    updated: 0,
    skippedUnchanged: 0,
    skippedTerminal: 0,
  }

  let cursor: string | undefined = undefined
  // Loop with cursor-based pagination so memory stays bounded even
  // when there are millions of signals.
  while (true) {
    const batch: IntentSignalRow[] = await client.intentSignal.findMany({
      take: CHUNK_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        points: true,
        decayedPoints: true,
        createdAt: true,
        expiresAt: true,
        signalTypeRef: { select: { decayDays: true, decayCurve: true } },
      },
    })

    if (batch.length === 0) break
    stats.scanned += batch.length

    const updateArgsList: Prisma.IntentSignalUpdateArgs[] = []
    for (const sig of batch) {
      // Fast-path: signal has expired AND decayedPoints already 0.
      // Terminal state — re-running the math will give 0 too.
      if (sig.expiresAt && sig.expiresAt <= now && sig.decayedPoints === 0) {
        stats.skippedTerminal++
        continue
      }

      const newDecayed = calculateDecayedPoints(
        sig.points,
        sig.createdAt,
        sig.signalTypeRef.decayDays,
        sig.signalTypeRef.decayCurve,
        now,
      )

      if (newDecayed === sig.decayedPoints) {
        stats.skippedUnchanged++
        continue
      }

      updateArgsList.push({
        where: { id: sig.id },
        data: { decayedPoints: newDecayed },
      })
    }

    if (updateArgsList.length > 0) {
      // Interactive transaction (function form) so we can pass `timeout`
      // — the array form of $transaction in Prisma 5 doesn't accept
      // timeout, only isolationLevel. With 1000 sequential updates the
      // default 5s timeout would be too tight on Railway.
      await client.$transaction(
        async (tx) => {
          for (const args of updateArgsList) {
            await tx.intentSignal.update(args)
          }
        },
        { timeout: TRANSACTION_TIMEOUT_MS },
      )
      stats.updated += updateArgsList.length
    }

    // Advance cursor — next page starts after the last id in this batch.
    cursor = batch[batch.length - 1].id
    if (batch.length < CHUNK_SIZE) break
  }

  return stats
}

/**
 * Process MarketSignal rows. Same shape as recomputeIntentSignals,
 * with one key difference: MarketSignal has an explicit `occurredAt`
 * column (vs IntentSignal which reuses createdAt as the anchor).
 */
export async function recomputeMarketSignals(
  client: PrismaClient,
  now: Date = new Date(),
): Promise<RecomputeStats> {
  const stats: RecomputeStats = {
    scanned: 0,
    updated: 0,
    skippedUnchanged: 0,
    skippedTerminal: 0,
  }

  let cursor: string | undefined = undefined
  while (true) {
    const batch: MarketSignalRow[] = await client.marketSignal.findMany({
      take: CHUNK_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        points: true,
        decayedPoints: true,
        occurredAt: true,
        expiresAt: true,
        signalTypeRef: { select: { decayDays: true, decayCurve: true } },
      },
    })

    if (batch.length === 0) break
    stats.scanned += batch.length

    const updateArgsList: Prisma.MarketSignalUpdateArgs[] = []
    for (const sig of batch) {
      if (sig.expiresAt && sig.expiresAt <= now && sig.decayedPoints === 0) {
        stats.skippedTerminal++
        continue
      }

      const newDecayed = calculateDecayedPoints(
        sig.points,
        sig.occurredAt,
        sig.signalTypeRef.decayDays,
        sig.signalTypeRef.decayCurve,
        now,
      )

      if (newDecayed === sig.decayedPoints) {
        stats.skippedUnchanged++
        continue
      }

      updateArgsList.push({
        where: { id: sig.id },
        data: { decayedPoints: newDecayed },
      })
    }

    if (updateArgsList.length > 0) {
      await client.$transaction(
        async (tx) => {
          for (const args of updateArgsList) {
            await tx.marketSignal.update(args)
          }
        },
        { timeout: TRANSACTION_TIMEOUT_MS },
      )
      stats.updated += updateArgsList.length
    }

    cursor = batch[batch.length - 1].id
    if (batch.length < CHUNK_SIZE) break
  }

  return stats
}

async function main() {
  const prisma = new PrismaClient()
  const now = new Date()
  console.log(
    `\n=== Signal decay recompute (Sprint S1 batch 3) — ${now.toISOString()} ===\n`,
  )

  try {
    console.log("--- IntentSignal ---")
    const intentStats = await recomputeIntentSignals(prisma, now)
    console.log(
      `  scanned=${intentStats.scanned} updated=${intentStats.updated} skippedUnchanged=${intentStats.skippedUnchanged} skippedTerminal=${intentStats.skippedTerminal}`,
    )

    console.log("\n--- MarketSignal ---")
    const marketStats = await recomputeMarketSignals(prisma, now)
    console.log(
      `  scanned=${marketStats.scanned} updated=${marketStats.updated} skippedUnchanged=${marketStats.skippedUnchanged} skippedTerminal=${marketStats.skippedTerminal}`,
    )

    console.log("\n=== End ===\n")
  } finally {
    await prisma.$disconnect()
  }
}

const isDirectInvocation =
  process.argv[1] && process.argv[1].endsWith("recompute-signal-decay.ts")
if (isDirectInvocation) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
