import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { company: { findMany: vi.fn() } },
}))

import { matchCompanyByName } from "./apify-account-match"
import { prisma } from "@/lib/prisma"

describe("matchCompanyByName", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
  })

  it("returns null on empty / legal-suffix-only input WITHOUT querying", async () => {
    expect(await matchCompanyByName("")).toBeNull()
    expect(await matchCompanyByName("Ltd")).toBeNull() // suffix-only normalizes to ""
    expect(prisma.company.findMany).not.toHaveBeenCalled()
  })

  it("queries candidates by the first normalized token (ILIKE, insensitive)", async () => {
    await matchCompanyByName("Mercury, Inc.")
    const arg = vi.mocked(prisma.company.findMany).mock.calls[0][0] as {
      where: { name: { contains: string; mode: string } }
    }
    expect(arg.where.name.contains).toBe("mercury")
    expect(arg.where.name.mode).toBe("insensitive")
  })

  it("returns the BEST match by confidence (exact 1.0 beats contains 0.7)", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "c-contains", name: "Project Mercury Labs" }, // 0.7 (mid-substring)
      { id: "c-exact", name: "Mercury" }, // 1.0 (exact)
    ] as never)
    const m = await matchCompanyByName("Mercury")
    expect(m).toEqual({ companyId: "c-exact", name: "Mercury", confidence: 1.0 })
  })

  it("does NOT apply the 0.85 cutoff — returns a sub-threshold best (caller thresholds)", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "c-1", name: "Mercury Banking Group International" },
    ] as never)
    const m = await matchCompanyByName("Mercury")
    expect(m?.companyId).toBe("c-1")
    expect(m?.confidence).toBe(0.9) // whole-word starts-with → 0.9, still returned
  })

  it("returns null when no candidate scores above 0", async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "c-1", name: "Completely Different Co" },
    ] as never)
    expect(await matchCompanyByName("Mercury")).toBeNull()
  })
})
