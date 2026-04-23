import type { ErrorEvent, EventHint } from "@sentry/core"

/**
 * Sentry beforeSend helper for ai-worker.
 *
 * Dedicated file (not synchronized with monolith) because ai-worker uses
 * @sentry/node directly — the logic is the same as src/lib/sentry.ts but
 * this copy lives independently for simplicity.
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
])

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

export function sentryBeforeSend(
  event: ErrorEvent,
  _hint: EventHint
): ErrorEvent | null {
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
  }
  if (event.extra) {
    event.extra = redactDeep(event.extra) as Record<string, unknown>
  }
  if (event.contexts) {
    event.contexts = redactDeep(event.contexts) as typeof event.contexts
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (redactDeep(b.data) as typeof b.data) : b.data,
    }))
  }
  if (event.user) {
    event.user = { id: event.user.id ?? "unknown" }
  }
  return event
}
