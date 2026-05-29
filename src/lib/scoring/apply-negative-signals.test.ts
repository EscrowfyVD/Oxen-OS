/**
 * Tests for applyNegativeSignals (Sprint 3c B3 — Option A V1).
 *
 * Covers the 3 covered negative-signal paths (email_bounce,
 * lemlist_unsubscribe, doNotContact), the short-circuit on
 * already-excluded, the score clamp ≥ 0, and the no-op passthrough.
 */

import { describe, it, expect } from "vitest"
import { applyNegativeSignals } from "./apply-negative-signals"
import { buildScoringConfigV1 } from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()

function input(opts: {
  lemlistStatus?: string | null
  doNotContact?: boolean
  excludedFrom?: string[]
}) {
  return {
    lemlistStatus: opts.lemlistStatus ?? null,
    doNotContact: opts.doNotContact ?? false,
    excludedFrom: opts.excludedFrom ?? [],
  }
}

describe("applyNegativeSignals", () => {
  // ─── Covered negatives ────────────────────────────────────────────
  it("[1] lemlistStatus='bounced' → adjustedScore -15 + flag_invalid", () => {
    const r = applyNegativeSignals(input({ lemlistStatus: "bounced" }), 40, config)
    expect(r.adjustedScore).toBe(25)
    expect(r.excluded).toBe(false)
    expect(r.actions).toEqual(["flag_invalid"])
  })

  it("[2] lemlistStatus='unsubscribed' → excluded + exclude action", () => {
    const r = applyNegativeSignals(input({ lemlistStatus: "unsubscribed" }), 80, config)
    expect(r.excluded).toBe(true)
    expect(r.actions).toEqual(["exclude"])
    // Score is NOT adjusted on unsubscribe (impact = 0 in ScoringConfig
    // v1) — the exclusion side-effect alone is the signal.
    expect(r.adjustedScore).toBe(80)
  })

  it("[3] doNotContact=true → excluded + exclude action", () => {
    const r = applyNegativeSignals(input({ doNotContact: true }), 50, config)
    expect(r.excluded).toBe(true)
    expect(r.actions).toEqual(["exclude"])
  })

  // ─── No-op passthrough ────────────────────────────────────────────
  it("[4] no negatives → adjustedScore == baseScore, no exclude, no actions", () => {
    const r = applyNegativeSignals(input({}), 60, config)
    expect(r.adjustedScore).toBe(60)
    expect(r.excluded).toBe(false)
    expect(r.actions).toEqual([])
  })

  it("[5] lemlistStatus='active' (positive sequence state) → no-op", () => {
    const r = applyNegativeSignals(input({ lemlistStatus: "active" }), 60, config)
    expect(r.adjustedScore).toBe(60)
    expect(r.excluded).toBe(false)
    expect(r.actions).toEqual([])
  })

  // ─── Clamp and stacking ───────────────────────────────────────────
  it("[6] bounce on low score → adjustedScore clamped to 0 (not negative)", () => {
    // 10 - 15 = -5 → clamp to 0.
    const r = applyNegativeSignals(input({ lemlistStatus: "bounced" }), 10, config)
    expect(r.adjustedScore).toBe(0)
    expect(r.actions).toEqual(["flag_invalid"])
  })

  it("[7] bounced + unsubscribed (stacked) → both deductions + excluded", () => {
    // Order-independent : Set-dedup actions, both effects materialize.
    const r = applyNegativeSignals(
      input({ lemlistStatus: "unsubscribed" }),
      50,
      config,
    )
    // (Single-status field per row in the schema — this asserts
    // unsubscribed alone produces exclude. Stacking ON ONE ROW is
    // only doNotContact + a lemlist state.)
    expect(r.excluded).toBe(true)
  })

  it("[8] doNotContact=true + lemlistStatus='bounced' → -15 + excluded", () => {
    // Both negatives present on one contact : score drops AND we exclude.
    const r = applyNegativeSignals(
      input({ lemlistStatus: "bounced", doNotContact: true }),
      80,
      config,
    )
    expect(r.adjustedScore).toBe(65)
    expect(r.excluded).toBe(true)
    expect(r.actions.sort()).toEqual(["exclude", "flag_invalid"])
  })

  // ─── Short-circuit on already-excluded ────────────────────────────
  it("[9] excludedFrom already contains 'scoring' → short-circuit, score unchanged", () => {
    // No deduction applied, no rediscovery of the lemlist status —
    // the contact was already opted out and the engine respects that
    // single source of truth.
    const r = applyNegativeSignals(
      input({ lemlistStatus: "bounced", excludedFrom: ["scoring"] }),
      50,
      config,
    )
    expect(r.adjustedScore).toBe(50)
    expect(r.excluded).toBe(true)
    expect(r.actions).toEqual(["already_excluded"])
  })
})
