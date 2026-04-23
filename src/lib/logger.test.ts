import { describe, it, expect } from "vitest"
import pino from "pino"
import { Writable } from "node:stream"
import { serializeError, REDACT_PATHS } from "./logger"

/**
 * Pino writes via sonic-boom / fd directly, bypassing `process.stdout.write`
 * spies. Tests build an equivalent logger with a Writable stream we can
 * inspect, mirroring the production redaction config.
 */
function makeTestLogger() {
  const outputs: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      outputs.push(chunk.toString())
      cb()
    },
  })
  const testLogger = pino(
    {
      level: "trace",
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]", remove: false },
      base: { service: "test", env: "test" },
    },
    stream
  )
  return { logger: testLogger, outputs }
}

describe("logger", () => {
  describe("redaction", () => {
    it("redacts password fields", () => {
      const { logger: log, outputs } = makeTestLogger()
      log.info({ user: "x", password: "secret123" }, "test")
      const joined = outputs.join("")
      expect(joined).toContain("[REDACTED]")
      expect(joined).not.toContain("secret123")
    })

    it("redacts access_token at nested depth", () => {
      const { logger: log, outputs } = makeTestLogger()
      log.info({ data: { account: { access_token: "ya29.ACTUAL" } } }, "test")
      const joined = outputs.join("")
      expect(joined).not.toContain("ya29.ACTUAL")
    })

    it("redacts authorization header", () => {
      const { logger: log, outputs } = makeTestLogger()
      log.info(
        { req: { headers: { authorization: "Bearer xyz" } } },
        "test"
      )
      const joined = outputs.join("")
      expect(joined).not.toContain("Bearer xyz")
    })

    it("redacts webhook secret header", () => {
      const { logger: log, outputs } = makeTestLogger()
      log.info(
        { req: { headers: { "x-webhook-secret": "super-secret-value" } } },
        "test"
      )
      const joined = outputs.join("")
      expect(joined).not.toContain("super-secret-value")
    })

    it("leaves non-sensitive fields intact", () => {
      const { logger: log, outputs } = makeTestLogger()
      log.info({ userId: "abc123", action: "signin" }, "test")
      const joined = outputs.join("")
      expect(joined).toContain("abc123")
      expect(joined).toContain("signin")
    })
  })

  describe("serializeError", () => {
    it("serializes Error with name, message, stack", () => {
      const err = new Error("boom")
      const s = serializeError(err)
      expect(s.name).toBe("Error")
      expect(s.message).toBe("boom")
      expect(s.stack).toBeDefined()
    })

    it("handles string errors", () => {
      expect(serializeError("bad thing").message).toBe("bad thing")
    })

    it("handles unknown (object) errors", () => {
      expect(serializeError({ foo: "bar" }).message).toContain("foo")
    })
  })

  describe("child logger (requestId propagation)", () => {
    it("binds requestId and propagates to child logs", () => {
      const { logger: log, outputs } = makeTestLogger()
      const child = log.child({ requestId: "req-abc-123" })
      child.info("hello")
      const joined = outputs.join("")
      expect(joined).toContain("req-abc-123")
    })
  })
})
