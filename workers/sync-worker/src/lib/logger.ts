import pino from "pino"

/**
 * Structured logger for Oxen OS (monolith side).
 *
 * Usage:
 *   import { logger } from "@/lib/logger"
 *   logger.info({ userId: "123" }, "user signed in")
 *   logger.error({ err }, "failed to sync calendar")
 *
 * Per-request child logger (in API routes / Server Components):
 *   const log = childLoggerFromRequest(req)
 *   log.info("handling request")
 *
 * ⚠️ WORKER SYNC — This file is the canonical source. A copy exists at
 *   workers/sync-worker/src/lib/logger.ts and is synchronized via
 *   `npm run worker:sync-libs`. SHA-256 hash test in
 *   src/lib/__tests__/worker-sync.test.ts enforces byte-identical content.
 */

const isProduction = process.env.NODE_ENV === "production"
// Tests bypass pino-pretty transport — transport runs in a worker thread
// that doesn't go through process.stdout.write, breaking spy-based tests.
const isTestRun = process.env.NODE_ENV === "test"

const level =
  process.env.LOG_LEVEL?.toLowerCase() ?? (isProduction ? "info" : "debug")

/**
 * Fields to redact from any logged object (anywhere in the tree).
 * Applied case-insensitively via pino's built-in redact feature.
 *
 * Paths use dot notation + wildcards (pino syntax). See:
 * https://getpino.io/#/docs/redaction
 *
 * Exported so that tests can build an equivalent logger with a custom
 * destination without duplicating the list.
 */
export const REDACT_PATHS = [
  // Top-level sensitive keys
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "idToken",
  "id_token",
  "clientSecret",
  "client_secret",
  "webhookSecret",
  "webhook_secret",
  "authorization",
  // Nested via request shape
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-webhook-secret"]',
  'req.headers["x-telegram-bot-api-secret-token"]',
  'res.headers["set-cookie"]',
  // Single-level wildcards (pino fast-redact: `*` is single-level only)
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.api_key",
  "*.accessToken",
  "*.access_token",
  "*.refreshToken",
  "*.refresh_token",
  "*.idToken",
  "*.id_token",
  // Depth-2 and depth-3 for the highest-sensitivity OAuth fields,
  // which frequently appear nested: { data: { account: { access_token: ... } } }
  "*.*.password",
  "*.*.access_token",
  "*.*.refresh_token",
  "*.*.id_token",
  "*.*.secret",
  "*.*.*.access_token",
  "*.*.*.refresh_token",
  "*.*.*.id_token",
]

/**
 * Base logger instance.
 *
 * In dev : pretty-print via pino-pretty transport for readability.
 * In prod: JSON to stdout — Railway auto-ingests.
 */
export const logger = pino({
  level,
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
    remove: false, // Keep keys but replace values — so absence doesn't hide structure
  },
  // Base fields attached to every log
  base: {
    service: "oxen-os",
    env: process.env.NODE_ENV ?? "unknown",
  },
  // Format ISO timestamp (human-readable in structured form)
  timestamp: pino.stdTimeFunctions.isoTime,
  // Transport only in dev (pretty-print) — skipped in prod (raw JSON) and
  // in tests (worker thread bypasses stdout spies).
  ...(isProduction || isTestRun
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,service,env",
          },
        },
      }),
})

/**
 * Helper: create a child logger with a requestId bound.
 *
 * Usage in Next.js API route:
 *   const log = childLoggerFromRequest(req)
 *   log.info({ userEmail }, "processing request")
 */
export function childLoggerFromRequest(req: Request): pino.Logger {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()
  return logger.child({ requestId })
}

/**
 * Helper: safely extract error message + stack for logging.
 * Use as: logger.error({ err: serializeError(e) }, "msg")
 */
export function serializeError(err: unknown): {
  name?: string
  message: string
  stack?: string
} {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
  }
  return { message: typeof err === "string" ? err : JSON.stringify(err) }
}
