/**
 * Tests for the Sprint 3a B3 backfill script.
 *
 * Mock the Prisma client at the model level — these tests assert what
 * the script SENDS to Prisma, not what Prisma does with it. The
 * groupBy() summary at the tail is mock-friendly: returning [] from
 * the mock yields no console output, which is fine for the assertions
 * we care about.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { backfillSignalTypesCategories } from "./backfill-signal-types-categories"

// Minimal Prisma-shaped mock — only the 2 methods the script calls.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call = { where: { code: string }; data: Record<string, any> }

function makeMockClient() {
  const updateMock = vi.fn().mockResolvedValue({})
  const groupByMock = vi.fn().mockResolvedValue([])
  const client = {
    signalTypeRegistry: {
      update: updateMock,
      groupBy: groupByMock,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { client, updateMock, groupByMock }
}

describe("backfillSignalTypesCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── [1] All 14 updates (11 mapped + 3 deactivated) ───────────────
  it("[1] applies 11 mapping updates + 3 placeholder deactivations (14 total)", async () => {
    const { client, updateMock } = makeMockClient()
    const result = await backfillSignalTypesCategories(client)
    expect(updateMock).toHaveBeenCalledTimes(14)
    expect(result).toEqual({ appliedCount: 11, deactivatedCount: 3 })
  })

  // ─── [2] Cat A on the 3 trigify_oxen_engagement codes ─────────────
  it("[2] sets intentCategory='A' on 3 trigify_oxen_engagement_* codes", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const catA = updateMock.mock.calls.filter(
      (c) => (c[0] as Call).data.intentCategory === "A",
    )
    expect(catA).toHaveLength(3)
    const codes = catA.map((c) => (c[0] as Call).where.code).sort()
    expect(codes).toEqual([
      "trigify_oxen_engagement_comment",
      "trigify_oxen_engagement_like",
      "trigify_profile_visit",
    ])
  })

  // ─── [3] clay_business_loss recalibration (10 → 4) ────────────────
  it("[3] recalibrates clay_business_loss defaultPoints to 4", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const businessLoss = updateMock.mock.calls.find(
      (c) => (c[0] as Call).where.code === "clay_business_loss",
    )
    expect(businessLoss).toBeDefined()
    expect((businessLoss![0] as Call).data.defaultPoints).toBe(4)
    expect((businessLoss![0] as Call).data.intentCategory).toBe("F")
    expect((businessLoss![0] as Call).data.signalLevel).toBe("account")
  })

  // ─── [4] clay_director_change → Cat H account-level per Andy ──────
  it("[4] sets clay_director_change to Cat H account-level (Andy clarification)", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const directorChange = updateMock.mock.calls.find(
      (c) => (c[0] as Call).where.code === "clay_director_change",
    )
    expect(directorChange).toBeDefined()
    expect((directorChange![0] as Call).data.intentCategory).toBe("H")
    expect((directorChange![0] as Call).data.signalLevel).toBe("account")
    expect((directorChange![0] as Call).data.triggerType).toBe("rapid")
    // No explicit recalibration — defaultPoints absent from the update.
    expect((directorChange![0] as Call).data.defaultPoints).toBeUndefined()
  })

  // ─── [5] 3 placeholders deactivated ───────────────────────────────
  it("[5] deactivates the 3 placeholder codes (isActive=false)", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const deactivations = updateMock.mock.calls.filter(
      (c) => (c[0] as Call).data.isActive === false,
    )
    expect(deactivations).toHaveLength(3)
    const codes = deactivations.map((c) => (c[0] as Call).where.code).sort()
    expect(codes).toEqual([
      "clay_legacy_intent",
      "n8n_external_signal",
      "trigify_intent_signal",
    ])
  })

  // ─── [6] Idempotency — re-running produces identical Prisma calls ─
  it("[6] is idempotent — re-running produces the same call sequence", async () => {
    const { client: c1, updateMock: u1 } = makeMockClient()
    const { client: c2, updateMock: u2 } = makeMockClient()
    await backfillSignalTypesCategories(c1)
    await backfillSignalTypesCategories(c2)
    expect(u1.mock.calls).toEqual(u2.mock.calls)
  })

  // ─── [7] Cat G stays empty in V1 (Vernon decision pinned) ─────────
  it("[7] no code lands in Cat G (V1 reserved for future sources)", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const catG = updateMock.mock.calls.filter(
      (c) => (c[0] as Call).data.intentCategory === "G",
    )
    expect(catG).toHaveLength(0)
  })
})
