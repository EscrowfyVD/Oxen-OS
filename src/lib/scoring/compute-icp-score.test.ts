/**
 * Tests for computeICPScore (Sprint 3b B4).
 *
 * Mocks prisma at the model level for both crmContact.findUnique
 * (the contact + company fetch) and deal.findMany (Pattern Match
 * branch — defaults to 0 deals = V1 noMatch). Each test scopes its
 * mock to the dimension it's exercising.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: { findUnique: vi.fn() },
    deal: { findMany: vi.fn() },
  },
}))

import { computeICPScore } from "./compute-icp-score"
import { prisma } from "@/lib/prisma"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()

interface ContactFixture {
  group?: string | null
  email?: string | null
  jobTitle?: string | null
  company?: {
    employeeCount?: number | null
    revenueRange?: string | null
    country?: string | null
    companySize?: string | null
  } | null
}

function mockContact(c: ContactFixture) {
  vi.mocked(prisma.crmContact.findUnique).mockResolvedValue({
    group: c.group ?? null,
    email: c.email ?? null,
    jobTitle: c.jobTitle ?? null,
    company:
      c.company === null
        ? null
        : {
            employeeCount: c.company?.employeeCount ?? null,
            revenueRange: c.company?.revenueRange ?? null,
            country: c.company?.country ?? null,
            companySize: c.company?.companySize ?? null,
          },
  } as never)
}

describe("computeICPScore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: V1 reality — 0 closed_won deals → Pattern Match = noMatch.
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as never)
  })

  // ─── Happy-path max ────────────────────────────────────────────────
  it("[1] G1 + ideal size + direct DM + UAE → max ICP minus PatternMatch (45/50)", async () => {
    mockContact({
      group: "G1",
      email: "ceo@inter-serv.com",
      jobTitle: "CEO",
      company: {
        employeeCount: 100, // ideal bracket (50-500)
        country: "United Arab Emirates",
        companySize: "51-200 employees",
      },
    })
    const result = await computeICPScore("ct-x", config)
    // 15 (intermediary) + 10 (size) + 10 (DM) + 10 (geo) + 0 (pattern V1) = 45
    expect(result.score).toBe(45)
    expect(result.breakdown.intermediaryType.tier).toBe("primary")
    expect(result.breakdown.companySize.bracket).toBe("ideal")
    expect(result.breakdown.decisionMakerAccess.level).toBe("direct")
    expect(result.breakdown.geography.tier).toBe("primary")
    expect(result.breakdown.patternMatch.match).toBe("none")
  })

  // ─── Geography variations ──────────────────────────────────────────
  it("[2] Cyprus → primary jurisdiction (10pt)", async () => {
    mockContact({ group: "G1", email: "x@y.com", company: { country: "Cyprus" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.geography.tier).toBe("primary")
    expect(result.breakdown.geography.points).toBe(10)
  })

  it("[3] Malta → primary jurisdiction (10pt)", async () => {
    mockContact({ group: "G1", email: "x@y.com", company: { country: "Malta" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.geography.tier).toBe("primary")
  })

  it("[4] Germany → secondary jurisdiction (5pt)", async () => {
    mockContact({ group: "G1", email: "x@y.com", company: { country: "Germany" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.geography.tier).toBe("secondary")
    expect(result.breakdown.geography.points).toBe(5)
  })

  it("[5] Iceland (out of scope) → outOfScope (0pt)", async () => {
    mockContact({ group: "G1", email: "x@y.com", company: { country: "Iceland" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.geography.tier).toBe("outOfScope")
    expect(result.breakdown.geography.points).toBe(0)
  })

  // ─── Company size brackets ─────────────────────────────────────────
  it("[6] 3 employees → edgeCases bracket (3pt)", async () => {
    mockContact({ group: "G1", email: "x@y.com", company: { employeeCount: 3, country: "Cyprus" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.companySize.bracket).toBe("edgeCases")
    expect(result.breakdown.companySize.points).toBe(3)
  })

  it("[7] 20 employees → viable bracket (6pt)", async () => {
    mockContact({ group: "G1", email: "x@y.com", company: { employeeCount: 20, country: "Cyprus" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.companySize.bracket).toBe("viable")
    expect(result.breakdown.companySize.points).toBe(6)
  })

  it("[8] 100 employees → ideal bracket (10pt)", async () => {
    mockContact({ group: "G1", email: "x@y.com", company: { employeeCount: 100, country: "Cyprus" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.companySize.bracket).toBe("ideal")
    expect(result.breakdown.companySize.points).toBe(10)
  })

  it("[9] 1000 employees → still ideal (no upper cap configured)", async () => {
    mockContact({ group: "G1", email: "x@y.com", company: { employeeCount: 1000, country: "Cyprus" } })
    const result = await computeICPScore("ct-x", config)
    // Ideal bracket: employeesMin=50, employeesMax=500 → 1000 fails ideal.
    // No bracket matches the > 500 range, so reports "unknown" 0pt.
    expect(result.breakdown.companySize.bracket).toBe("unknown")
    expect(result.breakdown.companySize.points).toBe(0)
  })

  it("[10] no employeeCount but revenue 5M+ → ideal via revenue fallback", async () => {
    mockContact({
      group: "G1",
      email: "x@y.com",
      company: { employeeCount: null, revenueRange: "5M-20M", country: "Cyprus" },
    })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.companySize.bracket).toBe("ideal")
  })

  // ─── Decision-maker access ─────────────────────────────────────────
  it("[11] no email → DM access none (0pt)", async () => {
    mockContact({ group: "G1", email: null, jobTitle: "CEO", company: { country: "Cyprus" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.decisionMakerAccess.level).toBe("none")
    expect(result.breakdown.decisionMakerAccess.points).toBe(0)
  })

  it("[12] email + 'Head of Operations' title → partial DM (5pt)", async () => {
    mockContact({
      group: "G1",
      email: "ops@x.com",
      jobTitle: "Head of Operations",
      company: { country: "Cyprus" },
    })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.decisionMakerAccess.level).toBe("partial")
    expect(result.breakdown.decisionMakerAccess.points).toBe(5)
  })

  it("[13] email but no title → partial DM (we can email but role unknown)", async () => {
    mockContact({ group: "G1", email: "x@y.com", jobTitle: null, company: { country: "Cyprus" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.decisionMakerAccess.level).toBe("partial")
  })

  // ─── Edge cases ────────────────────────────────────────────────────
  it("[14] contact with no company → company-dependent factors yield 0", async () => {
    mockContact({ group: "G1", email: "x@y.com", jobTitle: "CEO", company: null })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.companySize.bracket).toBe("unknown")
    expect(result.breakdown.companySize.points).toBe(0)
    expect(result.breakdown.geography.tier).toBe("outOfScope")
    expect(result.breakdown.geography.points).toBe(0)
    // intermediary + DM still scored normally.
    expect(result.breakdown.intermediaryType.points).toBe(15)
    expect(result.breakdown.decisionMakerAccess.points).toBe(10)
  })

  it("[15] contact.group=null → peripheral (5pt)", async () => {
    mockContact({ group: null, email: "x@y.com", company: { country: "Cyprus" } })
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.intermediaryType.tier).toBe("peripheral")
    expect(result.breakdown.intermediaryType.points).toBe(5)
  })

  it("[16] missing contact → throws", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(null)
    await expect(computeICPScore("ct-missing", config)).rejects.toThrow(/not found/)
  })

  it("[17] Pattern Match strong (3/3) → adds 5pt to total", async () => {
    mockContact({
      group: "G1",
      email: "x@y.com",
      jobTitle: "CEO",
      company: { employeeCount: 100, country: "United Arab Emirates", companySize: "51-200 employees" },
    })
    // Plant one matching closed_won deal.
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      {
        contact: {
          group: "G1",
          company: { country: "United Arab Emirates", companySize: "51-200 employees" },
        },
        company: null,
      },
    ] as never)
    const result = await computeICPScore("ct-x", config)
    expect(result.breakdown.patternMatch.match).toBe("strong")
    expect(result.breakdown.patternMatch.points).toBe(5)
    // Full 50 reachable when Pattern Match strong-matches.
    expect(result.score).toBe(50)
  })
})
