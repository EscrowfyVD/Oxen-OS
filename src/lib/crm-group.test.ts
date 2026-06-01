import { describe, it, expect } from "vitest"
import { CrmGroup } from "@prisma/client"

/**
 * Sentinel — closeout #4 retired the unused CrmGroup enum values G7A and G7B.
 *
 * The enum must be EXACTLY [G1..G6]. Re-adding G7A/G7B (or any value) breaks
 * this on purpose: an enum value is a prod schema concern (Postgres type +
 * downstream Zod enums, UI selects, badge colors). Adding one should go
 * through a migration + a downstream-sites review, not slip in silently.
 *
 * Same spirit as the configVersion sentinel in seed-scoring-config.test.ts.
 */
describe("CrmGroup enum (closeout #4)", () => {
  it("is exactly [G1, G2, G3, G4, G5, G6] — no G7A/G7B", () => {
    expect([...Object.values(CrmGroup)].sort()).toEqual([
      "G1",
      "G2",
      "G3",
      "G4",
      "G5",
      "G6",
    ])
  })
})
