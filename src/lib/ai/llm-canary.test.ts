/**
 * Tests for runLlmCanary — the boot/cron probe that makes the NEXT model
 * deprecation loud instead of invisible. Never throws; reports ok/error.
 */
import { describe, it, expect, vi } from "vitest"
import Anthropic from "@anthropic-ai/sdk"
import { runLlmCanary } from "./llm-canary"
import { CLAUDE_MODEL } from "./model"

describe("runLlmCanary", () => {
  it("[1] ok:true when the model answers", async () => {
    const client = {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "hi" }] }) },
    } as unknown as Anthropic
    const r = await runLlmCanary(client)
    expect(r).toEqual({ ok: true, model: CLAUDE_MODEL })
  })

  it("[2] pings the REAL model with a 1-token prompt (not a cheaper proxy)", async () => {
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "hi" }] })
    await runLlmCanary({ messages: { create } } as unknown as Anthropic)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: CLAUDE_MODEL, max_tokens: 1 }))
  })

  it("[3] ok:false (never throws) when the model call fails — the loud-but-safe signal", async () => {
    const apiErr = new Anthropic.APIError(404, { type: "error", error: { type: "not_found_error" } }, "not found", undefined)
    const client = { messages: { create: vi.fn().mockRejectedValue(apiErr) } } as unknown as Anthropic
    const r = await runLlmCanary(client)
    expect(r.ok).toBe(false)
    expect(r.model).toBe(CLAUDE_MODEL)
    expect(r.error).toContain("not_found_error")
  })
})
