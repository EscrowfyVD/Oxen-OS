// Cron job: send the monthly Conference Brief Telegram digest to the
// BD team (Sprint Conference Brief).
//
// This script is the standalone CLI mirror of the HTTP route at
// /api/cron/conference-brief — both delegate to the same
// `runConferenceBrief()` runner from `@/lib/conference-brief-runner`
// so manual + scheduled runs share identical behavior.
//
// Usage:
//   npx tsx scripts/cron/send-conference-brief.ts
//
// Recommended schedule: 1st of every month at 07:00 UTC
//   - 09:00 CEST in summer (last Sun of Mar → last Sun of Oct)
//   - 08:00 CET in winter (last Sun of Oct → last Sun of Mar)
// The 1-hour drift in winter is acceptable for a monthly cadence;
// running at a fixed UTC hour avoids the headache of scheduling
// against a TZ that DST-shifts.
//
// Env vars required:
//   - DATABASE_URL (Prisma connection)
//   - TELEGRAM_BOT_TOKEN (used by sendTelegramMessage)
// Env vars NOT required for this script (only the HTTP route needs):
//   - CRON_SECRET (only the HTTP variant authenticates inbound calls)
//
// Refs: PRD-001 v3.7, Monthly_Conference_Brief.docx,
// docs/conference-brief-cron.md.

import { PrismaClient } from "@prisma/client"
import { runConferenceBrief } from "../../src/lib/conference-brief-runner"

async function main() {
  const prisma = new PrismaClient()
  console.log(
    `\n=== Conference Brief cron — ${new Date().toISOString()} ===\n`,
  )

  try {
    const result = await runConferenceBrief(prisma)

    console.log(`Month            : ${result.monthName}`)
    console.log(`Conferences      : ${result.conferenceCount}`)
    console.log(`Recipients       : ${result.recipientCount}`)
    console.log(`Delivered        : ${result.delivered}`)
    console.log(`Failed           : ${result.failed}`)
    if (result.missingRecipients.length > 0) {
      console.log(
        `Missing emails   : ${result.missingRecipients.join(", ")}`,
      )
      console.log(
        `                   (no Employee row OR no telegramChatId — fix on /team page)`,
      )
    }

    if (result.deliveries.length > 0) {
      console.log("\n--- Per-recipient deliveries ---")
      for (const d of result.deliveries) {
        const tag = d.status === "delivered" ? "✓" : "✗"
        const errSuffix = d.error ? ` (${d.error})` : ""
        console.log(`  ${tag} ${d.name.padEnd(20)} ${d.email}${errSuffix}`)
      }
    }

    console.log("\n=== End ===\n")

    // Exit non-zero only if EVERY delivery failed AND we had recipients
    // (i.e. clear infrastructure problem). Partial failures just
    // surface in the stats.
    if (result.recipientCount > 0 && result.delivered === 0) {
      process.exit(1)
    }
  } finally {
    await prisma.$disconnect()
  }
}

const isDirectInvocation =
  process.argv[1] && process.argv[1].endsWith("send-conference-brief.ts")
if (isDirectInvocation) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
