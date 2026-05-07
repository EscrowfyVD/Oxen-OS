import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import type { PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { runConferenceBrief } from "@/lib/conference-brief-runner"

/**
 * POST /api/cron/conference-brief — monthly Telegram digest of
 * upcoming conferences (Sprint Conference Brief).
 *
 * Triggered by Railway Cron (or any external scheduler) on the 1st
 * of every month at 07:00 UTC (~ 09:00 CEST in summer / 08:00 CET in
 * winter). The handler is a thin auth + delegate wrapper around
 * `runConferenceBrief()` from `@/lib/conference-brief-runner` —
 * same orchestration is reused by the standalone CLI script
 * `scripts/cron/send-conference-brief.ts` for manual runs.
 *
 * Auth (fail-closed):
 *   - `Authorization: Bearer <CRON_SECRET>` constant-time compared.
 *   - The endpoint refuses to start if `CRON_SECRET` is unset —
 *     returns 503 so the cron orchestrator surfaces the
 *     misconfiguration rather than silently sending unauthenticated
 *     traffic. (CRON_SECRET is shared with the existing lemlist
 *     cron — see /api/lemlist/sync's `isCron` check.)
 *
 * Response shape mirrors `ConferenceBriefRunResult` so the cron log
 * can be parsed for ops triage (delivered / failed / missing).
 *
 * Refs: PRD-001 v3.7, Monthly_Conference_Brief.docx,
 * docs/conference-brief-cron.md.
 */
export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({
    route: "cron/conference-brief",
  })

  // ── Auth ────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    log.error(
      "CRON_SECRET is not defined; cron handler refuses to run unauthenticated.",
    )
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 503 },
    )
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader)
  if (!bearerMatch) {
    return NextResponse.json(
      { error: "Missing bearer token" },
      { status: 401 },
    )
  }
  const provided = bearerMatch[1]
  const a = Buffer.from(provided)
  const b = Buffer.from(cronSecret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    log.warn("invalid bearer token on /api/cron/conference-brief")
    return NextResponse.json(
      { error: "Invalid bearer token" },
      { status: 401 },
    )
  }

  // ── Delegate to runner ──────────────────────────────────────────
  // The shared `prisma` instance is the `$extends`-wrapped client
  // (see src/lib/prisma.ts — adds account-token transparent encryption).
  // Its TypeScript signature drops `$on`/`$use` so it doesn't satisfy
  // the bare `PrismaClient` shape that the runner declares. Runtime
  // is structurally compatible — `conference.findMany` and
  // `employee.findMany` are real on both — so we cast through `unknown`.
  // Same pattern as scripts/cron/recompute-signal-decay.test.ts.
  try {
    const result = await runConferenceBrief(
      prisma as unknown as PrismaClient,
    )
    log.info(
      {
        monthName: result.monthName,
        conferenceCount: result.conferenceCount,
        recipientCount: result.recipientCount,
        delivered: result.delivered,
        failed: result.failed,
        missingRecipients: result.missingRecipients,
      },
      "conference brief sent",
    )
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    log.error(
      { err: serializeError(err) },
      "conference brief run failed",
    )
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "internal error",
      },
      { status: 500 },
    )
  }
}
