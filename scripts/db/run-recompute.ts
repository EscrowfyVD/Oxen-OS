// Manual batch trigger for the Sprint 3c score-recompute-runner.
//
// Use cases :
//   - Seed the very first batch of scores after Sprint 3c deploys
//     (before the Railway cron is wired up)
//   - Ad-hoc operator action — "rescore everyone right now" — without
//     having to go through the admin HTTP endpoint (avoids the
//     pain-in-curl of bringing the admin session cookie along)
//
// Usage :
//   - Local against the Railway DB :  npx tsx scripts/db/run-recompute.ts
//   - From Railway shell             :  railway run npx tsx scripts/db/run-recompute.ts
//
// Output : JSON-stringified result of runScoreRecompute() —
// { processed, promoted, errors, durationMs }.

import { prisma } from "../../src/lib/prisma"
import { runScoreRecompute } from "../../src/lib/scoring/score-recompute-runner"

async function main() {
  console.log("\n=== runScoreRecompute (manual batch) ===\n")
  const start = Date.now()
  const result = await runScoreRecompute()
  const durationMs = Date.now() - start
  console.log(JSON.stringify({ ...result, durationMs }, null, 2))
}

// Cron-exit contract: run the task, then close ALL open handles and exit
// explicitly on BOTH paths. `finally` disconnects the SHARED @/lib/prisma
// singleton the runner queries through (NOT a throwaway `new PrismaClient()`,
// whose disconnect would leave the runner's real pool open) and always exits —
// 0 on success, 1 on failure. An undisconnected pool with no explicit exit keeps
// the event loop alive → the Railway deployment lingers "Active" → the next cron
// tick is SKIPPED. The disconnect is itself guarded so a rare teardown error
// still can't prevent termination.
async function run() {
  let code = 0
  try {
    await main()
  } catch (err) {
    console.error(err)
    code = 1
  } finally {
    try {
      await prisma.$disconnect()
    } catch (err) {
      console.error(err)
    }
    process.exit(code)
  }
}

void run()
