import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"

/**
 * Sentinel — Apify PR3a. ProcessedSignal is the dedup / audit ledger for scraped
 * items; `sourceUrl` is the `@unique` dedup key. Adding/removing a scalar field
 * breaks this on purpose: any change must come with a migration + a matching
 * pipeline mapping. Same spirit as the Meeting / EnrichmentSource sentinels.
 */
describe("ProcessedSignal model (Apify PR3a)", () => {
  it("scalar fields are exactly the frozen dedup-ledger set", () => {
    expect(Object.values(Prisma.ProcessedSignalScalarFieldEnum).sort()).toEqual([
      "accountId",
      "id",
      "processedAt",
      "rawPayload",
      "signalCategory",
      "sourceActor",
      "sourceUrl",
    ])
  })
})
