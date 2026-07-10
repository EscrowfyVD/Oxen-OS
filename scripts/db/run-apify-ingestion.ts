// Apify PR3a-wiring — batch trigger for the Apify ingestion runner.
//
// Claims pending `apify:process-dataset` Jobs (queued by the webhook, #23),
// fetches each dataset, and dedups + persists raw items to ProcessedSignal.
// NO keyword/recency filters, NO account match, NO ingestSignal, NO scoring
// (all PR3b).
//
// Usage:
//   - Local against the Railway DB :  npx tsx scripts/db/run-apify-ingestion.ts
//   - Railway cron service          :  startCommand `npm run apify-ingestion:cron`
//     (cron/railway-apify-ingestion.toml; cronSchedule */10 in the dashboard)
//
// Needs APIFY_API_TOKEN on the service — without it the runner short-circuits
// BEFORE claiming any Job (returns { skipped: true }); pending Jobs are left
// untouched and drain on the first run after the token is set.
//
// Output: JSON of runApifyIngestion() — { skipped, jobs, fetched, inserted, duplicates, errors, durationMs }.

import { prisma } from "../../src/lib/prisma"
import { runApifyIngestion } from "../../src/lib/apify-ingestion-runner"

async function main() {
  console.log("\n=== runApifyIngestion (batch) ===\n")
  const result = await runApifyIngestion()
  console.log(JSON.stringify(result, null, 2))
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
