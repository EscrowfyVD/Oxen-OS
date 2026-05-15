/**
 * Tests for applyTimeDecay (Sprint 3b B1).
 *
 * The active v1 config from `buildScoringConfigV1()` ships these
 * brackets: 7d/1.0, 30d/0.75, 90d/0.5, null/0. All assertions below
 * read against this canonical config so the test stays in lockstep
 * with the seeded production behavior.
 */

import { describe, it, expect } from "vitest"
import { applyTimeDecay } from "./apply-time-decay"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()
const NOW = new Date("2026-05-15T12:00:00Z")

function ageDays(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

describe("applyTimeDecay", () => {
  it("[1] same-day signal → full points (1.0x)", () => {
    const out = applyTimeDecay({ points: 12, createdAt: NOW }, config, NOW)
    expect(out).toBe(12)
  })

  it("[2] 5-day-old signal → still 1.0x", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(5) }, config, NOW)
    expect(out).toBe(12)
  })

  it("[3] exactly 7-day boundary → 1.0x (inclusive ≤)", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(7) }, config, NOW)
    expect(out).toBe(12)
  })

  it("[4] 8-day-old signal → 0.75x", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(8) }, config, NOW)
    expect(out).toBe(9) // 12 * 0.75
  })

  it("[5] 15-day-old signal → 0.75x", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(15) }, config, NOW)
    expect(out).toBe(9)
  })

  it("[6] exactly 30-day boundary → 0.75x (inclusive)", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(30) }, config, NOW)
    expect(out).toBe(9)
  })

  it("[7] 31-day-old signal → 0.5x", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(31) }, config, NOW)
    expect(out).toBe(6)
  })

  it("[8] 60-day-old signal → 0.5x", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(60) }, config, NOW)
    expect(out).toBe(6)
  })

  it("[9] exactly 90-day boundary → 0.5x (inclusive)", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(90) }, config, NOW)
    expect(out).toBe(6)
  })

  it("[10] 91-day-old signal → expired (0)", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(91) }, config, NOW)
    expect(out).toBe(0)
  })

  it("[11] very old signal (1000d) → expired (0)", () => {
    const out = applyTimeDecay({ points: 12, createdAt: ageDays(1000) }, config, NOW)
    expect(out).toBe(0)
  })

  it("[12] 0-point signal stays 0 regardless of age", () => {
    const out = applyTimeDecay({ points: 0, createdAt: ageDays(5) }, config, NOW)
    expect(out).toBe(0)
  })

  it("[13] future-dated signal (negative age) treated as fresh (1.0x)", () => {
    // Webhook clock-skew defense: a signal stamped "tomorrow" gets the
    // safest default (full weight), not NaN.
    const future = new Date(NOW.getTime() + 60 * 60 * 1000) // +1h
    const out = applyTimeDecay({ points: 12, createdAt: future }, config, NOW)
    expect(out).toBe(12)
  })
})
