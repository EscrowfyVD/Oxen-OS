/**
 * Drift detector — SignalTypeRegistry.triggerType (canonical) MUST agree
 * with config.followUpTriggers (runtime) for every active code.
 *
 * Why this exists (PRD-004 §8, and the note in classify-trigger.ts):
 * there are two sources of trigger truth that have to stay in lockstep —
 *   - the registry column `triggerType`, written by the backfill MAPPING
 *     (canonical / doc mapping, also the seed source), and
 *   - `config.followUpTriggers.{immediate,rapid,passive}.signals[]`, which
 *     is what `classifyTrigger()` actually reads at runtime.
 * If they drift, a code can be documented as one bucket but fire as
 * another. This test catches that at PR time, before deploy — it's the
 * "green drift-detector" gate for ScoringConfig v2.
 *
 * It asserts against the in-code sources (MAPPING + buildScoringConfigV2),
 * so it needs no database and runs in plain `npm test`.
 *
 * Recon (Sprint 3d) found two pre-existing drifts that v2 resolves:
 *   - trigify_oxen_engagement_comment: registry was `rapid`, config
 *     `immediate` → registry realigned to immediate.
 *   - trigify_competitor_engagement: registry `rapid`, config was
 *     `passive` → config bucket moved to rapid (registry already correct).
 */

import { describe, it, expect } from "vitest"
import { classifyTrigger } from "../../src/lib/scoring/classify-trigger"
import {
  MAPPING,
  PLACEHOLDERS_TO_DEACTIVATE,
} from "./backfill-signal-types-categories"
import { buildScoringConfigV2 } from "./seed-scoring-config"

// Codes that carry a registry triggerType for documentation but are
// intentionally NOT wired into any config followUpTriggers bucket — they
// score the account/market but never drive a contact follow-up:
//   - clay_business_loss: account-level Cat F, score-only.
//   - market_country_regulation_change: MARKET → MarketSignal, excluded
//     from individual scoring by construction (signal-ingestion guard).
// A code that lands in MAPPING without a config bucket and isn't here will
// fail the detector, forcing a conscious "is this score-only?" decision.
const SCORE_ONLY_EXEMPT = new Set<string>([
  "clay_business_loss",
  "market_country_regulation_change",
])

const triggerTypeOf = (code: string): string => {
  const entry = MAPPING.find((m) => m.code === code)
  if (!entry) throw new Error(`${code} not found in backfill MAPPING`)
  return entry.triggerType
}

describe("trigger drift detector (registry MAPPING vs config.followUpTriggers)", () => {
  const config = buildScoringConfigV2()

  it("every active code's registry triggerType matches its config bucket (or is a known score-only code)", () => {
    const drifts: string[] = []

    for (const m of MAPPING) {
      const bucket = classifyTrigger(m.code, config)
      if (bucket === null) {
        // Not wired for follow-up → must be a known score-only code.
        if (!SCORE_ONLY_EXEMPT.has(m.code)) {
          drifts.push(
            `${m.code}: registry triggerType="${m.triggerType}" but not wired in any config bucket (and not a known score-only code)`,
          )
        }
      } else if (bucket !== m.triggerType) {
        drifts.push(
          `${m.code}: registry triggerType="${m.triggerType}" but config classifies as "${bucket}"`,
        )
      }
    }

    // On failure vitest prints the offending entries — exactly which code
    // drifted and in which direction.
    expect(drifts).toEqual([])
  })

  it("the 3 v2-reconciled codes agree registry == config == doc", () => {
    // comment → immediate (doc §8.3); registry realigned from rapid.
    expect(classifyTrigger("trigify_oxen_engagement_comment", config)).toBe(
      "immediate",
    )
    expect(triggerTypeOf("trigify_oxen_engagement_comment")).toBe("immediate")

    // role_change → rapid (doc §8.3); moved in BOTH registry and config.
    expect(classifyTrigger("trigify_role_change", config)).toBe("rapid")
    expect(triggerTypeOf("trigify_role_change")).toBe("rapid")

    // competitor_engagement → rapid (doc §8.3); config bucket moved,
    // registry already correct.
    expect(classifyTrigger("trigify_competitor_engagement", config)).toBe(
      "rapid",
    )
    expect(triggerTypeOf("trigify_competitor_engagement")).toBe("rapid")
  })

  it("score-only exempt codes are genuinely unwired (exemption isn't masking a real bucket)", () => {
    for (const code of SCORE_ONLY_EXEMPT) {
      expect(classifyTrigger(code, config)).toBeNull()
    }
  })

  it("deactivated placeholders are not wired in any config bucket", () => {
    for (const code of PLACEHOLDERS_TO_DEACTIVATE) {
      expect(classifyTrigger(code, config)).toBeNull()
    }
  })
})
