import { describe, it, expect } from "vitest"
import { EnrichmentSource, Prisma } from "@prisma/client"

/**
 * Sentinel — Apollo PR-W. The EnrichmentSource enum must include `apollo` (new
 * direct-Apollo enrichment) AND keep `clay` (historical rows reference it — we
 * ADD, never remove). An enum value is a prod schema concern (Postgres type +
 * downstream consumers), so changing it must go through a migration, not slip in
 * silently. Same spirit as the CrmGroup sentinel.
 *
 * Also locks `enrichmentRaw` (the raw Apollo response stash) onto both Company
 * and CrmContact, so the raw-preservation field can't be dropped silently.
 */
describe("EnrichmentSource enum + enrichmentRaw (Apollo PR-W)", () => {
  it("is exactly [apollo, clay, csv_import, inbound_form, manual, trigify]", () => {
    expect([...Object.values(EnrichmentSource)].sort()).toEqual([
      "apollo",
      "clay",
      "csv_import",
      "inbound_form",
      "manual",
      "trigify",
    ])
  })

  it("enrichmentRaw exists on Company and CrmContact (raw Apollo stash)", () => {
    expect(Object.values(Prisma.CompanyScalarFieldEnum)).toContain("enrichmentRaw")
    expect(Object.values(Prisma.CrmContactScalarFieldEnum)).toContain("enrichmentRaw")
  })
})
