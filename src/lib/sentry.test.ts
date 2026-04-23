import { describe, it, expect } from "vitest"
import type { ErrorEvent, EventHint } from "@sentry/core"
import { sentryBeforeSend } from "./sentry"

describe("sentryBeforeSend", () => {
  const hint: EventHint = {}

  it("redacts authorization header", () => {
    const event: ErrorEvent = {
      type: undefined,
      request: {
        headers: { authorization: "Bearer secret123", "user-agent": "test" },
      },
    }
    const out = sentryBeforeSend(event, hint)
    expect(out?.request?.headers?.authorization).toBe("[REDACTED]")
    expect(out?.request?.headers?.["user-agent"]).toBe("test")
  })

  it("redacts cookies entirely", () => {
    const event: ErrorEvent = {
      type: undefined,
      request: {
        cookies: { session: "abc" } as unknown as Record<string, string>,
      },
    }
    const out = sentryBeforeSend(event, hint)
    expect(out?.request?.cookies).toBe("[REDACTED]")
  })

  it("redacts access_token nested in extra", () => {
    const event: ErrorEvent = {
      type: undefined,
      extra: { account: { access_token: "ya29.LEAK" } },
    }
    const out = sentryBeforeSend(event, hint)
    const extra = out?.extra as { account: { access_token: string } }
    expect(extra.account.access_token).toBe("[REDACTED]")
  })

  it("redacts query_string (best-effort)", () => {
    const event: ErrorEvent = {
      type: undefined,
      request: { query_string: "token=secret&foo=bar" },
    }
    const out = sentryBeforeSend(event, hint)
    expect(out?.request?.query_string).toBe("[REDACTED]")
  })

  it("scrubs user to ID-only", () => {
    const event: ErrorEvent = {
      type: undefined,
      user: { id: "u1", email: "real@user.com", ip_address: "1.2.3.4" },
    }
    const out = sentryBeforeSend(event, hint)
    expect(out?.user).toEqual({ id: "u1" })
    expect((out?.user as { email?: string }).email).toBeUndefined()
  })

  it("scrubs breadcrumb data", () => {
    const event: ErrorEvent = {
      type: undefined,
      breadcrumbs: [
        {
          category: "log",
          data: { password: "p", action: "login" },
        },
      ],
    }
    const out = sentryBeforeSend(event, hint)
    const bc = out?.breadcrumbs?.[0]?.data as Record<string, string>
    expect(bc.password).toBe("[REDACTED]")
    expect(bc.action).toBe("login")
  })

  it("is idempotent on already-redacted events", () => {
    const event: ErrorEvent = {
      type: undefined,
      request: { headers: { authorization: "[REDACTED]" } },
    }
    const out = sentryBeforeSend(event, hint)
    expect(out?.request?.headers?.authorization).toBe("[REDACTED]")
  })

  it("returns event unchanged when nothing sensitive", () => {
    const event: ErrorEvent = {
      type: undefined,
      message: "hello",
      level: "info",
      tags: { env: "prod" },
    }
    const out = sentryBeforeSend(event, hint)
    expect(out).toEqual(event)
  })

  it("redacts x-webhook-secret header (Sprint 0 webhook paths)", () => {
    const event: ErrorEvent = {
      type: undefined,
      request: {
        headers: { "x-webhook-secret": "SUPER_SECRET_VALUE" },
      },
    }
    const out = sentryBeforeSend(event, hint)
    expect(out?.request?.headers?.["x-webhook-secret"]).toBe("[REDACTED]")
  })
})
