/**
 * Route test for the regulated-fintech compliance check — Phase 0 proof:
 * an unusable LLM verdict must NEVER be recorded as a real audit. The old code
 * fabricated overallRisk:'medium', score:50, findings:[] on parse-fail and persisted
 * it as a completed 'needs_changes' audit — a fabricated regulatory record.
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
vi.mock("@/lib/admin", () => ({ requirePageAccess: vi.fn() }))
vi.mock("@/lib/ai/llm-alert", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/llm-alert")>()
  return { ...actual, notifyLlmFailure: vi.fn() } // keep LlmOutputError/isLlmFailure real, spy the alert
})
vi.mock("@/lib/prisma", () => ({
  prisma: { contentComplianceCheck: { create: vi.fn(), update: vi.fn() } },
}))

import { POST } from "./route"
import { requirePageAccess } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { notifyLlmFailure } from "@/lib/ai/llm-alert"

const BODY = { platform: "linkedin", contentType: "post", contentText: "Guaranteed 20% returns!", jurisdictions: ["CH"] }
const req = () =>
  new Request("http://x/api/marketing/compliance-check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(BODY),
  })

describe("POST /api/marketing/compliance-check — no fabricated verdict on unusable output", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePageAccess).mockResolvedValue({ error: null, session: { user: { name: "V" } } } as never)
    vi.mocked(prisma.contentComplianceCheck.create).mockResolvedValue({ id: "cc-1" } as never)
    vi.mocked(prisma.contentComplianceCheck.update).mockImplementation(
      (({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "cc-1", ...data })) as never,
    )
  })

  it("[1] unparseable output → status 'error', NO fabricated medium/50, 502, alert", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "I cannot assess this content." }] })
    const res = await POST(req())
    expect(res.status).toBe(502)
    const data = vi.mocked(prisma.contentComplianceCheck.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data).toMatchObject({ status: "error", overallRisk: null, score: null })
    expect(data.status).not.toBe("needs_changes") // the old fabricated status
    expect(data.score).not.toBe(50) // the old fabricated score
    expect(notifyLlmFailure).toHaveBeenCalledTimes(1)
  })

  it("[2] valid-but-incomplete (no overallRisk/score) → status 'error', 502, alert", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: '{"summary": "looks fine"}' }] })
    const res = await POST(req())
    expect(res.status).toBe(502)
    const data = vi.mocked(prisma.contentComplianceCheck.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data).toMatchObject({ status: "error", score: null })
    expect(notifyLlmFailure).toHaveBeenCalledTimes(1)
  })

  it("[3] a real verdict is persisted normally (high → rejected), 200, no alert", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"overallRisk":"high","score":15,"summary":"Missing risk warnings","findings":[]}' }],
    })
    const res = await POST(req())
    expect(res.status).toBe(200)
    const data = vi.mocked(prisma.contentComplianceCheck.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data).toMatchObject({ status: "rejected", overallRisk: "high", score: 15 })
    expect(notifyLlmFailure).not.toHaveBeenCalled()
  })
})
