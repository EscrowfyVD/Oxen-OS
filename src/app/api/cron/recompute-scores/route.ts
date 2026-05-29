// POST /api/cron/recompute-scores — daily score recompute (Sprint 3c B5).
//
// Triggered by Railway Cron (or any external scheduler), typically a
// few minutes after the signal-decay cron so the decayedPoints are
// fresh inputs. Pattern mirrors /api/cron/signal-decay exactly :
// fail-closed CRON_SECRET auth, then a thin delegate to the lib
// runner.
//
// Idempotency : the runner reads the latest ScoringConfig + the
// current CrmContact state + recomputes. Re-running back-to-back
// just produces an additional ScoreHistory row per account ; the
// CrmContact columns reflect the latest run (last-write-wins per D8).

import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { runScoreRecompute } from "@/lib/scoring/score-recompute-runner"

export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({
    route: "cron/recompute-scores",
  })

  // ── Auth (fail-closed) ─────────────────────────────────────────
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
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 })
  }
  const provided = bearerMatch[1]
  const a = Buffer.from(provided)
  const b = Buffer.from(cronSecret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    log.warn("invalid bearer token on /api/cron/recompute-scores")
    return NextResponse.json(
      { error: "Invalid bearer token" },
      { status: 401 },
    )
  }

  // ── Delegate to runner ─────────────────────────────────────────
  const start = Date.now()
  try {
    const result = await runScoreRecompute()
    const durationMs = Date.now() - start
    log.info(
      {
        durationMs,
        processed: result.processed,
        promoted: result.promoted,
        errorCount: result.errors.length,
      },
      "score recompute completed",
    )
    return NextResponse.json({ ...result, durationMs }, { status: 200 })
  } catch (err) {
    log.error({ err: serializeError(err) }, "score recompute failed")
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "internal error",
      },
      { status: 500 },
    )
  }
}
