/**
 * Route test for single-contact ICP scoring — Phase 0 proof (mirrors score-all +
 * ai-worker handleScoreLead, which share the identical `?? 0` fabrication):
 * unusable output must NOT persist a fabricated icpScore:0 / tier_3, must NOT bump
 * lastScoredAt (so the contact is re-scored), must surface (500) + alert.
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
vi.mock("@/lib/worker-config", () => ({ ENABLE_WORKERS: false, JOB_TYPES: { AI_SCORE_LEAD: "ai:score-lead" } }))
vi.mock("@/lib/job-queue", () => ({ createJob: vi.fn() }))
vi.mock("@/lib/crm-config", () => ({ VERTICALS: ["FinTech"], GEO_ZONES: ["EU"] }))
vi.mock("@/lib/ai/llm-alert", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/llm-alert")>()
  return { ...actual, notifyLlmFailure: vi.fn() }
})
vi.mock("@/lib/prisma", () => ({ prisma: { crmContact: { findUnique: vi.fn(), update: vi.fn() } } }))

import { POST } from "./route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyLlmFailure } from "@/lib/ai/llm-alert"

const CONTACT = {
  id: "ct-1", firstName: "A", lastName: "B", email: "a@b.com", jobTitle: "CEO",
  company: { id: "co-1", name: "Acme", industry: "Fin", employeeCount: 100, vertical: [], geoZone: "EU" },
  companySize: "50-200", vertical: ["FinTech"], geoZone: "EU", country: "MT",
  annualRevenueRange: "1M-10M", lifecycleStage: "lead", contactType: "prospect",
  totalInteractions: 3, lastInteraction: null, deals: [], activities: [],
}
const ctx = () => ({ params: Promise.resolve({ contactId: "ct-1" }) })
const post = () => POST(new Request("http://x", { method: "POST" }), ctx())

describe("POST score-lead — no fabricated tier_3 on unusable output", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { email: "vd@oxen.finance" } } as never)
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(CONTACT as never)
    vi.mocked(prisma.crmContact.update).mockImplementation(
      (({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "ct-1", ...data })) as never,
    )
  })

  it("[1] valid JSON but MISSING total → NO write, lastScoredAt NOT bumped, 500, alert", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: '{"vertical_match":10,"reasoning":"partial"}' }] })
    const res = await post()
    expect(res.status).toBe(500)
    expect(prisma.crmContact.update).not.toHaveBeenCalled() // no fabricated 0/tier_3, no lastScoredAt bump
    expect(notifyLlmFailure).toHaveBeenCalledTimes(1)
  })

  it("[2] unparseable output → NO write, 500, alert", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "cannot score this" }] })
    const res = await post()
    expect(res.status).toBe(500)
    expect(prisma.crmContact.update).not.toHaveBeenCalled()
    expect(notifyLlmFailure).toHaveBeenCalledTimes(1)
  })

  it("[3] a valid full score persists normally (tier_1), 200, no alert", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"vertical_match":25,"geographic_fit":15,"company_size":15,"engagement":10,"revenue_potential":10,"total":75,"reasoning":"strong"}' }],
    })
    const res = await post()
    expect(res.status).toBe(200)
    const data = vi.mocked(prisma.crmContact.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data).toMatchObject({ icpScore: 75, icpFit: "tier_1" })
    expect(data.lastScoredAt).toBeInstanceOf(Date)
    expect(notifyLlmFailure).not.toHaveBeenCalled()
  })
})
