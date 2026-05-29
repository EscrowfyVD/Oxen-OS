/**
 * Tests for assignPriorityLevel (Sprint 3c B1).
 *
 * The active v1 config from `buildScoringConfigV1()` ships these
 * thresholds: P1 (75/3/2h), P2 (55/2/24h), P3 (40/2/null),
 * Monitor (0/0/null). Each boundary asserted explicitly so a
 * future config tweak that bumps a min by 1 fails loudly here.
 */

import { describe, it, expect } from "vitest"
import { assignPriorityLevel } from "./assign-priority-level"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()

function input(score: number, signalCount: number, excludedFrom: string[] = []) {
  return { score, signalCount, excludedFrom }
}

describe("assignPriorityLevel", () => {
  // ─── Score boundary ────────────────────────────────────────────────
  it("[1] score 39 + signals 5 → Monitor (below P3 minScore=40)", () => {
    expect(assignPriorityLevel(input(39, 5), config)).toBe("Monitor")
  })

  it("[2] score 40 + signals 2 → P3 (exact lower bound)", () => {
    expect(assignPriorityLevel(input(40, 2), config)).toBe("P3")
  })

  it("[3] score 54 + signals 2 → P3 (just below P2 minScore=55)", () => {
    expect(assignPriorityLevel(input(54, 2), config)).toBe("P3")
  })

  it("[4] score 55 + signals 2 → P2 (exact lower bound)", () => {
    expect(assignPriorityLevel(input(55, 2), config)).toBe("P2")
  })

  it("[5] score 74 + signals 2 → P2 (just below P1 minScore=75)", () => {
    expect(assignPriorityLevel(input(74, 2), config)).toBe("P2")
  })

  it("[6] score 75 + signals 3 → P1 (both bounds met)", () => {
    expect(assignPriorityLevel(input(75, 3), config)).toBe("P1")
  })

  // ─── Signal count gate at every tier ───────────────────────────────
  it("[7] score 75 + signals 2 → P2 (P1 needs 3 signals — signal gate wins)", () => {
    expect(assignPriorityLevel(input(75, 2), config)).toBe("P2")
  })

  it("[8] score 55 + signals 1 → Monitor (P2 needs 2 signals)", () => {
    expect(assignPriorityLevel(input(55, 1), config)).toBe("Monitor")
  })

  it("[9] score 40 + signals 1 → Monitor (P3 needs 2 signals)", () => {
    expect(assignPriorityLevel(input(40, 1), config)).toBe("Monitor")
  })

  it("[10] score 100 + signals 0 → Monitor (zero signals = no tier triggers)", () => {
    expect(assignPriorityLevel(input(100, 0), config)).toBe("Monitor")
  })

  // ─── Excluded short-circuit (D1) ───────────────────────────────────
  it("[11] excludedFrom=['scoring'] + score 100 + signals 10 → Excluded", () => {
    // Even with a hypothetically max-out score+signal count, the
    // opt-out wins — Excluded distinguishes "operator opted out"
    // from "score too low" (Monitor).
    expect(assignPriorityLevel(input(100, 10, ["scoring"]), config)).toBe("Excluded")
  })

  it("[12] excludedFrom=['outreach'] (NOT scoring) + score 75 + signals 3 → P1", () => {
    // Only the literal "scoring" tag triggers the opt-out. Other
    // exclusion tags ("outreach", custom values) DO NOT bypass the
    // normal level assignment — they may have other downstream
    // effects (Lemlist filter, etc.) but not on the scoring rules.
    expect(assignPriorityLevel(input(75, 3, ["outreach"]), config)).toBe("P1")
  })

  it("[13] excludedFrom=['scoring','outreach'] (mixed) → Excluded (scoring tag found)", () => {
    expect(assignPriorityLevel(input(80, 5, ["scoring", "outreach"]), config)).toBe("Excluded")
  })
})
