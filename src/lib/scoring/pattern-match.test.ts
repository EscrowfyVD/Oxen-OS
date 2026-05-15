/**
 * Tests for computePatternMatch (Sprint 3b B3).
 *
 * Two contexts:
 *   - V1 reality: 0 closed_won Deals → graceful noMatch
 *   - Synthetic deals: exercise strong/partial branches so the future
 *     behavior is locked in for the day real won deals start landing
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deal: {
      findMany: vi.fn(),
    },
  },
}))

import { computePatternMatch } from "./pattern-match"
import { prisma } from "@/lib/prisma"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()

// Reusable factory — keeps the test bodies focused on the dimension
// permutation each one targets.
function dealRow(opts: {
  contactGroup?: string | null
  contactCompanyCountry?: string | null
  contactCompanySize?: string | null
  // Bypass contact.company by setting these on the deal-level company
  // (covers the precedence fallback path).
  dealCompanyCountry?: string | null
  dealCompanySize?: string | null
}) {
  return {
    contact: opts.contactGroup === undefined && opts.contactCompanyCountry === undefined && opts.contactCompanySize === undefined
      ? null
      : {
          group: opts.contactGroup ?? null,
          company:
            opts.contactCompanyCountry === undefined && opts.contactCompanySize === undefined
              ? null
              : {
                  country: opts.contactCompanyCountry ?? null,
                  companySize: opts.contactCompanySize ?? null,
                },
        },
    company:
      opts.dealCompanyCountry === undefined && opts.dealCompanySize === undefined
        ? null
        : {
            country: opts.dealCompanyCountry ?? null,
            companySize: opts.dealCompanySize ?? null,
          },
  }
}

const PROSPECT = {
  group: "G1",
  companySize: "51-200 employees",
  jurisdiction: "United Arab Emirates",
}

describe("computePatternMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("[1] no closed_won deals → graceful noMatch (V1 default)", async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as never)
    const result = await computePatternMatch(PROSPECT, config)
    expect(result.match).toBe("none")
    expect(result.points).toBe(0)
    expect(result.matchedCount).toBe(0)
    expect(result.dimensions).toEqual({ type: false, size: false, jurisdiction: false })
  })

  it("[2] one strong match (3/3 dimensions) → strongMatch 5pts", async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      dealRow({
        contactGroup: "G1",
        contactCompanyCountry: "United Arab Emirates",
        contactCompanySize: "51-200 employees",
      }),
    ] as never)
    const result = await computePatternMatch(PROSPECT, config)
    expect(result.match).toBe("strong")
    expect(result.points).toBe(5)
    expect(result.matchedCount).toBe(1)
    expect(result.dimensions).toEqual({ type: true, size: true, jurisdiction: true })
  })

  it("[3] one partial match (2/3 dimensions) → partialMatch 3pts", async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      dealRow({
        contactGroup: "G1",
        contactCompanyCountry: "United Arab Emirates",
        contactCompanySize: "1000+ employees", // mismatch
      }),
    ] as never)
    const result = await computePatternMatch(PROSPECT, config)
    expect(result.match).toBe("partial")
    expect(result.points).toBe(3)
    expect(result.matchedCount).toBe(1)
    // Reports the actual dimensions matched, not a placeholder.
    expect(result.dimensions).toEqual({ type: true, size: false, jurisdiction: true })
  })

  it("[4] zero overlap deals → noMatch 0pts", async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      dealRow({
        contactGroup: "G5", // mismatch
        contactCompanyCountry: "Germany", // mismatch
        contactCompanySize: "11-50 employees", // mismatch
      }),
    ] as never)
    const result = await computePatternMatch(PROSPECT, config)
    expect(result.match).toBe("none")
    expect(result.points).toBe(0)
  })

  it("[5] mix of strong + partial → strong wins, count only strong tier", async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      dealRow({
        contactGroup: "G1",
        contactCompanyCountry: "United Arab Emirates",
        contactCompanySize: "51-200 employees",
      }),
      dealRow({
        contactGroup: "G1",
        contactCompanyCountry: "United Arab Emirates",
        contactCompanySize: "11-50 employees", // partial
      }),
      dealRow({
        contactGroup: "G1",
        contactCompanyCountry: "United Arab Emirates",
        contactCompanySize: "51-200 employees", // 2nd strong
      }),
    ] as never)
    const result = await computePatternMatch(PROSPECT, config)
    expect(result.match).toBe("strong")
    expect(result.matchedCount).toBe(2)
  })

  it("[6] multiple partial deals only → partialMatch, count aggregated", async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      dealRow({
        contactGroup: "G1",
        contactCompanyCountry: "United Arab Emirates",
        contactCompanySize: "1000+ employees",
      }),
      dealRow({
        contactGroup: "G1",
        contactCompanySize: "51-200 employees",
        contactCompanyCountry: "Cyprus", // mismatch
      }),
    ] as never)
    const result = await computePatternMatch(PROSPECT, config)
    expect(result.match).toBe("partial")
    expect(result.matchedCount).toBe(2)
  })

  it("[7] deal with no contact (company-only deal) falls back to deal.company", async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      dealRow({
        dealCompanyCountry: "United Arab Emirates",
        dealCompanySize: "51-200 employees",
        // No contact at all
      }),
    ] as never)
    const result = await computePatternMatch(PROSPECT, config)
    // type dimension fails (no group derivable), so 2/3 → partial.
    expect(result.match).toBe("partial")
    expect(result.dimensions).toEqual({ type: false, size: true, jurisdiction: true })
  })

  it("[8] deal contact with null group → graceful handling, no crash", async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      dealRow({
        contactGroup: null,
        contactCompanyCountry: "United Arab Emirates",
        contactCompanySize: "51-200 employees",
      }),
    ] as never)
    const result = await computePatternMatch(PROSPECT, config)
    // null group is a non-match (we don't compare null against "G1").
    expect(result.match).toBe("partial")
    expect(result.dimensions).toEqual({ type: false, size: true, jurisdiction: true })
  })
})
