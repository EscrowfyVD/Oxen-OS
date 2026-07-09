import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: { company: { findMany: vi.fn() } },
}))
vi.mock("@/lib/trigify-matching", () => ({ findOrCreateCompanyByName: vi.fn() }))

import { matchCompanyByName, matchOrCreateCompanyByName, MATCH_THRESHOLD } from "./apify-account-match"
import { prisma } from "@/lib/prisma"
import { findOrCreateCompanyByName } from "@/lib/trigify-matching"

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

describe("matchOrCreateCompanyByName (PR3c-a no-match capture)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.company.findMany).mockResolvedValue([] as never)
    vi.mocked(findOrCreateCompanyByName).mockResolvedValue({ id: "co-new", created: true } as never)
  })

  it("exports the shared 0.85 threshold", () => {
    expect(MATCH_THRESHOLD).toBe(0.85)
  })

  it("[C1] fuzzy >=0.85 exists ('Wirex' vs CRM 'Wirex Limited') → ATTACH, no create", async () => {
    // "Wirex Limited" normalizes to "wirex" (legal suffix stripped) → exact 1.0.
    // The exact-match create alone would have missed this and duplicated.
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "c-wirex", name: "Wirex Limited" },
    ] as never)

    const r = await matchOrCreateCompanyByName("Wirex")
    expect(r).toEqual({ companyId: "c-wirex", created: false, confidence: 1.0 })
    expect(findOrCreateCompanyByName).not.toHaveBeenCalled()
  })

  it("[C2] no candidate at all → CREATE with name + linkedinUrl + location", async () => {
    const r = await matchOrCreateCompanyByName("payabl.", {
      linkedinUrl: "https://uk.linkedin.com/company/payabl-eu",
      location: "Limassol, Cyprus",
    })
    expect(findOrCreateCompanyByName).toHaveBeenCalledWith(
      "payabl.",
      "https://uk.linkedin.com/company/payabl-eu",
      { location: "Limassol, Cyprus" },
    )
    expect(r).toEqual({ companyId: "co-new", created: true, confidence: null })
  })

  it("[C3] only a sub-0.85 candidate (different company) → still creates, confidence passthrough", async () => {
    // "Kaizen Wirex Group" contains "wirex" → 0.7 < 0.85 → a DIFFERENT company;
    // capture must not attach to it.
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: "c-kaizen", name: "Kaizen Wirex Group" },
    ] as never)

    const r = await matchOrCreateCompanyByName("Wirex")
    expect(findOrCreateCompanyByName).toHaveBeenCalled()
    expect(r).toEqual({ companyId: "co-new", created: true, confidence: 0.7 })
  })

  it("[C4] unmatchable name (legal-suffix-only) → null, NEVER creates junk", async () => {
    expect(await matchOrCreateCompanyByName("Ltd")).toBeNull()
    expect(findOrCreateCompanyByName).not.toHaveBeenCalled()
    expect(prisma.company.findMany).not.toHaveBeenCalled()
  })

  it("[C5] find-or-create declines (blank after trim) → null", async () => {
    vi.mocked(findOrCreateCompanyByName).mockResolvedValue(null as never)
    expect(await matchOrCreateCompanyByName("Acme")).toBeNull()
  })
})
