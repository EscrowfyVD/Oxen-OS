/**
 * Unit tests for the SignalTypeRegistry seed script (Sprint S1 batch 1).
 *
 * Exercises seedSignalTypes() against a mocked PrismaClient — verifies:
 *   - All 7 expected codes are upserted (4 canonical + 3 placeholder)
 *   - Idempotency: running twice produces the same calls per run
 *   - The generated upsert args have the correct shape (where.code +
 *     create.* fields per spec + empty update)
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

describe("seedSignalTypes (Sprint S1 batch 1)", () => {
  it("upserts exactly 7 entries (4 canonical + 3 placeholder)", async () => {
    const client = makeMockedPrisma()
    const result = await seedSignalTypes(client)
    expect(result.upserted).toBe(7)
    expect(result.codes).toHaveLength(7)
  })

  it("includes all 4 canonical codes from Vernon's spec", async () => {
    const client = makeMockedPrisma()
    const result = await seedSignalTypes(client)
    expect(result.codes).toContain("clay_business_loss")
    expect(result.codes).toContain("clay_director_change")
    expect(result.codes).toContain("linkedin_post_funding")
    expect(result.codes).toContain("market_country_regulation_change")
  })

  it("includes all 3 webhook back-compat placeholder codes", async () => {
    const client = makeMockedPrisma()
    const result = await seedSignalTypes(client)
    expect(result.codes).toContain("clay_legacy_intent")
    expect(result.codes).toContain("trigify_intent_signal")
    expect(result.codes).toContain("n8n_external_signal")
  })

  it("upserts are keyed by `code` (idempotency anchor)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    expect(calls).toHaveLength(7)
    for (const call of calls) {
      const arg = call[0] as {
        where: { code: string }
        create: Record<string, unknown>
        update: Record<string, unknown>
      }
      expect(arg.where).toHaveProperty("code")
      expect(typeof arg.where.code).toBe("string")
      // Empty update preserves operator tweaks across re-runs
      expect(arg.update).toEqual({})
    }
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

  it("idempotent: running twice produces 14 total upsert calls (7 per run)", async () => {
    const client = makeMockedPrisma()
    await seedSignalTypes(client)
    await seedSignalTypes(client)
    const calls = vi.mocked(client.signalTypeRegistry.upsert).mock.calls
    expect(calls).toHaveLength(14)
    // Each run hits each code exactly once — no duplicates within a run
    const firstRunCodes = calls
      .slice(0, 7)
      .map((c) => (c[0] as { where: { code: string } }).where.code)
    const secondRunCodes = calls
      .slice(7, 14)
      .map((c) => (c[0] as { where: { code: string } }).where.code)
    expect(firstRunCodes).toEqual(secondRunCodes)
  })
})
