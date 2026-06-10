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

  // ─── [1] All 16 updates (13 mapped + 3 deactivated) ───────────────
  it("[1] applies 13 mapping updates + 3 placeholder deactivations (16 total)", async () => {
    const { client, updateMock } = makeMockClient()
    const result = await backfillSignalTypesCategories(client)
    expect(updateMock).toHaveBeenCalledTimes(16)
    expect(result).toEqual({ appliedCount: 13, deactivatedCount: 3 })
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
    // Sprint 3d ScoringConfig v2 — recalibrated 20 → 6.
    expect((directorChange![0] as Call).data.defaultPoints).toBe(6)
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

  // ─── [7] Cat G now holds exactly apify_g (Apify PR3b populates it) ─
  it("[7] exactly apify_g lands in Cat G (Apify PR3b populates the reserved category)", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const catG = updateMock.mock.calls.filter(
      (c) => (c[0] as Call).data.intentCategory === "G",
    )
    expect(catG).toHaveLength(1)
    expect((catG[0][0] as Call).where.code).toBe("apify_g")
    expect((catG[0][0] as Call).data.signalLevel).toBe("account")
  })

  // ─── Sprint 3d — ScoringConfig v2 reconciliation ──────────────────

  // ─── [8] linkedin_post_funding recalibration (30 → 8) ─────────────
  it("[8] recalibrates linkedin_post_funding defaultPoints to 8", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const funding = updateMock.mock.calls.find(
      (c) => (c[0] as Call).where.code === "linkedin_post_funding",
    )
    expect(funding).toBeDefined()
    expect((funding![0] as Call).data.defaultPoints).toBe(8)
    expect((funding![0] as Call).data.triggerType).toBe("rapid")
  })

  // ─── [9] comment trigger reclassification (rapid → immediate) ─────
  it("[9] sets trigify_oxen_engagement_comment triggerType to immediate", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const comment = updateMock.mock.calls.find(
      (c) => (c[0] as Call).where.code === "trigify_oxen_engagement_comment",
    )
    expect(comment).toBeDefined()
    expect((comment![0] as Call).data.triggerType).toBe("immediate")
  })

  // ─── [10] role_change trigger reclassification (passive → rapid) ──
  it("[10] sets trigify_role_change triggerType to rapid", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const roleChange = updateMock.mock.calls.find(
      (c) => (c[0] as Call).where.code === "trigify_role_change",
    )
    expect(roleChange).toBeDefined()
    expect((roleChange![0] as Call).data.triggerType).toBe("rapid")
  })

  // ─── [11] competitor_engagement deliberately untouched ────────────
  // Registry stays `rapid` (already doc-§8.3-correct); the v2 drift fix
  // for this code is in config.followUpTriggers, NOT the registry. Guard
  // against a future edit "helpfully" recalibrating it here.
  it("[11] leaves trigify_competitor_engagement at rapid with no points override", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const competitor = updateMock.mock.calls.find(
      (c) => (c[0] as Call).where.code === "trigify_competitor_engagement",
    )
    expect(competitor).toBeDefined()
    expect((competitor![0] as Call).data.triggerType).toBe("rapid")
    expect((competitor![0] as Call).data.defaultPoints).toBeUndefined()
  })

  // ─── [12] apify_f → Cat F account, points from seed (no override) ──
  it("[12] maps apify_f to Cat F account-level with no points override", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const apifyF = updateMock.mock.calls.find(
      (c) => (c[0] as Call).where.code === "apify_f",
    )
    expect(apifyF).toBeDefined()
    expect((apifyF![0] as Call).data.intentCategory).toBe("F")
    expect((apifyF![0] as Call).data.signalLevel).toBe("account")
    expect((apifyF![0] as Call).data.triggerType).toBe("rapid")
    // Points live in the seed (8, mirroring linkedin_post_funding); the
    // backfill must NOT override them.
    expect((apifyF![0] as Call).data.defaultPoints).toBeUndefined()
  })

  // ─── [13] apify_g → Cat G account, points from seed (no override) ──
  it("[13] maps apify_g to Cat G account-level with no points override", async () => {
    const { client, updateMock } = makeMockClient()
    await backfillSignalTypesCategories(client)

    const apifyG = updateMock.mock.calls.find(
      (c) => (c[0] as Call).where.code === "apify_g",
    )
    expect(apifyG).toBeDefined()
    expect((apifyG![0] as Call).data.intentCategory).toBe("G")
    expect((apifyG![0] as Call).data.signalLevel).toBe("account")
    expect((apifyG![0] as Call).data.triggerType).toBe("passive")
    expect((apifyG![0] as Call).data.defaultPoints).toBeUndefined()
  })
})
