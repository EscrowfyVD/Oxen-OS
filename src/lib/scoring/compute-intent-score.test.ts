/**
 * Tests for computeIntentScore (Sprint 3b B2).
 *
 * Mock prisma.intentSignal.findMany at the model level; the function
 * shapes raw signal rows into the IntentScoreResult via applyTimeDecay
 * + per-category aggregation + 50-cap. We don't mock applyTimeDecay —
 * it's exercised end-to-end against the canonical v1 config so a bug
 * in the decay math would surface here too.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intentSignal: {
      findMany: vi.fn(),
    },
  },
}))

import { computeIntentScore } from "./compute-intent-score"
import { prisma } from "@/lib/prisma"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()
const NOW = new Date("2026-05-15T12:00:00Z")

function ageDays(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

function sig(overrides: {
  points: number
  intentCategory: string | null
  ageDays?: number
}) {
  return {
    points: overrides.points,
    intentCategory: overrides.intentCategory,
    createdAt: ageDays(overrides.ageDays ?? 1),
  }
}

describe("computeIntentScore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("[1] no signals → score 0, signalCount 0", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.score).toBe(0)
    expect(result.signalCount).toBe(0)
    expect(result.breakdown.byCategory).toEqual({})
  })

  it("[2] single recent Cat H 6pts → score 6, breakdown.H = 6", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 6, intentCategory: "H", ageDays: 1 }),
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.score).toBe(6)
    expect(result.breakdown.byCategory).toEqual({ H: 6 })
    expect(result.signalCount).toBe(1)
  })

  it("[3] multiple signals same category → category sum", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 5, intentCategory: "H", ageDays: 1 }),
      sig({ points: 6, intentCategory: "H", ageDays: 2 }),
      sig({ points: 3, intentCategory: "H", ageDays: 3 }),
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.breakdown.byCategory.H).toBe(14)
    expect(result.signalCount).toBe(3)
  })

  it("[4] multiple categories → per-category breakdown preserved", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 10, intentCategory: "A", ageDays: 1 }),
      sig({ points: 8, intentCategory: "B", ageDays: 1 }),
      sig({ points: 6, intentCategory: "H", ageDays: 1 }),
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.breakdown.byCategory).toEqual({ A: 10, B: 8, H: 6 })
    expect(result.score).toBe(24)
  })

  it("[5] total > 50 → capped at 50", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 25, intentCategory: "A", ageDays: 1 }),
      sig({ points: 25, intentCategory: "F", ageDays: 1 }),
      sig({ points: 20, intentCategory: "E", ageDays: 1 }),
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.score).toBe(50)
    // Breakdown is NOT capped — preserves explain-UI visibility into
    // the raw contributions.
    const sum = Object.values(result.breakdown.byCategory).reduce((a, b) => a + b, 0)
    expect(sum).toBe(70)
  })

  it("[6] 15-day-old signal → decayed to 0.75x in breakdown", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 12, intentCategory: "H", ageDays: 15 }),
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.breakdown.byCategory.H).toBe(9) // 12 * 0.75
  })

  it("[7] expired signals excluded (decayed = 0)", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 12, intentCategory: "H", ageDays: 1 }),
      // Note: the route's `since` filter would normally drop this,
      // but the in-memory aggregator must also defend against it.
      sig({ points: 12, intentCategory: "A", ageDays: 200 }),
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.score).toBe(12)
    expect(result.breakdown.byCategory.A).toBeUndefined()
    expect(result.signalCount).toBe(1)
  })

  it("[8] signalCount only counts non-expired contributors", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 10, intentCategory: "A", ageDays: 1 }),
      sig({ points: 10, intentCategory: "B", ageDays: 1 }),
      sig({ points: 10, intentCategory: "F", ageDays: 999 }), // expired
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.signalCount).toBe(2)
  })

  it("[9] signalCountByCategory tracks per-category contributions", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 5, intentCategory: "H", ageDays: 1 }),
      sig({ points: 5, intentCategory: "H", ageDays: 2 }),
      sig({ points: 10, intentCategory: "A", ageDays: 1 }),
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.signalCountByCategory).toEqual({ H: 2, A: 1 })
  })

  it("[10] accountType='contact' → filters by contactId only", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await computeIntentScore("ct-x", "contact", config, NOW)
    const callArg = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({ contactId: "ct-x" })
    expect(callArg.where).not.toHaveProperty("companyId")
  })

  it("[11] accountType='company' → account-level partition ONLY ({companyId, contactId:null} — PR3c-b guard)", async () => {
    // PR3c-b-score fixed the dormant company branch: contact signals
    // denormalize companyId (they carry BOTH ids), so WITHOUT contactId:null
    // the company aggregate would re-sum all contact activity — the PR2.5
    // double-count, company side. Lock the exact where.
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await computeIntentScore("co-y", "company", config, NOW)
    const callArg = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({ companyId: "co-y", contactId: null })
    expect(callArg.where).not.toHaveProperty("OR")
  })

  // ─── PR3c-b-score — the level-partition invariant, BOTH directions ──
  // The same account signal appears once in each view (contact via the PR2.5
  // reflection, company via the guarded aggregate); a contact signal appears
  // in the contact view ONLY. The two scores never feed the same consumer.

  it("[11b] partition sentinel — company where excludes contact-level signals by construction", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await computeIntentScore("co-y", "company", config, NOW)
    const where = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!.where as Record<string, unknown>
    // contactId is PINNED to null — a contact-scoped signal (contactId set,
    // companyId denormalized) can never satisfy this predicate.
    expect(where.contactId).toBeNull()
    expect(where.companyId).toBe("co-y")
  })

  it("[11c] partition sentinel — company mode is signals-only (never reads Company.intentScore or any score)", async () => {
    // The prisma mock exposes ONLY intentSignal.findMany. If the company
    // compute touched prisma.company / crmContact / a stored score, it would
    // throw on the missing surface. One call, one model — locked.
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await computeIntentScore("co-y", "company", config, NOW)
    expect(prisma.intentSignal.findMany).toHaveBeenCalledTimes(1)
  })

  it("[11d] partition sentinel — same account signal counts ONCE in each view, never twice in one", async () => {
    // Simulate the DB answering each predicate faithfully for one account
    // signal (contactId null, companyId co-y) + one contact signal
    // (contactId ct-x, companyId co-y denormalized).
    const accountSig = { ...sig({ points: 6, intentCategory: "G" }), contactId: null, companyId: "co-y" }
    const contactSig = { ...sig({ points: 10, intentCategory: "A" }), contactId: "ct-x", companyId: "co-y" }
    const matches = (w: Record<string, unknown>, s: { contactId: string | null; companyId: string }): boolean => {
      if ("OR" in w) return (w.OR as Array<Record<string, unknown>>).some((b) => matches(b, s))
      if ("contactId" in w && w.contactId !== s.contactId) return false
      if ("companyId" in w && w.companyId !== s.companyId) return false
      return true
    }
    vi.mocked(prisma.intentSignal.findMany).mockImplementation((async (args: { where: Record<string, unknown> }) =>
      [accountSig, contactSig].filter((s) => matches(args.where, s))) as never)

    // company view: the account signal ONLY → 6 (contact signal excluded)
    const companyView = await computeIntentScore("co-y", "company", config, NOW)
    expect(companyView.score).toBe(6)
    expect(companyView.breakdown.byCategory).toEqual({ G: 6 })

    // contact view (PR2.5 reflection): own signal + the account signal, each once → 16
    const contactView = await computeIntentScore("ct-x", "contact", config, NOW, "co-y")
    expect(contactView.score).toBe(16)
    expect(contactView.breakdown.byCategory).toEqual({ A: 10, G: 6 })
  })

  it("[12] DB query excludes intentCategory NULL placeholders", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await computeIntentScore("ct-x", "contact", config, NOW)
    const callArg = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!
    expect(callArg.where).toMatchObject({
      intentCategory: { not: null },
    })
  })

  it("[13] DB query filters by lookback window (90d from v1 config)", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await computeIntentScore("ct-x", "contact", config, NOW)
    const callArg = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!
    const since = (callArg.where as { createdAt: { gte: Date } }).createdAt.gte
    expect(since).toBeInstanceOf(Date)
    const days = (NOW.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)
    expect(days).toBe(90)
  })

  it("[14] exact score = 50 → returns 50 (no over/under-cap)", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 25, intentCategory: "A", ageDays: 1 }),
      sig({ points: 25, intentCategory: "F", ageDays: 1 }),
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.score).toBe(50)
  })

  it("[15] mix of recent + decayed → only weighted contribution counted", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 12, intentCategory: "H", ageDays: 1 }), // 12 * 1.0 = 12
      sig({ points: 12, intentCategory: "H", ageDays: 60 }), // 12 * 0.5 = 6
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW)
    expect(result.breakdown.byCategory.H).toBe(18)
    expect(result.score).toBe(18)
  })

  // ─── PR2.5 — account-signal read-time reflection (5th-arg companyId) ──

  it("[16] contact + companyId → OR query with the disjointness guard (companyId branch REQUIRES contactId:null — the no-double-count invariant)", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await computeIntentScore("ct-x", "contact", config, NOW, "co-1")
    const where = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!.where as {
      OR: Array<Record<string, unknown>>
    }
    expect(where.OR).toEqual([
      { contactId: "ct-x" },
      { companyId: "co-1", contactId: null },
    ])
  })

  it("[17] contact own signals + an account-only company signal → score includes BOTH", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 6, intentCategory: "H", ageDays: 1 }), // the contact's own
      sig({ points: 20, intentCategory: "D", ageDays: 1 }), // account-only (companyId, contactId null)
    ] as never)
    const result = await computeIntentScore("ct-x", "contact", config, NOW, "co-1")
    expect(result.score).toBe(26)
    expect(result.breakdown.byCategory).toEqual({ H: 6, D: 20 })
  })

  it("[18] contact with ZERO own signals but an account-only company signal → now scores (was 0)", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      sig({ points: 15, intentCategory: "E", ageDays: 1 }), // only the account-only signal
    ] as never)
    const result = await computeIntentScore("ct-empty", "contact", config, NOW, "co-1")
    expect(result.score).toBe(15)
    expect(result.signalCount).toBe(1)
  })

  it("[19] companyId null → {contactId} only, no OR (edge: no regression — same as pre-PR2.5)", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    await computeIntentScore("ct-x", "contact", config, NOW, null)
    const where = vi.mocked(prisma.intentSignal.findMany).mock.calls[0][0]!.where
    expect(where).toMatchObject({ contactId: "ct-x" })
    expect(where).not.toHaveProperty("OR")
  })
})
