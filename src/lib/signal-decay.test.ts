// Unit tests for calculateDecayedPoints (Sprint S1 batch 3).
//
// Pure function — no mocks, no Prisma. We pin `now` via the optional
// 5th param so tests are deterministic across timezones and CI clocks.

import { describe, it, expect } from "vitest"
import { calculateDecayedPoints } from "./signal-decay"

const DAY = 1000 * 60 * 60 * 24

// Anchor every test on a stable occurredAt. now() is computed by
// adding `elapsedDays` to this anchor.
const ANCHOR = new Date("2026-01-01T00:00:00Z")
function nowAt(elapsedDays: number): Date {
  return new Date(ANCHOR.getTime() + elapsedDays * DAY)
}

describe("calculateDecayedPoints — LINEAR curve", () => {
  it("returns full points at t=0 (signal just occurred)", () => {
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "LINEAR", nowAt(0)),
    ).toBe(100)
  })

  it("returns ~50% at t = decayDays/2 (midpoint)", () => {
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "LINEAR", nowAt(45)),
    ).toBe(50)
  })

  it("returns 0 at exactly t = decayDays (cliff)", () => {
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "LINEAR", nowAt(90)),
    ).toBe(0)
  })

  it("returns 0 well past decayDays", () => {
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "LINEAR", nowAt(1000)),
    ).toBe(0)
  })

  it("returns full points when occurredAt is in the future (clock drift)", () => {
    // now() is BEFORE occurredAt → elapsedDays < 0
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "LINEAR", nowAt(-5)),
    ).toBe(100)
  })
})

describe("calculateDecayedPoints — EXPONENTIAL curve", () => {
  it("returns full points at t=0", () => {
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "EXPONENTIAL", nowAt(0)),
    ).toBe(100)
  })

  it("returns ~50% at t = decayDays/2 (half-life anchor)", () => {
    // exp(-LN2) = 0.5 exactly → 100 * 0.5 = 50
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "EXPONENTIAL", nowAt(45)),
    ).toBe(50)
  })

  it("returns ~25% just before t = decayDays (math, before clamp)", () => {
    // ratio ≈ 0.999 → exp(-0.999 * LN2 * 2) ≈ 0.2503 → ~25
    const v = calculateDecayedPoints(
      100,
      ANCHOR,
      90,
      "EXPONENTIAL",
      nowAt(89.99),
    )
    expect(v).toBeGreaterThanOrEqual(24)
    expect(v).toBeLessThanOrEqual(26)
  })

  it("clamps to 0 at exactly t = decayDays (>= cliff)", () => {
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "EXPONENTIAL", nowAt(90)),
    ).toBe(0)
  })

  it("clamps to 0 at t = 2 * decayDays", () => {
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "EXPONENTIAL", nowAt(180)),
    ).toBe(0)
  })
})

describe("calculateDecayedPoints — STEP curve", () => {
  it("returns 100% when ratio < 0.33 (early window)", () => {
    // 0.20 * 90 = 18 days elapsed → still in first tier
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "STEP", nowAt(18)),
    ).toBe(100)
  })

  it("returns 50% when ratio is between 0.33 and 0.66 (mid window)", () => {
    // 0.50 * 90 = 45 days elapsed → second tier
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "STEP", nowAt(45)),
    ).toBe(50)
  })

  it("returns 0 when ratio >= 0.66 (late window)", () => {
    // 0.80 * 90 = 72 days elapsed → third tier (= 0)
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "STEP", nowAt(72)),
    ).toBe(0)
  })

  it("returns 50% at exactly ratio = 0.33 (boundary, second tier)", () => {
    // 0.33 * 90 = 29.7 days elapsed → ratio = 0.33 → second tier
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "STEP", nowAt(29.7)),
    ).toBe(50)
  })

  it("returns 0 at exactly ratio = 0.66 (boundary, third tier)", () => {
    // 0.66 * 90 = 59.4 days elapsed → ratio = 0.66 → third tier (= 0)
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "STEP", nowAt(59.4)),
    ).toBe(0)
  })
})

describe("calculateDecayedPoints — edge cases", () => {
  it("returns 0 when originalPoints is 0 (regardless of curve)", () => {
    expect(
      calculateDecayedPoints(0, ANCHOR, 90, "LINEAR", nowAt(45)),
    ).toBe(0)
    expect(
      calculateDecayedPoints(0, ANCHOR, 90, "EXPONENTIAL", nowAt(45)),
    ).toBe(0)
    expect(
      calculateDecayedPoints(0, ANCHOR, 90, "STEP", nowAt(45)),
    ).toBe(0)
  })

  it("returns originalPoints when decayDays <= 0 (permanent signal)", () => {
    // Vernon decision: decayDays<=0 → never decays
    expect(
      calculateDecayedPoints(50, ANCHOR, 0, "LINEAR", nowAt(1000)),
    ).toBe(50)
    expect(
      calculateDecayedPoints(50, ANCHOR, -10, "LINEAR", nowAt(1000)),
    ).toBe(50)
    // Even with EXPONENTIAL / STEP curves
    expect(
      calculateDecayedPoints(50, ANCHOR, 0, "EXPONENTIAL", nowAt(1000)),
    ).toBe(50)
    expect(
      calculateDecayedPoints(50, ANCHOR, 0, "STEP", nowAt(1000)),
    ).toBe(50)
  })

  it("never returns negative points (Math.max(0, …) clamp)", () => {
    // Synthetic case: massive elapsedDays, originalPoints=10
    expect(
      calculateDecayedPoints(10, ANCHOR, 90, "LINEAR", nowAt(10000)),
    ).toBe(0)
    expect(
      calculateDecayedPoints(10, ANCHOR, 90, "EXPONENTIAL", nowAt(10000)),
    ).toBe(0)
  })

  it("rounds the result to an integer (no fractional points)", () => {
    // LINEAR at ratio=0.333 → 100 * 0.667 = 66.7 → rounded to 67
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "LINEAR", nowAt(30)),
    ).toBe(67)
    // EXPONENTIAL at ratio=0.5 → 50.0 (exact)
    expect(
      calculateDecayedPoints(100, ANCHOR, 90, "EXPONENTIAL", nowAt(45)),
    ).toBe(50)
  })

  it("works correctly with non-90-day decay windows", () => {
    // 30-day window LINEAR: ratio=0.5 → 50%
    expect(
      calculateDecayedPoints(100, ANCHOR, 30, "LINEAR", nowAt(15)),
    ).toBe(50)
    // 180-day window LINEAR: ratio=0.5 → 50%
    expect(
      calculateDecayedPoints(100, ANCHOR, 180, "LINEAR", nowAt(90)),
    ).toBe(50)
  })

  it("preserves originalPoints precision through the curve (small inputs)", () => {
    // 10 points / LINEAR / midpoint → 5
    expect(
      calculateDecayedPoints(10, ANCHOR, 90, "LINEAR", nowAt(45)),
    ).toBe(5)
    // 1 point / LINEAR / midpoint → round(0.5) = 1 (Banker's? Math.round = 1)
    // JS Math.round(0.5) = 1 (rounds half-up)
    expect(
      calculateDecayedPoints(1, ANCHOR, 90, "LINEAR", nowAt(45)),
    ).toBe(1)
    // 1 point / LINEAR / 60% elapsed → round(1 * 0.4) = round(0.4) = 0
    expect(
      calculateDecayedPoints(1, ANCHOR, 90, "LINEAR", nowAt(54)),
    ).toBe(0)
  })
})
