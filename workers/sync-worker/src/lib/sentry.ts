import type { ErrorEvent, EventHint } from "@sentry/core"

/**
 * Sentry error tracking helpers for Oxen OS (monolith).
 *
 * Guardrails enforced at init site (src/instrumentation*.ts):
 * - sendDefaultPii: false — never send user email, IP, cookies
 * - tracesSampleRate: 0 — no APM
 * - replaysSessionSampleRate: 0 — no session replay
 * - beforeSend hook below redacts sensitive fields in payloads
 *
 * DSN is provided via SENTRY_DSN env var. When not set (local dev), Sentry
 * is disabled entirely (no network calls).
 *
 * ⚠️ WORKER SYNC — This file is the canonical source and is mirrored to
 * `workers/sync-worker/src/lib/sentry.ts` via `npm run worker:sync-libs`.
 * DO NOT edit the worker copy directly. SHA-256 hash test in
 * `src/lib/__tests__/worker-sync.test.ts` enforces identical content.
 */

/**
 * Keys that must be redacted from any Sentry event payload.
 * Case-insensitive matching on keys. Applied recursively by beforeSend.
 */
const REDACT_KEYS = new Set<string>([
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "idtoken",
  "id_token",
  "authorization",
  "cookie",
  "set-cookie",
  "x-webhook-secret",
  "x-telegram-bot-api-secret-token",
])

/**
 * Recursively redact sensitive keys from any object.
 * Case-insensitive matching on keys. Depth-limited for safety.
 */
function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 10) return "[DEPTH_LIMIT]"
  if (value === null || value === undefined) return value
  if (typeof value !== "object") return value
  if (Array.isArray(value)) {
    return value.map((v) => redactDeep(v, depth + 1))
  }
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      result[k] = "[REDACTED]"
    } else {
      result[k] = redactDeep(v, depth + 1)
    }
  }
  return result
}

/**
 * beforeSend hook: applied to every Sentry event before network dispatch.
 * Strips PII and sensitive values. Returns null to drop the event entirely
 * if needed (not used currently).
 */
export function sentryBeforeSend(
  event: ErrorEvent,
  _hint: EventHint
): ErrorEvent | null {
  // Redact request-level data
  if (event.request) {
    if (event.request.headers) {
      event.request.headers = redactDeep(event.request.headers) as Record<
        string,
        string
      >
    }
    if (event.request.cookies) {
      event.request.cookies = "[REDACTED]" as unknown as Record<string, string>
    }
    if (event.request.data) {
      event.request.data = redactDeep(event.request.data)
    }
    if (event.request.query_string) {
      // Best-effort: zero out query string entirely rather than parsing
      event.request.query_string = "[REDACTED]"
    }
  }

  // Redact extra context + tags
  if (event.extra) {
    event.extra = redactDeep(event.extra) as Record<string, unknown>
  }
  if (event.contexts) {
    event.contexts = redactDeep(event.contexts) as typeof event.contexts
  }

  // Scrub breadcrumbs (they often contain request bodies)
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (redactDeep(b.data) as typeof b.data) : b.data,
    }))
  }

  // Remove user fields except id (defense in depth — sendDefaultPii: false
  // should already prevent this, but we trust nothing)
  if (event.user) {
    event.user = { id: event.user.id ?? "unknown" }
  }

  return event
}

/**
 * Returns true if Sentry is configured (DSN present). Used by callers
 * to conditionally enable features that depend on Sentry being on.
 */
export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN)
}

/**
 * Safe wrapper around Sentry.captureException.
 *
 * Usage:
 *   import { captureException } from "@/lib/sentry"
 *   try { ... } catch (e) {
 *     captureException(e, { context: "crm/contact-sync", userId: "..." })
 *   }
 *
 * Direct Sentry.captureException() is also fine — this helper is just sugar
 * for consistent tags/context.
 */
export async function captureException(
  err: unknown,
  context?: {
    context?: string
    userId?: string
    tags?: Record<string, string>
  }
): Promise<void> {
  if (!isSentryEnabled()) return
  try {
    // Dynamic import keeps this helper shareable between monolith and workers.
    // The worker copy resolves "@sentry/node", the monolith "@sentry/nextjs" —
    // both re-export captureException with the same signature from @sentry/core.
    const Sentry = await import(
      /* webpackIgnore: true */ "@sentry/nextjs"
    ).catch(() => import(/* webpackIgnore: true */ "@sentry/node"))
    Sentry.captureException(err, {
      tags: { ...(context?.tags ?? {}) },
      contexts: context?.context
        ? { [context.context]: { ref: context.context } }
        : undefined,
      user: context?.userId ? { id: context.userId } : undefined,
    })
  } catch {
    // Never throw from capture — degrade silently
  }
}
