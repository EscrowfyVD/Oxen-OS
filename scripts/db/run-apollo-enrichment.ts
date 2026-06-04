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

import { PrismaClient } from "@prisma/client"
import { runApolloEnrichment } from "../../src/lib/apollo-enrichment-runner"

const prisma = new PrismaClient()

async function main() {
  console.log("\n=== runApolloEnrichment (batch) ===\n")
  const result = await runApolloEnrichment()
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
