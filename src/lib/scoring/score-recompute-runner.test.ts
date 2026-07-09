/**
 * Tests for runScoreRecompute (Sprint 3c B5).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findMany: vi.fn(),
    },
    // PR3c-b-score — the company DECAY pass sweeps Company rows.
    company: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("./config-loader", () => ({
  getActiveScoringConfigWithVersion: vi.fn(),
}))

vi.mock("./persist-score", () => ({
  persistScore: vi.fn(),
}))

vi.mock("./recompute-company-score", () => ({
  recomputeCompanyScore: vi.fn(),
}))

import { runScoreRecompute } from "./score-recompute-runner"
import { prisma } from "@/lib/prisma"
import { getActiveScoringConfigWithVersion } from "./config-loader"
import { persistScore } from "./persist-score"
import { recomputeCompanyScore } from "./recompute-company-score"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()
// != 1 to prove the real active version threads through (Finding 1).
const CONFIG_VERSION = 2

describe("runScoreRecompute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getActiveScoringConfigWithVersion).mockResolvedValue({
      config,
      version: CONFIG_VERSION,
    })
    // PR3c-b-score defaults: empty company sweep → contact tests unaffected.
    vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
    vi.mocked(recomputeCompanyScore).mockResolvedValue({
      companyId: "co-x", previousScore: 6, newScore: 4.5, signalCount: 1, crossedThreshold: false,
    } as never)
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
  it("[5] empty active-contact + company lists → all counts 0", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    const result = await runScoreRecompute()
    expect(result).toEqual({
      processed: 0,
      promoted: 0,
      companiesProcessed: 0,
      companiesCrossed: 0,
      errors: [],
    })
    expect(persistScore).not.toHaveBeenCalled()
    expect(recomputeCompanyScore).not.toHaveBeenCalled()
  })

  // ─── [6] Reads config+version once, threads version to persistScore ─
  it("[6] reads config+version once and threads the version into persistScore", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([
      { id: "ct-1" }, { id: "ct-2" },
    ] as never)
    vi.mocked(persistScore).mockResolvedValue({ promoted: false } as never)
    await runScoreRecompute()
    expect(getActiveScoringConfigWithVersion).toHaveBeenCalledTimes(1)
    // The version from the loader must reach persistScore (Finding 1).
    expect(persistScore).toHaveBeenCalledWith(
      "ct-1",
      "contact",
      config,
      CONFIG_VERSION,
      expect.any(Date),
    )
  })

  // ─── PR3c-b-score — the company DECAY pass ─────────────────────────

  it("[7] sweeps intentScore > 0 companies and recomputes each (decay refresh)", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "co-1" }, { id: "co-2" },
    ] as never)

    const result = await runScoreRecompute()

    // Sweep predicate locked: null (never scored) and 0 (fully cooled) are
    // OUT — only live scores decay; no hourly ScoreHistory spam for dead rows.
    const arg = vi.mocked(prisma.company.findMany).mock.calls[0][0]!
    expect(arg.where).toEqual({ intentScore: { gt: 0 } })
    expect(recomputeCompanyScore).toHaveBeenCalledTimes(2)
    expect(recomputeCompanyScore).toHaveBeenCalledWith("co-1", config, CONFIG_VERSION, expect.any(Date))
    expect(result.companiesProcessed).toBe(2)
    expect(result.companiesCrossed).toBe(0)
  })

  it("[8] company-pass isolation — one failure collected, the rest recompute; contacts unaffected", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([{ id: "ct-1" }] as never)
    vi.mocked(persistScore).mockResolvedValue({ promoted: false } as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "co-ok" }, { id: "co-bad" }, { id: "co-ok2" },
    ] as never)
    vi.mocked(recomputeCompanyScore)
      .mockResolvedValueOnce({ companyId: "co-ok", previousScore: 6, newScore: 4.5, signalCount: 1, crossedThreshold: false } as never)
      .mockRejectedValueOnce(new Error("company score boom") as never)
      .mockResolvedValueOnce({ companyId: "co-ok2", previousScore: 3, newScore: 0, signalCount: 0, crossedThreshold: false } as never)

    const result = await runScoreRecompute()
    expect(result.processed).toBe(1) // contact pass untouched by company failures
    expect(result.companiesProcessed).toBe(2)
    expect(result.errors).toEqual([{ accountId: "co-bad", error: "company score boom" }])
  })

  it("[9] a crossing surfacing in the decay pass is COUNTED (missed-event tell), never acted on", async () => {
    vi.mocked(prisma.crmContact.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: "co-1" }] as never)
    vi.mocked(recomputeCompanyScore).mockResolvedValue({
      companyId: "co-1", previousScore: 6, newScore: 12, signalCount: 2, crossedThreshold: true,
    } as never)

    const result = await runScoreRecompute()
    expect(result.companiesCrossed).toBe(1)
    // Nothing else happens: no enrichment surface exists in this module at all.
  })
})
