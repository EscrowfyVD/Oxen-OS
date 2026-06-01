/**
 * Tests for parseCompanySizeLabel (Sprint Finding 2).
 *
 * Pure label → employee-count parser. No ScoringConfig involved here —
 * the bracket assignment is exercised in compute-icp-score.test.ts. This
 * file pins the parsing grammar against every label format observed in
 * the prod recon (Phase 1) plus the robustness fallbacks.
 */

import { describe, it, expect } from "vitest"
import { parseCompanySizeLabel } from "./parse-company-size"

describe("parseCompanySizeLabel", () => {
  // ─── Range buckets → floored midpoint ──────────────────────────────
  it("[1] '2-10 employees' → 6 (midpoint)", () => {
    expect(parseCompanySizeLabel("2-10 employees")).toBe(6)
  })

  it("[2] '11-50 employees' → 30 (floored midpoint, not 31)", () => {
    expect(parseCompanySizeLabel("11-50 employees")).toBe(30)
  })

  it("[3] '51-200 employees' → 125 (floored midpoint)", () => {
    expect(parseCompanySizeLabel("51-200 employees")).toBe(125)
  })

  it("[4] '201-500 employees' → 350 (floored midpoint)", () => {
    expect(parseCompanySizeLabel("201-500 employees")).toBe(350)
  })

  // ─── Commas as thousands separators ────────────────────────────────
  it("[5] '501-1,000 employees' → 750 (comma stripped)", () => {
    expect(parseCompanySizeLabel("501-1,000 employees")).toBe(750)
  })

  it("[6] '1,001-5,000 employees' → 3000 (comma stripped)", () => {
    expect(parseCompanySizeLabel("1,001-5,000 employees")).toBe(3000)
  })

  // ─── Open-ended bucket → low bound ─────────────────────────────────
  it("[7] '10,001+ employees' → 10001 (open bucket low bound)", () => {
    expect(parseCompanySizeLabel("10,001+ employees")).toBe(10001)
  })

  it("[8] '10001+' (no suffix) → 10001", () => {
    expect(parseCompanySizeLabel("10001+")).toBe(10001)
  })

  // ─── Range without the ' employees' suffix ─────────────────────────
  it("[9] '11-50' (bare range) → 30", () => {
    expect(parseCompanySizeLabel("11-50")).toBe(30)
  })

  // ─── Non-numeric / empty / unparsable → null (caller maps to edge) ─
  it("[10] 'Self-employed' → null", () => {
    expect(parseCompanySizeLabel("Self-employed")).toBeNull()
  })

  it("[11] null → null", () => {
    expect(parseCompanySizeLabel(null)).toBeNull()
  })

  it("[12] undefined → null", () => {
    expect(parseCompanySizeLabel(undefined)).toBeNull()
  })

  it("[13] empty string → null", () => {
    expect(parseCompanySizeLabel("")).toBeNull()
  })

  it("[14] whitespace-only → null", () => {
    expect(parseCompanySizeLabel("   ")).toBeNull()
  })

  it("[15] free text with no bucket shape → null", () => {
    expect(parseCompanySizeLabel("fast-growing fintech")).toBeNull()
  })
})
