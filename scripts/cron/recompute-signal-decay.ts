// Cron job: recompute IntentSignal.decayedPoints + MarketSignal.decayedPoints
// for every active signal in the system (Sprint S1 batch 3,
// modernized in Sprint Activate Signal Decay).
//
// The scoring engine reads `decayedPoints` (cached) instead of running
// the time-decay math on every dashboard query. This cron materializes
// that cache.
//
// This script is the standalone CLI mirror of the HTTP route at
// /api/cron/signal-decay — both delegate to the same
// `runSignalDecayRecompute()` aggregator from
// `@/lib/signal-decay-runner` so manual + scheduled runs share
// identical behavior. Same architecture as the Conference Brief sprint.
//
// Usage:
//   npx tsx scripts/cron/recompute-signal-decay.ts
//
// Recommended schedule: once per day at 03:00 UTC. The job is fully
// idempotent — running it more often is safe but pointless. Running
// it less often means the dashboard reads slightly stale points (up
// to one day's worth of decay).
//
// Env vars required:
//   - DATABASE_URL (Prisma connection)
// Env vars NOT required for this script (only the HTTP route needs):
//   - CRON_SECRET (only the HTTP variant authenticates inbound calls)
//
// Refs: PRD-001 §4.2 Signal Decay (Sprint S1 batch 3),
// docs/signal-decay-cron.md, Conference Brief pattern (commit 8b0a785).

import { PrismaClient } from "@prisma/client"
import { runSignalDecayRecompute } from "../../src/lib/signal-decay-runner"

async function main() {
  const prisma = new PrismaClient()
  console.log(
    `\n=== Signal decay recompute — ${new Date().toISOString()} ===\n`,
  )

  try {
    const result = await runSignalDecayRecompute(prisma)

    console.log("--- IntentSignal ---")
    console.log(
      `  scanned=${result.intent.scanned} updated=${result.intent.updated} skippedUnchanged=${result.intent.skippedUnchanged} skippedTerminal=${result.intent.skippedTerminal}`,
    )

    console.log("\n--- MarketSignal ---")
    console.log(
      `  scanned=${result.market.scanned} updated=${result.market.updated} skippedUnchanged=${result.market.skippedUnchanged} skippedTerminal=${result.market.skippedTerminal}`,
    )

    console.log(
      `\nTotal: scanned=${result.totalScanned} updated=${result.totalUpdated} durationMs=${result.durationMs}`,
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
