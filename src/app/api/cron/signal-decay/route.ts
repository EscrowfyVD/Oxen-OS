import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import type { PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { runSignalDecayRecompute } from "@/lib/signal-decay-runner"

/**
 * POST /api/cron/signal-decay — daily recompute of cached
 * `decayedPoints` on every active IntentSignal + MarketSignal row
 * (Sprint Activate Signal Decay).
 *
 * Triggered by Railway Cron (or any external scheduler) at 03:00 UTC
 * daily. The handler is a thin auth + delegate wrapper around
 * `runSignalDecayRecompute()` from `@/lib/signal-decay-runner` —
 * same orchestration is reused by the standalone CLI script
 * `scripts/cron/recompute-signal-decay.ts` for manual runs.
 *
 * Idempotency: the job is fully idempotent — running it more often
 * is safe but pointless (per-row skip-if-unchanged short-circuits
 * the write in the runner). Re-firing the cron during deploy
 * windows or running it manually for debugging will produce zero
 * extra DB writes if no time has elapsed.
 *
 * Auth (fail-closed):
 *   - `Authorization: Bearer <CRON_SECRET>` constant-time compared.
 *   - The endpoint refuses to start if `CRON_SECRET` is unset —
 *     returns 503 so the cron orchestrator surfaces the
 *     misconfiguration rather than silently allowing unauthenticated
 *     traffic. Same secret as /api/cron/conference-brief and
 *     /api/lemlist/sync.
 *
 * Response shape mirrors `SignalDecayRunResult` so the cron log can
 * be parsed for ops triage (per-table scanned/updated, durationMs).
 *
 * Refs: PRD-001 §4.2 Signal Decay, docs/signal-decay-cron.md,
 * Conference Brief pattern (commit 8b0a785).
 */
export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({
    route: "cron/signal-decay",
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
    log.warn("invalid bearer token on /api/cron/signal-decay")
    return NextResponse.json(
      { error: "Invalid bearer token" },
      { status: 401 },
    )
  }

  // ── Delegate to runner ──────────────────────────────────────────
  // Same Prisma `$extends` cast pattern as /api/cron/conference-brief
  // (commit 8b0a785) — the runtime client structurally satisfies the
  // bare `PrismaClient` shape but TypeScript drops `$on`/`$use` after
  // the account-token-encryption $extends layer in src/lib/prisma.ts.
  try {
    const result = await runSignalDecayRecompute(
      prisma as unknown as PrismaClient,
    )
    log.info(
      {
        durationMs: result.durationMs,
        intent: result.intent,
        market: result.market,
        totalScanned: result.totalScanned,
        totalUpdated: result.totalUpdated,
      },
      "signal decay recomputed",
    )
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    log.error(
      { err: serializeError(err) },
      "signal decay recompute failed",
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
