/**
 * Tests for inferPainTier — OVERRIDE-ONLY V1 (Sprint 3c B2).
 *
 * Locks in the V1 contract : ONLY the manual override produces a
 * tier. The inference algorithm (read Cat C/D/E signals + company
 * context) is deferred V2 pending Andy validation. If a future
 * commit re-introduces inference here without the Andy-ratified
 * rules, tests [4] + [5] catch it (the "no override → null" guard).
 */

import { describe, it, expect } from "vitest"
import { inferPainTier } from "./infer-pain-tier"

function input(painTierOverride: string | null, excludedFrom: string[] = []) {
  return { painTierOverride, excludedFrom }
}

describe("inferPainTier — V1 override-only", () => {
  it("[1] painTierOverride='T1' → T1", () => {
    expect(inferPainTier(input("T1"))).toBe("T1")
  })

  it("[2] painTierOverride='T2' → T2", () => {
    expect(inferPainTier(input("T2"))).toBe("T2")
  })

  it("[3] painTierOverride='T3' → T3", () => {
    expect(inferPainTier(input("T3"))).toBe("T3")
  })

  it("[4] painTierOverride=null → null (no inference V1)", () => {
    // Critical V1 invariant : the absence of an override returns
    // null, NOT a "synthetic" tier from signal heuristics. If a
    // future commit re-introduces inference without Andy's rules,
    // this test fails loudly.
    expect(inferPainTier(input(null))).toBe(null)
  })

  it("[5] no override + excludedFrom=['scoring'] → null", () => {
    // Aligns with assignPriorityLevel → "Excluded" : excluded
    // accounts don't carry a tier.
    expect(inferPainTier(input(null, ["scoring"]))).toBe(null)
  })

  it("[6] override='T1' + excludedFrom=['scoring'] → null (exclusion wins)", () => {
    // Even an explicit BD override is suppressed when the account
    // is opted out of scoring — keeps the tier surface coherent
    // with the priorityLevel="Excluded" state.
    expect(inferPainTier(input("T1", ["scoring"]))).toBe(null)
  })

  it("[7] override='T4' (unknown value) → null (defensive fallback)", () => {
    // A future CrmPainTier enum addition shouldn't crash the page.
    // We just don't surface a tier until the rendering layer learns
    // about it — same defensive pattern as labels.ts fallbacks.
    expect(inferPainTier(input("T4"))).toBe(null)
  })

  it("[8] override='' (empty string) → null", () => {
    expect(inferPainTier(input(""))).toBe(null)
  })
})
