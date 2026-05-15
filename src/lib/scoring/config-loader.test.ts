/**
 * Tests for getActiveScoringConfig() (Sprint 3a B4).
 *
 * Mock strategy: stub @/lib/prisma at the model level (only
 * scoringConfig.findFirst is touched). The validation step calls into
 * the real Zod schema — we pass it a valid blob from
 * buildScoringConfigV1() so the validation path is exercised
 * end-to-end without inventing a fake blob.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scoringConfig: {
      findFirst: vi.fn(),
    },
  },
}))

import {
  getActiveScoringConfig,
  invalidateScoringConfigCache,
} from "./config-loader"
import { prisma } from "@/lib/prisma"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

describe("getActiveScoringConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Drop the module-scoped cache between tests so each starts
    // from a cold state.
    invalidateScoringConfigCache()
  })

  it("[1] fetches from DB on first call and returns the validated blob", async () => {
    const blob = buildScoringConfigV1()
    vi.mocked(prisma.scoringConfig.findFirst).mockResolvedValue({
      version: 1,
      config: blob,
    } as never)

    const result = await getActiveScoringConfig()
    expect(result.entryRules.minPriorityScore).toBe(40)
    expect(prisma.scoringConfig.findFirst).toHaveBeenCalledTimes(1)
    expect(prisma.scoringConfig.findFirst).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { version: "desc" },
      select: { config: true, version: true },
    })
  })

  it("[2] returns cached value on second call within TTL", async () => {
    const blob = buildScoringConfigV1()
    vi.mocked(prisma.scoringConfig.findFirst).mockResolvedValue({
      version: 1,
      config: blob,
    } as never)

    const t0 = 1_000_000_000_000
    await getActiveScoringConfig(t0)
    // 30 seconds later — within TTL (60s).
    await getActiveScoringConfig(t0 + 30_000)

    expect(prisma.scoringConfig.findFirst).toHaveBeenCalledTimes(1)
  })

  it("[3] re-fetches after TTL expired", async () => {
    const blob = buildScoringConfigV1()
    vi.mocked(prisma.scoringConfig.findFirst).mockResolvedValue({
      version: 1,
      config: blob,
    } as never)

    const t0 = 1_000_000_000_000
    await getActiveScoringConfig(t0)
    // 61 seconds later — past the 60s TTL.
    await getActiveScoringConfig(t0 + 61_000)

    expect(prisma.scoringConfig.findFirst).toHaveBeenCalledTimes(2)
  })

  it("[4] invalidateScoringConfigCache() forces re-fetch on next call", async () => {
    const blob = buildScoringConfigV1()
    vi.mocked(prisma.scoringConfig.findFirst).mockResolvedValue({
      version: 1,
      config: blob,
    } as never)

    await getActiveScoringConfig()
    invalidateScoringConfigCache()
    await getActiveScoringConfig()

    expect(prisma.scoringConfig.findFirst).toHaveBeenCalledTimes(2)
  })

  it("[5] throws when no active config is found in DB", async () => {
    vi.mocked(prisma.scoringConfig.findFirst).mockResolvedValue(null)

    await expect(getActiveScoringConfig()).rejects.toThrow(
      /No active ScoringConfig found/,
    )
  })

  it("[6] throws when the stored blob fails Zod validation", async () => {
    // Drift simulation: a row whose `config` JSON is missing required
    // top-level keys. Loader must refuse to return a half-baked config.
    vi.mocked(prisma.scoringConfig.findFirst).mockResolvedValue({
      version: 99,
      config: { broken: true } as unknown,
    } as never)

    await expect(getActiveScoringConfig()).rejects.toThrow(
      /version=99.*invalid/,
    )
  })
})
