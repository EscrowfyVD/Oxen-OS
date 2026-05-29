/**
 * Tests for persistScore (Sprint 3c B4).
 *
 * Strategy : mock prisma at the model level + mock the Sprint 3b
 * computePriorityScore module so we control the score the function
 * sees. That lets each test focus on the orchestration logic
 * (negatives → assign → infer → transaction → delta) without
 * re-deriving the full compute pipeline.
 *
 * The prisma.$transaction mock invokes the callback synchronously
 * with a `tx` object that re-exposes the same model mocks — this
 * gives us assertions on the exact transaction shape (the two
 * writes that should land inside the single $transaction call).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    scoreHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("./compute-priority-score", () => ({
  computePriorityScore: vi.fn(),
}))

import { persistScore } from "./persist-score"
import { prisma } from "@/lib/prisma"
import { computePriorityScore } from "./compute-priority-score"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()
const NOW = new Date("2026-05-25T12:00:00Z")

/**
 * Wires the $transaction mock to invoke its callback with a `tx`
 * that proxies the same model mocks — so assertions inspect the
 * writes that happened *inside* the transaction.
 */
function wireTransactionMock() {
  vi.mocked(prisma.$transaction).mockImplementation(async (arg) => {
    if (typeof arg === "function") {
      return arg(prisma as unknown as Parameters<typeof arg>[0])
    }
    return undefined
  })
}

function mockContact(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
    id: "ct-x",
    lemlistStatus: null,
    doNotContact: false,
    excludedFrom: [],
    painTierOverride: null,
    priorityLevel: null,
    ...overrides,
  } as never)
}

function mockScore(overrides: Record<string, unknown> = {}) {
  vi.mocked(computePriorityScore).mockResolvedValue({
    icp: 45,
    intent: 30,
    total: 75,
    signalCount: 3,
    breakdown: {
      icp: {
        intermediaryType: { points: 15, tier: "primary" },
        companySize: { points: 10, bracket: "ideal" },
        decisionMakerAccess: { points: 10, level: "direct" },
        geography: { points: 10, tier: "primary" },
        patternMatch: { points: 0, match: "none" },
      },
      intent: { byCategory: { H: 30 } },
    },
    ...overrides,
  } as never)
}

describe("persistScore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    wireTransactionMock()
  })

  // ─── [1] Happy path — both writes land in the transaction ──────────
  it("[1] CrmContact updated + ScoreHistory inserted in one transaction", async () => {
    mockContact()
    mockScore()
    await persistScore("ct-x", "contact", config, NOW)

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.crmContact.update).toHaveBeenCalledTimes(1)
    expect(prisma.scoreHistory.create).toHaveBeenCalledTimes(1)

    const updateArg = vi.mocked(prisma.crmContact.update).mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: "ct-x" })
    expect(updateArg.data.priorityLevel).toBe("P1") // 75/3 hits P1 thresholds
    expect(updateArg.data.icpScore).toBe(45)
    expect(updateArg.data.intentScore).toBe(30)
    expect(updateArg.data.priorityScore).toBe(75)
    expect(updateArg.data.lastScoredAt).toBe(NOW)
  })

  // ─── [2] icpScoreBreakdown overwritten with Sprint 3b shape (D4) ──
  it("[2] icpScoreBreakdown stored in Sprint 3b shape (D4 overwrite)", async () => {
    mockContact()
    mockScore()
    await persistScore("ct-x", "contact", config, NOW)

    const updateArg = vi.mocked(prisma.crmContact.update).mock.calls[0][0]
    const breakdown = updateArg.data.icpScoreBreakdown as unknown as {
      intermediaryType: { points: number; tier: string }
      companySize: { points: number; bracket: string }
    }
    expect(breakdown.intermediaryType).toEqual({ points: 15, tier: "primary" })
    expect(breakdown.companySize).toEqual({ points: 10, bracket: "ideal" })
  })

  // ─── [3] Promotion : null → P1 → promoted=true ────────────────────
  it("[3] previousLevel null → newLevel P1 → promoted=true", async () => {
    mockContact({ priorityLevel: null })
    mockScore({ total: 75, signalCount: 3 })
    const result = await persistScore("ct-x", "contact", config, NOW)
    expect(result.previousLevel).toBe(null)
    expect(result.newLevel).toBe("P1")
    expect(result.promoted).toBe(true)
  })

  // ─── [4] No promotion : P1 → P1 → promoted=false ──────────────────
  it("[4] previousLevel 'P1' → newLevel 'P1' → promoted=false", async () => {
    mockContact({ priorityLevel: "P1" })
    mockScore({ total: 75, signalCount: 3 })
    const result = await persistScore("ct-x", "contact", config, NOW)
    expect(result.promoted).toBe(false)
  })

  // ─── [5] Demotion : P1 → P3 → promoted=false ──────────────────────
  it("[5] previousLevel 'P1' → newLevel 'P3' → promoted=false (demotion)", async () => {
    mockContact({ priorityLevel: "P1" })
    mockScore({ total: 40, signalCount: 2 })
    const result = await persistScore("ct-x", "contact", config, NOW)
    expect(result.newLevel).toBe("P3")
    expect(result.promoted).toBe(false)
  })

  // ─── [6] email_bounce → adjustedScore reflects -15 deduction ──────
  it("[6] bounced contact → adjustedScore = total - 15", async () => {
    mockContact({ lemlistStatus: "bounced" })
    mockScore({ total: 80, signalCount: 3 })
    const result = await persistScore("ct-x", "contact", config, NOW)
    expect(result.priorityScore).toBe(65) // 80 - 15
    expect(result.actions).toContain("flag_invalid")
  })

  // ─── [7] Excluded contact still writes a ScoreHistory row ─────────
  it("[7] excludedFrom contains 'scoring' → priorityLevel 'Excluded' + ScoreHistory still inserted", async () => {
    mockContact({ excludedFrom: ["scoring"], priorityLevel: "Excluded" })
    mockScore({ total: 90, signalCount: 5 }) // High score still excluded
    const result = await persistScore("ct-x", "contact", config, NOW)
    expect(result.newLevel).toBe("Excluded")
    expect(result.actions).toContain("already_excluded")
    // Audit trail still produced — important for the timeline view.
    expect(prisma.scoreHistory.create).toHaveBeenCalledTimes(1)
    const historyArg = vi.mocked(prisma.scoreHistory.create).mock.calls[0][0]
    expect(historyArg.data.priorityLevel).toBe("Excluded")
  })

  // ─── [8] Pain tier override surfaces (V1 override-only) ───────────
  it("[8] painTierOverride='T2' surfaces in the persisted painTier (V1 override path)", async () => {
    mockContact({ painTierOverride: "T2" })
    mockScore()
    const result = await persistScore("ct-x", "contact", config, NOW)
    expect(result.painTier).toBe("T2")

    const updateArg = vi.mocked(prisma.crmContact.update).mock.calls[0][0]
    expect(updateArg.data.painTier).toBe("T2")
    const historyArg = vi.mocked(prisma.scoreHistory.create).mock.calls[0][0]
    expect(historyArg.data.painTier).toBe("T2")
  })

  // ─── [9] Contact not found → throws ───────────────────────────────
  it("[9] throws when contact not found", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(null)
    mockScore()
    await expect(persistScore("ct-missing", "contact", config, NOW)).rejects.toThrow(/not found/)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // ─── [10] Unsubscribe appends 'scoring' to excludedFrom (D3+D1) ───
  it("[10] unsubscribed contact → excludedFrom gets 'scoring' appended, newLevel 'Excluded'", async () => {
    mockContact({ lemlistStatus: "unsubscribed", excludedFrom: [], priorityLevel: "P3" })
    mockScore({ total: 60, signalCount: 2 })
    const result = await persistScore("ct-x", "contact", config, NOW)
    expect(result.newLevel).toBe("Excluded")
    expect(result.excluded).toBe(true)
    expect(result.actions).toContain("exclude")

    const updateArg = vi.mocked(prisma.crmContact.update).mock.calls[0][0]
    expect(updateArg.data.excludedFrom).toEqual(["scoring"])
  })
})
