import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

/**
 * Sentinel — Apify PR3c-b-migration. Locks the two company-level intent-score
 * columns (deploy-ahead: the columns ship BEFORE their writer, the
 * PR3c-b-score recompute). `intentScore` aggregates ACCOUNT-LEVEL signals only
 * ({companyId, contactId: null} — the level-partition invariant); NULL means
 * "never scored" (distinct from 0.0), mirroring CrmContact unscored. Same
 * spirit as the ProcessedSignal / Meeting / EnrichmentSource sentinels: if a
 * schema change removes or renames these, this breaks on purpose.
 */
describe("Company intent-score columns (Apify PR3c-b-migration)", () => {
  it("intentScore + lastScoredAt are Company scalar fields", () => {
    const fields = Object.values(Prisma.CompanyScalarFieldEnum)
    expect(fields).toContain("intentScore")
    expect(fields).toContain("lastScoredAt")
  })

  it("both fields are NULLABLE + OPTIONAL on create (never-scored default)", () => {
    // Type-level lock — compiles only while the fields stay optional AND
    // nullable on CompanyUncheckedCreateInput:
    const withoutScore: Prisma.CompanyUncheckedCreateInput = { name: "co" }
    const withNulls: Prisma.CompanyUncheckedCreateInput = {
      name: "co",
      intentScore: null,
      lastScoredAt: null,
    }
    const withValues: Prisma.CompanyUncheckedCreateInput = {
      name: "co",
      intentScore: 12.5,
      lastScoredAt: new Date("2026-07-09T00:00:00Z"),
    }
    expect(withoutScore.intentScore).toBeUndefined()
    expect(withNulls.intentScore).toBeNull()
    expect(withValues.intentScore).toBe(12.5)
  })
})
