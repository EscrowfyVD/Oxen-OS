// AIRA F2 PR3b — batch trigger for the 1h-before meeting-brief refresh runner.
//
// Regenerates briefs for meetings starting in ~1h so the BD gets a fresh brief
// (CRM / intent signals may have moved since booking). Idempotent: the
// Meeting.briefRefreshedAt marker means each meeting is refreshed exactly once.
//
// Usage:
//   - Local against the Railway DB :  npx tsx scripts/db/refresh-meeting-briefs.ts
//   - Railway cron service          :  startCommand `npm run refresh-briefs:cron`
//     (cron/railway-refresh-briefs.toml; cronSchedule set in the dashboard)
//
// Output: JSON of runMeetingBriefRefresh() — { processed, refreshed, errors, durationMs }.

import { PrismaClient } from "@prisma/client"
import { runMeetingBriefRefresh } from "../../src/lib/ai/refresh-meeting-briefs-runner"

const prisma = new PrismaClient()

async function main() {
  console.log("\n=== runMeetingBriefRefresh (batch) ===\n")
  const result = await runMeetingBriefRefresh()
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
