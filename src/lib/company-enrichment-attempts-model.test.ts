import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

/**
 * Sentinel — Apify PR3c-b-enrich slice 1. Locks the enrichment
 * attempt-tracking columns (deploy-ahead: they ship BEFORE their writer, the
 * pass-3 sweep). `enrichmentAttemptedAt`/`enrichmentAttempts` mean TRIED
 * (give-up after 3); `enrichedAt` stays SUCCESS-only — the monthly cap counts
 * successes, never attempts. The sweep's PARTIAL index lives in the migration
 * SQL only (Prisma PSL can't express WHERE) — if these columns vanish, so did
 * the index's reason to exist. Same pattern as #26/#31.
 */
describe("Company enrichment attempt-tracking columns (PR3c-b-enrich slice 1)", () => {
  it("enrichmentAttemptedAt + enrichmentAttempts are Company scalar fields", () => {
    const fields = Object.values(Prisma.CompanyScalarFieldEnum)
    expect(fields).toContain("enrichmentAttemptedAt")
    expect(fields).toContain("enrichmentAttempts")
  })

  it("attemptedAt is NULLABLE+OPTIONAL; attempts is OPTIONAL on create (DB default 0)", () => {
    // Type-level locks — these compile only while the contract holds:
    const withoutEither: Prisma.CompanyUncheckedCreateInput = { name: "co" }
    const withNullTimestamp: Prisma.CompanyUncheckedCreateInput = {
      name: "co",
      enrichmentAttemptedAt: null,
    }
    const withValues: Prisma.CompanyUncheckedCreateInput = {
      name: "co",
      enrichmentAttemptedAt: new Date("2026-07-09T00:00:00Z"),
      enrichmentAttempts: 3,
    }
    expect(withoutEither.enrichmentAttempts).toBeUndefined() // default(0) → omittable
    expect(withNullTimestamp.enrichmentAttemptedAt).toBeNull()
    expect(withValues.enrichmentAttempts).toBe(3)
  })
})
