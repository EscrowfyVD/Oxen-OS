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

import { PrismaClient } from "@prisma/client"
import { runScoreRecompute } from "../../src/lib/scoring/score-recompute-runner"

const prisma = new PrismaClient()

async function main() {
  console.log("\n=== runScoreRecompute (manual batch) ===\n")
  const start = Date.now()
  const result = await runScoreRecompute()
  const durationMs = Date.now() - start
  console.log(JSON.stringify({ ...result, durationMs }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
