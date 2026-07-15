/**
 * Route test for the news auto-scan — the end-to-end proof of the hardening RULE:
 *
 *   - On an LLM/API error: NO fake NewsItem is written, the run returns 503, and a
 *     failure alert fires. (Old behavior: a fake score:0 'irrelevant' row + HTTP 200.)
 *   - On a genuine low score: a REAL row IS written (score preserved) — distinct
 *     from an error, and no alert.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>()
  class MockAnthropic {
    messages = { create: mockCreate }
    static APIError = actual.default.APIError
  }
  return { default: MockAnthropic }
})
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/ai/llm-alert", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/llm-alert")>()
  return { ...actual, notifyLlmFailure: vi.fn() } // keep isLlmFailure/LlmOutputError real
})
vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsSource: { findMany: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    newsItem: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
  },
}))

import Anthropic from "@anthropic-ai/sdk"
import { POST } from "./route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyLlmFailure } from "@/lib/ai/llm-alert"

const RSS = `<rss><channel><item><title>Crypto bank news</title><link>https://ex.com/a</link><description>desc</description><pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate></item></channel></rss>`

describe("POST /api/seo/news/auto-scan — LLM failure never becomes a business result", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { email: "vd@oxen.finance" } } as never)
    vi.mocked(prisma.newsSource.findMany).mockResolvedValue([
      { id: "src-1", rssUrl: "https://feed.example/rss" },
    ] as never)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => RSS }))
  })

  it("[1] LLM error → NO fake NewsItem written, 503, and an alert fires", async () => {
    mockCreate.mockRejectedValue(
      new Anthropic.APIError(404, { type: "error", error: { type: "not_found_error", message: "model: x" } }, "not found", undefined),
    )

    const res = await POST()

    expect(prisma.newsItem.create).not.toHaveBeenCalled() // the whole point: no fabricated row
    expect(res.status).toBe(503)
    expect(notifyLlmFailure).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notifyLlmFailure).mock.calls[0][0]).toMatchObject({ source: "cron/news-auto-scan" })
  })

  it("[2] genuine low score → a REAL row IS written (distinct from an error), no alert", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"score": 5, "verticals": [], "reasoning": "unrelated"}' }],
    })

    const res = await POST()

    expect(res.status).toBe(200)
    expect(prisma.newsItem.create).toHaveBeenCalledTimes(1)
    expect(vi.mocked(prisma.newsItem.create).mock.calls[0][0].data).toMatchObject({
      relevanceScore: 5,
      status: "irrelevant",
    })
    expect(notifyLlmFailure).not.toHaveBeenCalled()
  })
})
