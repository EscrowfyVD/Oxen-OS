/**
 * Tests for the ScoringConfig v1 seed script (Sprint 3a B2).
 *
 * Two layers of coverage:
 *   - buildScoringConfigV1() — pure, no DB. Asserts shape, validation
 *     contract, and presence of all 9 intent categories + 5 ICP factors.
 *   - seedScoringConfigV1(client) — Prisma-mocked. Asserts upsert
 *     branching (create vs update) and the "deactivate others"
 *     invariant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  buildScoringConfigV1,
  buildScoringConfigV2,
  seedScoringConfigV1,
  seedScoringConfigV2,
} from "./seed-scoring-config"
import { validateScoringConfig } from "../../src/lib/scoring/config-validation"

// ─── Pure function tests ─────────────────────────────────────────────

describe("buildScoringConfigV1", () => {
  it("[1] produces a blob that passes Zod validation", () => {
    const blob = buildScoringConfigV1()
    const validation = validateScoringConfig(blob)
    expect(validation.ok).toBe(true)
  })

  it("[2] contains all 9 intent categories (A-I)", () => {
    const blob = buildScoringConfigV1()
    const codes = Object.keys(blob.intentCategories).sort()
    expect(codes).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I"])
  })

  it("[3] contains all 5 ICP factors with maxPoints summing to 50", () => {
    const blob = buildScoringConfigV1()
    const f = blob.icpFactors
    expect(f.intermediaryType).toBeDefined()
    expect(f.companySize).toBeDefined()
    expect(f.decisionMakerAccess).toBeDefined()
    expect(f.geography).toBeDefined()
    expect(f.patternMatch).toBeDefined()
    const totalMax =
      f.intermediaryType.maxPoints +
      f.companySize.maxPoints +
      f.decisionMakerAccess.maxPoints +
      f.geography.maxPoints +
      f.patternMatch.maxPoints
    // ICP score caps at 50 by design (other 50 is the intentScore).
    expect(totalMax).toBe(50)
  })

  it("[4] is deterministic — two calls produce identical output", () => {
    const a = buildScoringConfigV1()
    const b = buildScoringConfigV1()
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

// ─── Prisma-mocked seed tests ────────────────────────────────────────

interface MockClient {
  scoringConfig: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
  }
}

function makeMockClient(): MockClient {
  return {
    scoringConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  }
}

describe("seedScoringConfigV1", () => {
  let client: MockClient

  beforeEach(() => {
    client = makeMockClient()
  })

  it("[5] creates v1 when no existing row found", async () => {
    client.scoringConfig.findUnique.mockResolvedValue(null)
    client.scoringConfig.updateMany.mockResolvedValue({ count: 0 })
    client.scoringConfig.create.mockResolvedValue({ id: "cfg-1" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await seedScoringConfigV1(client as any)
    expect(result).toEqual({ version: 1, action: "created" })
    expect(client.scoringConfig.create).toHaveBeenCalledTimes(1)

    const createArg = client.scoringConfig.create.mock.calls[0][0]
    expect(createArg.data.version).toBe(1)
    expect(createArg.data.isActive).toBe(true)
    expect(createArg.data.notes).toMatch(/Andy reference doc/)
  })

  it("[6] deactivates other active versions before upserting v1", async () => {
    client.scoringConfig.findUnique.mockResolvedValue(null)
    client.scoringConfig.updateMany.mockResolvedValue({ count: 2 })
    client.scoringConfig.create.mockResolvedValue({ id: "cfg-1" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await seedScoringConfigV1(client as any)

    const updateManyArg = client.scoringConfig.updateMany.mock.calls[0][0]
    expect(updateManyArg.where).toMatchObject({
      isActive: true,
      version: { not: 1 },
    })
    expect(updateManyArg.data).toEqual({ isActive: false })
  })

  it("[7] is idempotent — second run on active v1 returns no-op", async () => {
    client.scoringConfig.findUnique.mockResolvedValue({
      id: "cfg-existing",
      isActive: true,
    })
    client.scoringConfig.updateMany.mockResolvedValue({ count: 0 })
    client.scoringConfig.update.mockResolvedValue({ id: "cfg-existing" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await seedScoringConfigV1(client as any)
    expect(result).toEqual({ version: 1, action: "no-op" })
    expect(client.scoringConfig.create).not.toHaveBeenCalled()
    expect(client.scoringConfig.update).toHaveBeenCalledTimes(1)
  })
})

// ─── ScoringConfig v2 reconciliation (Sprint 3d) ─────────────────────

describe("buildScoringConfigV2", () => {
  it("[V2-1] produces a blob that passes Zod validation", () => {
    const blob = buildScoringConfigV2()
    const validation = validateScoringConfig(blob)
    expect(validation.ok).toBe(true)
  })

  it("[V2-2] intermediaryType primary tier is the 6-group model (G1-G6, no G7A/G7B)", () => {
    const blob = buildScoringConfigV2()
    const groups = blob.icpFactors.intermediaryType.tiers.primary.groups
    expect([...groups].sort()).toEqual(["G1", "G2", "G3", "G4", "G5", "G6"])
    expect(groups).not.toContain("G7A")
    expect(groups).not.toContain("G7B")
  })

  it("[V2-3] companySize brackets are realigned to Andy doc", () => {
    const b = buildScoringConfigV2().icpFactors.companySize.brackets
    expect(b.ideal).toEqual({
      points: 10,
      employeesMin: 20,
      employeesMax: 500,
      revenueMin: 2_000_000,
    })
    expect(b.viable).toEqual({
      points: 7,
      employeesMin: 5,
      employeesMax: 20,
      revenueMin: 500_000,
    })
    // edge is the catch-all tail: employeesMax=null captures both <5
    // (fails ideal/viable) and >500 under first-match-wins.
    expect(b.edgeCases).toEqual({
      points: 3,
      employeesMin: 1,
      employeesMax: null,
      revenueMin: 0,
    })
  })

  it("[V2-4] follow-up triggers: role_change + competitor_engagement are rapid, not passive; comment stays immediate", () => {
    const ft = buildScoringConfigV2().followUpTriggers
    expect(ft.rapid.signals).toContain("trigify_role_change")
    expect(ft.rapid.signals).toContain("trigify_competitor_engagement")
    expect(ft.passive.signals).not.toContain("trigify_role_change")
    expect(ft.passive.signals).not.toContain("trigify_competitor_engagement")
    expect(ft.immediate.signals).toContain("trigify_oxen_engagement_comment")
  })

  it("[V2-5] does NOT mutate v1 (structuredClone isolation)", () => {
    // Build v2 (which mutates its own clone), then assert v1 is pristine.
    buildScoringConfigV2()
    const v1 = buildScoringConfigV1()
    expect(v1.icpFactors.intermediaryType.tiers.primary.groups).toContain("G7A")
    expect(v1.icpFactors.intermediaryType.tiers.primary.groups).toContain("G7B")
    expect(v1.followUpTriggers.passive.signals).toContain("trigify_role_change")
    expect(v1.icpFactors.companySize.brackets.viable.points).toBe(6)
  })

  it("[V2-6] is deterministic — two calls produce identical output", () => {
    expect(JSON.stringify(buildScoringConfigV2())).toBe(
      JSON.stringify(buildScoringConfigV2()),
    )
  })
})

describe("seedScoringConfigV2", () => {
  let client: MockClient

  beforeEach(() => {
    client = makeMockClient()
  })

  it("[V2-7] creates v2 active when no existing row found", async () => {
    client.scoringConfig.findUnique.mockResolvedValue(null)
    client.scoringConfig.updateMany.mockResolvedValue({ count: 1 })
    client.scoringConfig.create.mockResolvedValue({ id: "cfg-2" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await seedScoringConfigV2(client as any)
    expect(result).toEqual({ version: 2, action: "created" })
    expect(client.scoringConfig.create).toHaveBeenCalledTimes(1)

    const createArg = client.scoringConfig.create.mock.calls[0][0]
    expect(createArg.data.version).toBe(2)
    expect(createArg.data.isActive).toBe(true)
    expect(createArg.data.notes).toMatch(/v2 reconciliation/)
  })

  it("[V2-8] deactivates v1 (and every other version) before activating v2", async () => {
    client.scoringConfig.findUnique.mockResolvedValue(null)
    client.scoringConfig.updateMany.mockResolvedValue({ count: 1 })
    client.scoringConfig.create.mockResolvedValue({ id: "cfg-2" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await seedScoringConfigV2(client as any)

    const updateManyArg = client.scoringConfig.updateMany.mock.calls[0][0]
    expect(updateManyArg.where).toMatchObject({
      isActive: true,
      version: { not: 2 },
    })
    expect(updateManyArg.data).toEqual({ isActive: false })
  })

  it("[V2-9] is idempotent — second run on active v2 returns no-op", async () => {
    client.scoringConfig.findUnique.mockResolvedValue({
      id: "cfg-2",
      isActive: true,
    })
    client.scoringConfig.updateMany.mockResolvedValue({ count: 0 })
    client.scoringConfig.update.mockResolvedValue({ id: "cfg-2" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await seedScoringConfigV2(client as any)
    expect(result).toEqual({ version: 2, action: "no-op" })
    expect(client.scoringConfig.create).not.toHaveBeenCalled()
    expect(client.scoringConfig.update).toHaveBeenCalledTimes(1)
  })
})
