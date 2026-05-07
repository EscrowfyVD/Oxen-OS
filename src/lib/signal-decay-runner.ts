// Orchestration for the daily signal-decay recompute job. Materializes
// `IntentSignal.decayedPoints` + `MarketSignal.decayedPoints` from the
// pure helper in `src/lib/signal-decay.ts` so the scoring engine can
// read the cached value instead of running the time-decay math on every
// dashboard query.
//
// Shared between the HTTP route (`/api/cron/signal-decay`, Sprint
// Activate Signal Decay) and the standalone CLI script
// (`scripts/cron/recompute-signal-decay.ts`, Sprint S1 batch 3) so both
// invocation paths run identical logic. Same pattern as the Conference
// Brief sprint — pure logic in `*-decay.ts`, orchestration here.
//
// Idempotency contract:
//   - For each signal, compute the new decayedPoints via
//     calculateDecayedPoints(...).
//   - If new === stored, skip the write (no DB churn for unchanged
//     rows; cuts trash write traffic on long-tail terminal signals
//     where decayedPoints stays at 0 forever after expiry).
//   - Otherwise, update via prisma.$transaction in chunks of 1000.
//
// Refs: PRD-001 §4.2 Signal Decay (Sprint S1 batch 3),
// docs/signal-decay-cron.md, src/lib/conference-brief-runner.ts (pattern).

import {
  type PrismaClient,
  type Prisma,
  type SignalDecayCurve,
} from "@prisma/client"
import { calculateDecayedPoints } from "@/lib/signal-decay"

const CHUNK_SIZE = 1000
const TRANSACTION_TIMEOUT_MS = 60_000 // 60s — generous for 1000 row updates

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

/**
 * Per-table stats. Identical shape for IntentSignal + MarketSignal so
 * downstream consumers can treat them uniformly.
 */
export interface RecomputeStats {
  scanned: number
  updated: number
  skippedUnchanged: number
  skippedTerminal: number
}

/**
 * Aggregated result of the full recompute pass. Returned by
 * `runSignalDecayRecompute()` so the HTTP route can serialize it
 * directly to JSON and the CLI script can render it as structured
 * console output.
 */
export interface SignalDecayRunResult {
  success: boolean
  startedAt: string
  finishedAt: string
  durationMs: number
  intent: RecomputeStats
  market: RecomputeStats
  /** Convenience aggregates so callers don't have to sum manually. */
  totalScanned: number
  totalUpdated: number
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

// ─────────────────────────────────────────────────────────────────────
// Per-table runners — exported so existing test surface stays intact
// (Sprint S1 batch 3 wrote 8 mocked-Prisma tests against these
// individual functions; we keep them as the public unit boundary).
// ─────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────
// Aggregator — single entry point for HTTP route + CLI
// ─────────────────────────────────────────────────────────────────────

/**
 * Run the full signal decay recompute (both IntentSignal +
 * MarketSignal tables) and return aggregated stats. The HTTP route
 * `POST /api/cron/signal-decay` and the CLI script
 * `scripts/cron/recompute-signal-decay.ts` both delegate here.
 *
 * Always returns a result object. Throws only on unexpected DB
 * errors (the per-table runners are idempotent and don't throw on
 * empty tables — they return zero-stats).
 *
 * `now` is exposed as a parameter so tests can pin a deterministic
 * timestamp; the cron leaves it default.
 */
export async function runSignalDecayRecompute(
  client: PrismaClient,
  now: Date = new Date(),
): Promise<SignalDecayRunResult> {
  const startedAt = now
  const intent = await recomputeIntentSignals(client, now)
  const market = await recomputeMarketSignals(client, now)
  const finishedAt = new Date()

  return {
    success: true,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    intent,
    market,
    totalScanned: intent.scanned + market.scanned,
    totalUpdated: intent.updated + market.updated,
  }
}
