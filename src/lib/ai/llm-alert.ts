/**
 * LLM-failure ops alert (Next.js app side).
 *
 * THE RULE (post-incident, 2026-07): an LLM/API failure must NEVER be silently
 * converted into a business result — and when it happens it must be VISIBLE.
 * The 2026-06-15 model retirement went unnoticed for a MONTH because failures
 * only bumped unread counters. This is the "someone gets pinged" half of the fix.
 *
 * Reuses the existing BD Telegram broadcast (notifyEmployee + CRM_BD_EMAILS) —
 * same channel and recipients as alertBDsOnPromotion; no new plumbing invented.
 *
 * Throttle: first-failure-then-quiet per `source` for a cooldown window, so a
 * batch of failures (or a persistent outage) pings a few times a day, not per item.
 *
 * Fire-and-forget: this NEVER throws — an alert failure must not mask or replace
 * the underlying error the caller is about to surface (fail-the-job / 5xx).
 */
import Anthropic from "@anthropic-ai/sdk"
import { notifyEmployee } from "@/lib/telegram"
import { logger } from "@/lib/logger"

const log = logger.child({ component: "llm-alert" })

/**
 * Thrown when an LLM CALL succeeded but its OUTPUT is unusable — no parseable JSON,
 * or valid-but-incomplete (a required field missing). Distinct from a fabricated
 * default: the whole point of Phase 0 is that unusable output fails LOUDLY instead
 * of becoming a fake business result (score 0, medium/50, empty findings).
 */
export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LlmOutputError"
  }
}

/**
 * A more specific LlmOutputError: the model output was CUT OFF (stop_reason ===
 * "max_tokens"). Distinct from malformed JSON so the alert can say "raise max_tokens"
 * — truncation (not a bad prompt) is the usual root cause of a parse failure.
 * Subclass of LlmOutputError, so isLlmFailure() catches it too.
 */
export class LlmTruncationError extends LlmOutputError {
  constructor(message: string) {
    super(message)
    this.name = "LlmTruncationError"
  }
}

/**
 * Is this an LLM CALL or OUTPUT failure worth alerting on? Widened past the #44
 * `instanceof Anthropic.APIError` (call-side) to ALSO cover parse failures: a bad
 * JSON.parse throws a native SyntaxError, and an incomplete verdict throws
 * LlmOutputError — both were invisible before. A plain DB/other error is NOT an
 * LLM failure and is intentionally excluded (no over-alerting).
 */
export function isLlmFailure(err: unknown): boolean {
  return (
    err instanceof Anthropic.APIError ||
    err instanceof SyntaxError ||
    err instanceof LlmOutputError
  )
}

// Default 6h between alerts per source: the FIRST alert is the signal the incident
// never got; reminders every 6h during an active outage are useful, not spammy.
const COOLDOWN_MS = parseInt(
  process.env.LLM_ALERT_COOLDOWN_MS || String(6 * 60 * 60 * 1000),
  10,
)
const lastAlertAt = new Map<string, number>()

function parseBdEmails(): string[] {
  return (process.env.CRM_BD_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export interface LlmFailureContext {
  /** Where it failed, e.g. "cron/news-auto-scan" or "ai:score-lead". Throttle key. */
  source: string
  error: unknown
  /** Optional extra line for the alert body. */
  detail?: string
}

/** Test hook — clears the throttle window so cases don't leak into each other. */
export function __resetLlmAlertThrottle(): void {
  lastAlertAt.clear()
}

export async function notifyLlmFailure(ctx: LlmFailureContext): Promise<void> {
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
      `If this repeats, the model may be retired/misconfigured — check CLAUDE_MODEL + the Anthropic API.`

    log.error({ source: ctx.source, err: errMsg }, "LLM failure — alerting BD/ops")

    const emails = parseBdEmails()
    if (emails.length === 0) {
      log.warn("CRM_BD_EMAILS empty — LLM alert has no recipients")
      return
    }
    // Per-recipient best-effort: one stale chat_id must not drop the others.
    await Promise.all(emails.map((e) => notifyEmployee(e, message).catch(() => false)))
  } catch (e) {
    log.error(
      { err: e instanceof Error ? e.message : String(e) },
      "notifyLlmFailure itself failed (swallowed — must not mask the real error)",
    )
  }
}
