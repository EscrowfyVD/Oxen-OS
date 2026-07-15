/**
 * LLM-failure ops alert (AI Worker side).
 *
 * The worker is a separate package and cannot import the app's @/lib/telegram, so
 * this mirrors the app's notifyLlmFailure using the worker's own channels:
 *   1. Sentry (already wired in index.ts) — the worker's native ops surface.
 *   2. Telegram to the same BD recipients (CRM_BD_EMAILS) via a raw send, so a
 *      failure reaches a human even if Sentry alerting isn't watched.
 *
 * Throttle + fire-and-forget semantics match the app helper: first-failure-then-
 * quiet per source, and this NEVER throws (an alert failure must not mask the
 * underlying error that is about to fail the job).
 */
import * as Sentry from "@sentry/node"
import type { PrismaClient } from "@prisma/client"
import { logger } from "./logger"

const log = logger.child({ component: "llm-alert" })

const COOLDOWN_MS = parseInt(
  process.env.LLM_ALERT_COOLDOWN_MS || String(6 * 60 * 60 * 1000),
  10,
)
const lastAlertAt = new Map<string, number>()
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""

function parseBdEmails(): string[] {
  return (process.env.CRM_BD_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export interface LlmFailureContext {
  source: string
  error: unknown
  detail?: string
}

export async function notifyLlmFailure(
  prisma: PrismaClient,
  ctx: LlmFailureContext,
): Promise<void> {
  try {
    const now = Date.now()
    const last = lastAlertAt.get(ctx.source) ?? 0
    if (now - last < COOLDOWN_MS) return // throttled
    lastAlertAt.set(ctx.source, now)

    const errMsg = ctx.error instanceof Error ? ctx.error.message : String(ctx.error)
    const message =
      `🔴 LLM ALERT — ${ctx.source}\n` +
      `An AI call failed and was NOT turned into a business result.\n` +
      (ctx.detail ? `${ctx.detail}\n` : "") +
      `Error: ${errMsg.slice(0, 300)}\n` +
      `If this repeats, the model may be retired/misconfigured.`

    log.error({ source: ctx.source, err: errMsg }, "LLM failure — alerting")

    // Channel 1 — Sentry (best-effort).
    try {
      Sentry.captureMessage(`LLM failure — ${ctx.source}: ${errMsg}`, "error")
    } catch {
      /* ignore */
    }

    // Channel 2 — Telegram to BD recipients (best-effort raw send).
    if (BOT_TOKEN) {
      const emails = parseBdEmails()
      if (emails.length > 0) {
        const employees = await prisma.employee.findMany({
          where: { email: { in: emails } },
          select: { telegramChatId: true },
        })
        await Promise.all(
          employees
            .filter((e) => e.telegramChatId)
            .map((e) =>
              fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: e.telegramChatId, text: message }),
              }).catch(() => undefined),
            ),
        )
      }
    }
  } catch (e) {
    log.error(
      { err: e instanceof Error ? e.message : String(e) },
      "worker notifyLlmFailure failed (swallowed — must not mask the real error)",
    )
  }
}
