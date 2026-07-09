/**
 * Tests for recomputeCompanyScore (Apify PR3c-b-score). The prisma layer is
 * mocked; computeIntentScore + applyTimeDecay run REAL over mocked signal rows
 * so the accumulation numbers exercise the actual decay math (recon table:
 * 1 fresh jobboard post → 6.0 ; 2 → 12.0 ; 1 funding → 8.0).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intentSignal: { findMany: vi.fn() },
    company: { findUnique: vi.fn(), update: vi.fn() },
    scoreHistory: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}))

import {
  recomputeCompanyScore,
  COMPANY_ENRICH_THRESHOLD,
} from "./recompute-company-score"
import { prisma } from "@/lib/prisma"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()
const NOW = new Date("2026-07-09T12:00:00Z")

function accountSig(points: number, category: string, ageDays: number) {
  return {
    points,
    intentCategory: category,
    createdAt: new Date(NOW.getTime() - ageDays * 24 * 60 * 60 * 1000),
  }
}

function setCompany(intentScore: number | null) {
  vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: "co-1", intentScore } as never)
}

describe("recomputeCompanyScore (PR3c-b-score)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setCompany(null)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.company.update).mockReturnValue({} as never)
    vi.mocked(prisma.scoreHistory.create).mockReturnValue({} as never)
  })

  it("exports T=10 (Vernon doctrine)", () => {
    expect(COMPANY_ENRICH_THRESHOLD).toBe(10)
  })

  it("[1] writes Company.intentScore + lastScoredAt + a ScoreHistory(company) row atomically", async () => {
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([accountSig(6, "G", 1)] as never)

    const r = await recomputeCompanyScore("co-1", config, 2, NOW)

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: "co-1" },
      data: { intentScore: 6, lastScoredAt: NOW },
    })
    const hist = vi.mocked(prisma.scoreHistory.create).mock.calls[0][0].data as Record<string, unknown>
    expect(hist).toMatchObject({
      accountId: "co-1",
      accountType: "company",
      configVersion: 2,
      icpScore: 0,
      intentScore: 6,
      priorityScore: 6,
      priorityLevel: "Company",
      signalCount: 1,
      painTier: null,
    })
    expect(r).toMatchObject({ companyId: "co-1", previousScore: null, newScore: 6, signalCount: 1 })
  })

  it("[2] accumulation matches the recon table — 1 fresh post 6.0 / 2 posts 12.0 / 1 funding 8.0", async () => {
    // 1 fresh jobboard post (apify_g = 6, ≤7d → ×1.0)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([accountSig(6, "G", 1)] as never)
    expect((await recomputeCompanyScore("co-1", config, 2, NOW)).newScore).toBe(6)

    // 2 fresh posts (Mercuryo pattern) → 12.0, crosses T=10
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      accountSig(6, "G", 0),
      accountSig(6, "G", 1),
    ] as never)
    setCompany(null)
    const two = await recomputeCompanyScore("co-1", config, 2, NOW)
    expect(two.newScore).toBe(12)
    expect(two.crossedThreshold).toBe(true) // null (never scored) → 12 ≥ 10, UPWARD

    // 1 fresh funding (apify_f = 8) → 8.0, below T
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([accountSig(8, "F", 2)] as never)
    setCompany(null)
    const funding = await recomputeCompanyScore("co-1", config, 2, NOW)
    expect(funding.newScore).toBe(8)
    expect(funding.crossedThreshold).toBe(false)
  })

  it("[3] THE DECAY TRAP — a falling (or flat) recompute can NEVER cross upward", async () => {
    // Was 12 (2 fresh posts); both aged to 20d → 6 × 0.75 × 2 = 9. Fall: 12 → 9.
    setCompany(12)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      accountSig(6, "G", 20),
      accountSig(6, "G", 20),
    ] as never)
    const fall = await recomputeCompanyScore("co-1", config, 2, NOW)
    expect(fall.newScore).toBe(9)
    expect(fall.newScore).toBeLessThan(12)
    expect(fall.crossedThreshold).toBe(false)

    // Flat at 12 (≥ T on both sides) → still false (no re-fire while above T).
    setCompany(12)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      accountSig(6, "G", 1),
      accountSig(6, "G", 1),
    ] as never)
    const flat = await recomputeCompanyScore("co-1", config, 2, NOW)
    expect(flat.newScore).toBe(12)
    expect(flat.crossedThreshold).toBe(false)
  })

  it("[4] upward crossings — below→above true ; already-above→higher false", async () => {
    // 6 (below T) → 12: crossed.
    setCompany(6)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      accountSig(6, "G", 0),
      accountSig(6, "G", 1),
    ] as never)
    expect((await recomputeCompanyScore("co-1", config, 2, NOW)).crossedThreshold).toBe(true)

    // 10 (already AT T) → 16: NOT a crossing (previous < T is strict).
    setCompany(10)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([
      accountSig(8, "F", 0),
      accountSig(8, "F", 1),
    ] as never)
    expect((await recomputeCompanyScore("co-1", config, 2, NOW)).crossedThreshold).toBe(false)
  })

  it("[5] captured company: 1 account signal, 0 contacts → clean score, no contact dependency", async () => {
    // The prisma mock has NO crmContact surface at all — any contact read
    // would throw. One fresh apify_g signal on a PR3c-a captured company:
    setCompany(null)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([accountSig(6, "G", 0)] as never)
    const r = await recomputeCompanyScore("co-1", config, 2, NOW)
    expect(r).toMatchObject({ previousScore: null, newScore: 6, signalCount: 1, crossedThreshold: false })
  })

  it("[6] zero live signals → writes 0 (scored-and-empty), distinct from null (never scored)", async () => {
    setCompany(3) // had a cooling score
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never) // all expired
    const r = await recomputeCompanyScore("co-1", config, 2, NOW)
    expect(r.newScore).toBe(0)
    expect(r.crossedThreshold).toBe(false)
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: "co-1" },
      data: { intentScore: 0, lastScoredAt: NOW },
    })
  })

  it("[7] unknown company → throws (mirror of persistScore)", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null as never)
    await expect(recomputeCompanyScore("co-x", config, 2, NOW)).rejects.toThrow(
      "company co-x not found",
    )
  })
})
