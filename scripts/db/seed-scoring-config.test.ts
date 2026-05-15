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
import { buildScoringConfigV1, seedScoringConfigV1 } from "./seed-scoring-config"
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
