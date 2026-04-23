import pino from "pino"

/**
 * Structured logger for the ai-worker.
 *
 * Dedicated file (not synchronized) because ai-worker doesn't share Prisma
 * wiring with the monolith — the logger is intentionally simpler here.
 */

const isProduction = process.env.NODE_ENV === "production"
const level =
  process.env.LOG_LEVEL?.toLowerCase() ?? (isProduction ? "info" : "debug")

const REDACT_PATHS = [
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
  "authorization",
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.api_key",
  "*.accessToken",
  "*.access_token",
  "*.refreshToken",
  "*.refresh_token",
]

export const logger = pino({
  level,
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  base: {
    service: "ai-worker",
    env: process.env.NODE_ENV ?? "unknown",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProduction
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

export function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { message: typeof err === "string" ? err : JSON.stringify(err) }
}
