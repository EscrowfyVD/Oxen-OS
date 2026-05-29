/**
 * Tests for runScoreRecompute (Sprint 3c B5).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("./config-loader", () => ({
  getActiveScoringConfig: vi.fn(),
}))

vi.mock("./persist-score", () => ({
  persistScore: vi.fn(),
}))

import { runScoreRecompute } from "./score-recompute-runner"
import { prisma } from "@/lib/prisma"
import { getActiveScoringConfig } from "./config-loader"
import { persistScore } from "./persist-score"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()

describe("runScoreRecompute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getActiveScoringConfig).mockResolvedValue(config)
  })

  // ─── [1] Iterates each active contact, calls persistScore once ────
  it("[1] iterates active contacts and calls persistScore once per id", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      { id: "ct-1" }, { id: "ct-2" }, { id: "ct-3" },
    ] as never)
    vi.mocked(persistScore).mockResolvedValue({
      newLevel: "P3",
      promoted: false,
    } as never)

    const result = await runScoreRecompute()
    expect(persistScore).toHaveBeenCalledTimes(3)
    expect(result.processed).toBe(3)
    expect(result.errors).toEqual([])
  })

  // ─── [2] Excludes "scoring"-tagged contacts at the query level ────
  it("[2] passes `NOT excludedFrom has 'scoring'` to findMany", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    await runScoreRecompute()
    const arg = vi.mocked(prisma.crmContact.findMany).mock.calls[0][0]!
    expect(arg.where).toMatchObject({
      NOT: { excludedFrom: { has: "scoring" } },
    })
  })

  // ─── [3] Counts promoted accurately ───────────────────────────────
  it("[3] counts promotions (newLevel rank > previous)", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      { id: "ct-1" }, { id: "ct-2" }, { id: "ct-3" },
    ] as never)
    vi.mocked(persistScore)
      .mockResolvedValueOnce({ promoted: true } as never)
      .mockResolvedValueOnce({ promoted: false } as never)
      .mockResolvedValueOnce({ promoted: true } as never)
    const result = await runScoreRecompute()
    expect(result.promoted).toBe(2)
  })

  // ─── [4] Continues on per-account failure ──────────────────────────
  it("[4] continues on per-account throw, collects errors", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      { id: "ct-1" }, { id: "ct-broken" }, { id: "ct-3" },
    ] as never)
    vi.mocked(persistScore)
      .mockResolvedValueOnce({ promoted: false } as never)
      .mockRejectedValueOnce(new Error("DB write failed"))
      .mockResolvedValueOnce({ promoted: true } as never)

    const result = await runScoreRecompute()
    expect(result.processed).toBe(2)
    expect(result.promoted).toBe(1)
    expect(result.errors).toEqual([
      { accountId: "ct-broken", error: "DB write failed" },
    ])
  })

  // ─── [5] Empty contact list → 0/0/0 ───────────────────────────────
  it("[5] empty active-contact list → all counts 0", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    const result = await runScoreRecompute()
    expect(result).toEqual({ processed: 0, promoted: 0, errors: [] })
    expect(persistScore).not.toHaveBeenCalled()
  })

  // ─── [6] Reads config once, not per contact ───────────────────────
  it("[6] reads ScoringConfig once (cache-friendly)", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      { id: "ct-1" }, { id: "ct-2" },
    ] as never)
    vi.mocked(persistScore).mockResolvedValue({ promoted: false } as never)
    await runScoreRecompute()
    expect(getActiveScoringConfig).toHaveBeenCalledTimes(1)
  })
})
