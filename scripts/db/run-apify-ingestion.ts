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
// Needs APIFY_API_TOKEN on the service — without it the client skips fetches and
// the runner no-ops cleanly (jobs complete with fetched 0).
//
// Output: JSON of runApifyIngestion() — { jobs, fetched, inserted, duplicates, errors, durationMs }.

import { PrismaClient } from "@prisma/client"
import { runApifyIngestion } from "../../src/lib/apify-ingestion-runner"

const prisma = new PrismaClient()

async function main() {
  console.log("\n=== runApifyIngestion (batch) ===\n")
  const result = await runApifyIngestion()
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
