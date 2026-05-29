// POST /api/scoring/recalculate-all — admin batch recompute.
//
// Sprint 3c B5. Use case : after a ScoringConfig version flip, or
// after a bulk dataset import (Clay sync), an admin wants every
// active account re-scored without waiting for the next cron tick.
//
// Sync V1 (Recon D6). Total time ≈ activeContactsCount × ~200ms.
// Current pool is 10 (587/597 excluded) → ~2s. When the pool grows
// past ~500 (response > 1.5min) → swap to queue (pg-boss / bull) in V2.
//
// Auth via requireAdmin (Employee.isAdmin === true).

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { runScoreRecompute } from "@/lib/scoring/score-recompute-runner"

export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({
    route: "scoring/recalculate-all",
  })

  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const start = Date.now()
  try {
    const result = await runScoreRecompute()
    const durationMs = Date.now() - start

    log.info(
      {
        adminEmail: auth.employee?.email,
        processed: result.processed,
        promoted: result.promoted,
        errorCount: result.errors.length,
        durationMs,
      },
      "batch recompute completed",
    )

    return NextResponse.json({ ...result, durationMs })
  } catch (err) {
    log.error({ err: serializeError(err) }, "batch recompute failed")
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "internal error" },
      { status: 500 },
    )
  }
}
