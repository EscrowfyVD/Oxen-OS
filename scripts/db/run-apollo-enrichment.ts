// Apollo PR-Z — batch trigger for the Apollo enrichment runner.
//
// Enriches CrmContacts + contact-less Companies whose enrichedAt IS NULL (capped
// per run). Idempotent (the marker means each row is enriched at most once) and
// credit-controlled (the cap). Reads the DB + the Apollo client only.
//
// Usage:
//   - Local against the Railway DB :  npx tsx scripts/db/run-apollo-enrichment.ts
//   - Railway cron service          :  startCommand `npm run apollo-enrichment:cron`
//     (cron/railway-apollo-enrichment.toml; cronSchedule set in the dashboard)
//
// Requires APOLLO_API_KEY on the service — without it the client skips every
// call (the runner no-ops cleanly: everything counts as skipped, zero credit).
//
// Output: JSON of runApolloEnrichment() — { processed, enriched, skipped, errors, durationMs }.

import { prisma } from "../../src/lib/prisma"
import { runApolloEnrichment } from "../../src/lib/apollo-enrichment-runner"

async function main() {
  console.log("\n=== runApolloEnrichment (batch) ===\n")
  const result = await runApolloEnrichment()
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
