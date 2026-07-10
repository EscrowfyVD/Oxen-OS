import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

/**
 * Sentinel — Apify PR3c-b Company.acquisitionSource (capture-source marker for
 * the pipeline-UI filter). Mirrors the existing CrmContact/Deal.acquisitionSource
 * (plain nullable String → TEXT). Written by the PR3c-a capture ('apify-jobboard'
 * / 'apify-crunchbase'); existing non-pipeline companies stay NULL. No DB index
 * (a source filter over a ~1.6k-row table needs none). Same pattern as #26/#31/#35.
 */
describe("Company.acquisitionSource capture-source marker (Apify PR3c-b)", () => {
  it("acquisitionSource is a Company scalar field", () => {
    const fields = Object.values(Prisma.CompanyScalarFieldEnum)
    expect(fields).toContain("acquisitionSource")
  })

  it("is NULLABLE + OPTIONAL on create (pre-pipeline companies have no source)", () => {
    // Type-level locks — compile only while the contract holds.
    const without: Prisma.CompanyUncheckedCreateInput = { name: "co" }
    const withNull: Prisma.CompanyUncheckedCreateInput = { name: "co", acquisitionSource: null }
    const withValue: Prisma.CompanyUncheckedCreateInput = { name: "co", acquisitionSource: "apify-crunchbase" }
    expect(without.acquisitionSource).toBeUndefined() // omittable → existing rows stay NULL
    expect(withNull.acquisitionSource).toBeNull()
    expect(withValue.acquisitionSource).toBe("apify-crunchbase")
  })
})
