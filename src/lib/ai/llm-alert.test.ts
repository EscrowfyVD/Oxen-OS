/**
 * Tests for notifyLlmFailure — the "someone gets pinged" half of the fix.
 * The 2026-06 outage was invisible for a month; this must fire, throttle, and
 * never throw (an alert failure must not mask the real error).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/telegram", () => ({ notifyEmployee: vi.fn().mockResolvedValue(true) }))

import Anthropic from "@anthropic-ai/sdk"
import { notifyEmployee } from "@/lib/telegram"
import { notifyLlmFailure, __resetLlmAlertThrottle, isLlmFailure, LlmOutputError } from "./llm-alert"

const mockedNotify = vi.mocked(notifyEmployee)

describe("notifyLlmFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetLlmAlertThrottle()
    process.env.CRM_BD_EMAILS = "ad@oxen.finance,pg@oxen.finance"
  })

  it("[1] pings every BD recipient with a message naming the source", async () => {
    await notifyLlmFailure({ source: "cron/news-auto-scan", error: new Error("404 not_found_error") })
    expect(mockedNotify).toHaveBeenCalledTimes(2)
    const [email, message] = mockedNotify.mock.calls[0]
    expect(email).toBe("ad@oxen.finance")
    expect(message).toContain("cron/news-auto-scan")
    expect(message).toContain("404 not_found_error")
  })

  it("[2] throttles a repeat failure for the same source (first-then-quiet)", async () => {
    await notifyLlmFailure({ source: "same", error: new Error("boom") })
    await notifyLlmFailure({ source: "same", error: new Error("boom again") })
    expect(mockedNotify).toHaveBeenCalledTimes(2) // 2 recipients, ONE alert — not 4
  })

  it("[3] a different source is not throttled", async () => {
    await notifyLlmFailure({ source: "a", error: new Error("x") })
    await notifyLlmFailure({ source: "b", error: new Error("y") })
    expect(mockedNotify).toHaveBeenCalledTimes(4) // 2 recipients × 2 sources
  })

  it("[4] NEVER throws — even if the transport itself fails", async () => {
    mockedNotify.mockRejectedValueOnce(new Error("telegram down"))
    await expect(
      notifyLlmFailure({ source: "resilient", error: new Error("boom") }),
    ).resolves.toBeUndefined()
  })

  it("[5] no recipients configured → no throw, no send", async () => {
    delete process.env.CRM_BD_EMAILS
    await expect(notifyLlmFailure({ source: "norecip", error: new Error("boom") })).resolves.toBeUndefined()
    expect(mockedNotify).not.toHaveBeenCalled()
  })
})

describe("isLlmFailure (the widen: parse failures now alert, not just APIError)", () => {
  it("true for an Anthropic APIError (call failure)", () => {
    const e = new Anthropic.APIError(404, { type: "error", error: { type: "not_found_error" } }, "x", undefined)
    expect(isLlmFailure(e)).toBe(true)
  })
  it("true for a SyntaxError (JSON.parse failure — the previously-invisible half)", () => {
    let syn: unknown
    try { JSON.parse("{not json") } catch (e) { syn = e }
    expect(syn).toBeInstanceOf(SyntaxError)
    expect(isLlmFailure(syn)).toBe(true)
  })
  it("true for an LlmOutputError (valid-but-incomplete output)", () => {
    expect(isLlmFailure(new LlmOutputError("missing total"))).toBe(true)
  })
  it("false for an unrelated error (a DB error must NOT over-alert)", () => {
    expect(isLlmFailure(new Error("db connection lost"))).toBe(false)
    expect(isLlmFailure(new TypeError("x is undefined"))).toBe(false)
  })
})
