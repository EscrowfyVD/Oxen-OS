/**
 * Tests for computePriorityScore (Sprint 3b B5).
 *
 * Tests assemble both sub-scores end-to-end (no inner mocks): mock
 * prisma at the model level for all 3 reads (crmContact + deal +
 * intentSignal) and assert the orchestrator wires the pieces
 * correctly. Math correctness is covered by the per-component test
 * files; this file focuses on composition and breakdown shape.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: { findUnique: vi.fn() },
    deal: { findMany: vi.fn() },
    intentSignal: { findMany: vi.fn() },
  },
}))

import { computePriorityScore } from "./compute-priority-score"
import { prisma } from "@/lib/prisma"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()
const NOW = new Date("2026-05-15T12:00:00Z")

function mockMaxIcpContact() {
  vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
    group: "G1",
    email: "ceo@x.com",
    jobTitle: "CEO",
    company: {
      employeeCount: 100,
      revenueRange: "5M-20M",
      country: "United Arab Emirates",
      companySize: "51-200 employees",
    },
  } as never)
}

function mockMinIcpContact() {
  vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
    group: null,
    email: null,
    jobTitle: null,
    company: null,
  } as never)
}

describe("computePriorityScore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as never) // V1: no closed_won
  })

  it("[1] ICP 45 + Intent 0 → total 45, signalCount 0", async () => {
    mockMaxIcpContact()
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    const result = await computePriorityScore("ct-x", "contact", config, NOW)
    expect(result.icp).toBe(45) // max minus Pattern Match (0 deals V1)
    expect(result.intent).toBe(0)
    expect(result.total).toBe(45)
    expect(result.signalCount).toBe(0)
  })

  it("[2] ICP 25 + Intent 20 → total 45", async () => {
    // Contact reaches ICP 25: G1 (15) + viable size (6) + partial DM (5) - geo OOS - pattern noMatch
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
      group: "G1",
      email: "x@y.com",
      jobTitle: "Head of Ops",
      company: { employeeCount: 20, country: null, revenueRange: null, companySize: null },
    } as never)
    // 20pt of intent: Cat H 12pt + Cat A 8pt, both recent
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      { points: 12, intentCategory: "H", createdAt: new Date(NOW.getTime() - 1 * 86400000) },
      { points: 8, intentCategory: "A", createdAt: new Date(NOW.getTime() - 1 * 86400000) },
    ] as never)
    const result = await computePriorityScore("ct-x", "contact", config, NOW)
    expect(result.icp).toBe(26) // 15 + 6 + 5 + 0 + 0 = 26
    expect(result.intent).toBe(20)
    expect(result.total).toBe(46)
  })

  it("[3] ICP 0 + Intent 0 → total 0 (unclassified group = no ICP credit)", async () => {
    mockMinIcpContact()
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    const result = await computePriorityScore("ct-x", "contact", config, NOW)
    // group=null (never classified — every captured company) now scores 0 on
    // factor 1, not the old peripheral 5. Unclassified = no free ICP credit, so
    // an unknown/competitor company can't reach a prospect-grade score.
    expect(result.icp).toBe(0)
    expect(result.intent).toBe(0)
    expect(result.total).toBe(0)
  })

  it("[4] ICP 50 + Intent 50 → total 100 (full max with strong Pattern Match)", async () => {
    mockMaxIcpContact()
    // Strong Pattern Match → +5 → ICP 50
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      {
        contact: {
          group: "G1",
          company: { country: "United Arab Emirates", companySize: "51-200 employees" },
        },
        company: null,
      },
    ] as never)
    // Intent capped at 50 by the engine
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      { points: 25, intentCategory: "A", createdAt: new Date(NOW.getTime() - 1 * 86400000) },
      { points: 25, intentCategory: "F", createdAt: new Date(NOW.getTime() - 1 * 86400000) },
      { points: 20, intentCategory: "E", createdAt: new Date(NOW.getTime() - 1 * 86400000) },
    ] as never)
    const result = await computePriorityScore("ct-x", "contact", config, NOW)
    expect(result.icp).toBe(50)
    expect(result.intent).toBe(50)
    expect(result.total).toBe(100)
  })

  it("[5] breakdown structure includes both ICP and Intent sub-trees", async () => {
    mockMaxIcpContact()
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      { points: 6, intentCategory: "H", createdAt: new Date(NOW.getTime() - 1 * 86400000) },
    ] as never)
    const result = await computePriorityScore("ct-x", "contact", config, NOW)
    expect(result.breakdown.icp).toMatchObject({
      intermediaryType: expect.objectContaining({ points: 15, tier: "primary" }),
      companySize: expect.objectContaining({ points: 10, bracket: "ideal" }),
      decisionMakerAccess: expect.objectContaining({ points: 10, level: "direct" }),
      geography: expect.objectContaining({ points: 10, tier: "primary" }),
      patternMatch: expect.objectContaining({ points: 0, match: "none" }),
    })
    expect(result.breakdown.intent.byCategory).toEqual({ H: 6 })
  })

  it("[6] missing contact propagates the throw", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await expect(
      computePriorityScore("ct-missing", "contact", config, NOW),
    ).rejects.toThrow(/not found/)
  })

  it("[7] account-type=company → intent fetched via companyId; ICP still uses accountId as contactId", async () => {
    // Contact lookup uses accountId as crmContact PK regardless of accountType
    // (semantic: ICP is contact-only V1, accountType only switches Intent's where clause).
    mockMaxIcpContact()
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await computePriorityScore("co-x", "company", config, NOW)
    const intentCall = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!
    expect(intentCall.where).toMatchObject({ companyId: "co-x" })
  })
})
