/**
 * Unit tests for the SignalTypeRegistry seed script
 * (Sprint S1 batch 1 + Sprint Trigify Phase 2A).
 *
 * Exercises seedSignalTypes() against a mocked PrismaClient — verifies:
 *   - All 16 expected codes are upserted
 *     (4 canonical + 7 Trigify + 2 Apify + 2 placeholder + 1 deprecated)
 *   - Idempotency: running twice produces the same calls per run
 *   - The generated upsert args have the correct shape:
 *     * Active entries: create with isActive:true + empty update
 *     * Deprecated entries: create with isActive:false + update forces
 *       isActive:false on every run
 *
 * No real DB connection is involved.
 */

import { describe, it, expect, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { seedSignalTypes } from "./seed-signal-types"

// Minimal shape of the Prisma client surface we exercise. Cast as
// PrismaClient via `unknown` so the seedSignalTypes signature accepts
// the partial mock — typing as PrismaClient (rather than the wider
// Parameters<typeof seedSignalTypes>[0] which includes undefined due
// to the default arg) keeps the test body free of optional-chaining.
function makeMockedPrisma(): PrismaClient {
  const upsert = vi.fn().mockResolvedValue({ id: "fake-id" } as never)
  return {
    signalTypeRegistry: { upsert },
  } as unknown as PrismaClient
}

describe("seedSignalTypes (Sprint S1 + Trigify Phase 2A)", () => {
  it("upserts exactly 16 entries (4 canonical + 7 Trigify + 2 Apify + 2 placeholder + 1 deprecated)", async () => {
    const client = makeMockedPrisma()
    const result = await seedSignalTypes(client)
    expect(result.upserted).toBe(16)
    expect(result.codes).toHaveLength(16)
  })

  it("includes all 4 canonical codes from Vernon's Sprint S1 spec", async () => {
    const client = makeMockedPrisma()
    const result = await seedSignalTypes(client)
    expect(result.codes).toContain("clay_business_loss")
    expect(result.codes).toContain("clay_director_change")
    expect(result.codes).toContain("linkedin_post_funding")
    expect(result.codes).toContain("market_country_regulation_change")
  })

  it("includes all 7 Trigify Phase 2A codes", async () => {
    const client = makeMockedPrisma()
    const result = await seedSignalTypes(client)
    expect(result.codes).toContain("trigify_oxen_engagement_comment")
    expect(result.codes).toContain("trigify_oxen_engagement_like")
    expect(result.codes).toContain("trigify_profile_visit")
    expect(result.codes).toContain("trigify_competitor_engagement")
    expect(result.codes).toContain("trigify_follow_competitor")
    expect(result.codes).toContain("trigify_role_change")
    expect(result.codes).toContain("trigify_bio_change")
  })

  it("includes the 2 remaining webhook back-compat placeholder codes", async () => {
    const client = makeMockedPrisma()
    const result = await seedSignalTypes(client)
    expect(result.codes).toContain("clay_legacy_intent")
    expect(result.codes).toContain("n8n_external_signal")
  })

  it("includes the deprecated trigify_intent_signal entry", async () => {
    const client = makeMockedPrisma()
    const result = await seedSignalTypes(client)
    expect(result.codes).toContain("trigify_intent_signal")
  })

  it("upserts are keyed by `code` (idempotency anchor)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    expect(calls).toHaveLength(16)
    for (const call of calls) {
      const arg = call[0] as {
        where: { code: string }
        create: Record<string, unknown>
      }
      expect(arg.where).toHaveProperty("code")
      expect(typeof arg.where.code).toBe("string")
    }
  })

  it("active entries use empty update (preserve operator tweaks)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const activeCalls = calls.filter((c) => {
      const arg = c[0] as { where: { code: string } }
      return arg.where.code !== "trigify_intent_signal"
    })
    expect(activeCalls).toHaveLength(15)
    for (const call of activeCalls) {
      const arg = call[0] as { update: Record<string, unknown> }
      expect(arg.update).toEqual({})
    }
  })

  it("trigify_intent_signal is created and updated with isActive=false (deprecated)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const deprecated = calls.find(
      (c) =>
        (c[0] as { where: { code: string } }).where.code ===
        "trigify_intent_signal",
    )
    expect(deprecated).toBeDefined()
    const arg = deprecated![0] as {
      create: { isActive: boolean }
      update: { isActive?: boolean }
    }
    expect(arg.create.isActive).toBe(false)
    expect(arg.update.isActive).toBe(false)
  })

  it("clay_business_loss carries the canonical scoring contract", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const found = calls.find(
      (c) =>
        (c[0] as { where: { code: string } }).where.code ===
        "clay_business_loss",
    )
    expect(found).toBeDefined()
    const arg = found![0] as {
      create: {
        defaultPoints: number
        decayDays: number
        decayCurve: string
        category: string
      }
    }
    expect(arg.create.defaultPoints).toBe(10)
    expect(arg.create.decayDays).toBe(90)
    expect(arg.create.decayCurve).toBe("LINEAR")
    expect(arg.create.category).toBe("INTENT")
  })

  it("market_country_regulation_change is the only MARKET category seed", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const marketCalls = calls.filter((c) => {
      const arg = c[0] as { create: { category: string } }
      return arg.create.category === "MARKET"
    })
    expect(marketCalls).toHaveLength(1)
    expect(
      (marketCalls[0][0] as { where: { code: string } }).where.code,
    ).toBe("market_country_regulation_change")
  })

  it("linkedin_post_funding uses EXPONENTIAL decay (Vernon spec)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const found = calls.find(
      (c) =>
        (c[0] as { where: { code: string } }).where.code ===
        "linkedin_post_funding",
    )
    const arg = found![0] as { create: { decayCurve: string } }
    expect(arg.create.decayCurve).toBe("EXPONENTIAL")
  })

  it("market_country_regulation_change uses STEP decay (Vernon spec)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const found = calls.find(
      (c) =>
        (c[0] as { where: { code: string } }).where.code ===
        "market_country_regulation_change",
    )
    const arg = found![0] as { create: { decayCurve: string } }
    expect(arg.create.decayCurve).toBe("STEP")
  })

  it("trigify_profile_visit carries the Phase 2A scoring contract (10pt, 7d, STEP, INTENT)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const found = calls.find(
      (c) =>
        (c[0] as { where: { code: string } }).where.code ===
        "trigify_profile_visit",
    )
    expect(found).toBeDefined()
    const arg = found![0] as {
      create: {
        defaultPoints: number
        decayDays: number
        decayCurve: string
        category: string
      }
    }
    expect(arg.create.defaultPoints).toBe(10)
    expect(arg.create.decayDays).toBe(7)
    expect(arg.create.decayCurve).toBe("STEP")
    expect(arg.create.category).toBe("INTENT")
  })

  it("trigify_oxen_engagement_comment uses EXPONENTIAL decay over 30 days at 10pt", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const found = calls.find(
      (c) =>
        (c[0] as { where: { code: string } }).where.code ===
        "trigify_oxen_engagement_comment",
    )
    expect(found).toBeDefined()
    const arg = found![0] as {
      create: {
        defaultPoints: number
        decayDays: number
        decayCurve: string
      }
    }
    expect(arg.create.defaultPoints).toBe(10)
    expect(arg.create.decayDays).toBe(30)
    expect(arg.create.decayCurve).toBe("EXPONENTIAL")
  })

  it("all 7 Trigify seeds carry the INTENT category", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const trigifyActive = calls.filter((c) => {
      const code = (c[0] as { where: { code: string } }).where.code
      return code.startsWith("trigify_") && code !== "trigify_intent_signal"
    })
    expect(trigifyActive).toHaveLength(7)
    for (const call of trigifyActive) {
      const arg = call[0] as { create: { category: string } }
      expect(arg.create.category).toBe("INTENT")
    }
  })

  it("includes the 2 Apify structured-actor codes, all INTENT category", async () => {
    const client = makeMockedPrisma()
    const result = await seedSignalTypes(client)
    expect(result.codes).toContain("apify_f")
    expect(result.codes).toContain("apify_g")
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const apifyCalls = calls.filter((c) =>
      (c[0] as { where: { code: string } }).where.code.startsWith("apify_"),
    )
    expect(apifyCalls).toHaveLength(2)
    for (const call of apifyCalls) {
      const arg = call[0] as { create: { category: string } }
      expect(arg.create.category).toBe("INTENT")
    }
  })

  it("apify_f mirrors the Cat-F funding contract (8pt, 30d, EXPONENTIAL)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const found = calls.find(
      (c) => (c[0] as { where: { code: string } }).where.code === "apify_f",
    )
    expect(found).toBeDefined()
    const arg = found![0] as {
      create: {
        defaultPoints: number
        decayDays: number
        decayCurve: string
        category: string
      }
    }
    expect(arg.create.defaultPoints).toBe(8)
    expect(arg.create.decayDays).toBe(30)
    expect(arg.create.decayCurve).toBe("EXPONENTIAL")
    expect(arg.create.category).toBe("INTENT")
  })

  it("apify_g carries the provisional Cat-G hiring contract (6pt, 60d, LINEAR)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    const found = calls.find(
      (c) => (c[0] as { where: { code: string } }).where.code === "apify_g",
    )
    expect(found).toBeDefined()
    const arg = found![0] as {
      create: {
        defaultPoints: number
        decayDays: number
        decayCurve: string
        category: string
      }
    }
    expect(arg.create.defaultPoints).toBe(6)
    expect(arg.create.decayDays).toBe(60)
    expect(arg.create.decayCurve).toBe("LINEAR")
    expect(arg.create.category).toBe("INTENT")
  })

  it("idempotent: running twice produces 32 total upsert calls (16 per run)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    expect(calls).toHaveLength(32)
    // Each run hits each code exactly once — no duplicates within a run
    const firstRunCodes = calls
      .slice(0, 16)
      .map((c) => (c[0] as { where: { code: string } }).where.code)
    const secondRunCodes = calls
      .slice(16, 32)
      .map((c) => (c[0] as { where: { code: string } }).where.code)
    expect(firstRunCodes).toEqual(secondRunCodes)
  })
})
