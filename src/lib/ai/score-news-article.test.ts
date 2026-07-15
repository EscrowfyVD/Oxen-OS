/**
 * Tests for scoreNewsArticle — the post-incident CONTRACT: an LLM/API failure must
 * NOT become a fake business result. A genuine low score is INFORMATION; a swallowed
 * error dressed as score 0 is a LIE. These tests pin that distinction.
 */
import { describe, it, expect, vi } from "vitest"
import Anthropic from "@anthropic-ai/sdk"
import { scoreNewsArticle } from "./score-news-article"

function clientReturning(text: string): Anthropic {
  return {
    messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text }] }) },
  } as unknown as Anthropic
}

function clientThrowing(err: unknown): Anthropic {
  return {
    messages: { create: vi.fn().mockRejectedValue(err) },
  } as unknown as Anthropic
}

describe("scoreNewsArticle", () => {
  it("[1] returns the parsed score on a valid response (genuine result)", async () => {
    const client = clientReturning('{"score": 82, "verticals": ["FinTech/Crypto"], "reasoning": "relevant"}')
    const out = await scoreNewsArticle(client, "Crypto bank launches", "…")
    expect(out).toEqual({ score: 82, verticals: ["FinTech/Crypto"], reasoning: "relevant" })
  })

  it("[2] a GENUINE negative (low score) is preserved as information, not thrown", async () => {
    const client = clientReturning('{"score": 5, "verticals": [], "reasoning": "unrelated"}')
    const out = await scoreNewsArticle(client, "Celebrity gossip", "…")
    expect(out.score).toBe(5) // a real evaluated-irrelevant — distinct from an error
  })

  it("[3] an LLM/API ERROR THROWS — it must NOT be swallowed into a fake score:0", async () => {
    const apiErr = new Anthropic.APIError(
      404,
      { type: "error", error: { type: "not_found_error", message: "model: x" } },
      "not found",
      undefined,
    )
    const client = clientThrowing(apiErr)
    await expect(scoreNewsArticle(client, "anything", "…")).rejects.toBe(apiErr)
    // The key guarantee: it did NOT resolve to { score: 0 } (a fabricated irrelevant).
  })
})
