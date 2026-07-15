// POST /api/cron/llm-canary — periodic LLM health canary (post-incident hardening).
//
// Calls the REAL model (CLAUDE_MODEL) with a 1-token prompt. On failure it pings
// BD/ops (Telegram) and returns 503, so a model retirement/misconfig is caught in
// hours — not the month the 2026-06-15 retirement went unnoticed. Point Railway
// Cron at this route (e.g. hourly). Auth mirrors /api/cron/recompute-scores:
// fail-closed CRON_SECRET bearer token.

import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { childLoggerFromRequest } from "@/lib/logger"
import { runLlmCanary } from "@/lib/ai/llm-canary"
import { notifyLlmFailure } from "@/lib/ai/llm-alert"

export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({ route: "cron/llm-canary" })

  // ── Auth (fail-closed) ─────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    log.error("CRON_SECRET is not defined; llm-canary refuses to run unauthenticated.")
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 })
  }
  const authHeader = request.headers.get("authorization") ?? ""
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader)
  if (!bearerMatch) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 })
  }
  const a = Buffer.from(bearerMatch[1])
  const b = Buffer.from(cronSecret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    log.warn("invalid bearer token on /api/cron/llm-canary")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Canary ─────────────────────────────────────────────────────
  const result = await runLlmCanary()
  if (!result.ok) {
    log.error({ model: result.model, error: result.error }, "🔴 LLM CANARY FAILED — model/API broken")
    await notifyLlmFailure({
      source: "cron/llm-canary",
      error: new Error(result.error ?? "canary failed"),
      detail: `Canary call to model "${result.model}" failed — AI features are likely down.`,
    })
    return NextResponse.json({ ok: false, model: result.model, error: result.error }, { status: 503 })
  }

  log.info({ model: result.model }, "llm canary OK")
  return NextResponse.json({ ok: true, model: result.model })
}
