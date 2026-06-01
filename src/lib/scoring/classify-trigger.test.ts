/**
 * Tests for classifyTrigger (Sprint 3d B1).
 *
 * Uses the real V1 config blob from `buildScoringConfigV1()` so the
 * tests double as a contract check on the seed file. If a future
 * config tweak moves a code between buckets, the failing test points
 * exactly at which assumption broke.
 */

import { describe, it, expect } from "vitest"
import { classifyTrigger } from "./classify-trigger"
import {
  buildScoringConfigV1,
  buildScoringConfigV2,
} from "../../../scripts/db/seed-scoring-config"

const config = buildScoringConfigV1()

describe("classifyTrigger", () => {
  // ─── [1] immediate ────────────────────────────────────────────────
  it("[1] returns 'immediate' for trigify_profile_visit", () => {
    expect(classifyTrigger("trigify_profile_visit", config)).toBe("immediate")
  })

  // ─── [2] rapid ────────────────────────────────────────────────────
  it("[2] returns 'rapid' for clay_director_change", () => {
    expect(classifyTrigger("clay_director_change", config)).toBe("rapid")
  })

  // ─── [3] passive ──────────────────────────────────────────────────
  it("[3] returns 'passive' for trigify_oxen_engagement_like", () => {
    expect(classifyTrigger("trigify_oxen_engagement_like", config)).toBe(
      "passive",
    )
  })

  // ─── [4] unknown ──────────────────────────────────────────────────
  it("[4] returns null for unknown signal code", () => {
    expect(classifyTrigger("totally_made_up_signal", config)).toBeNull()
  })

  // ─── [5] deactivated registry code ────────────────────────────────
  // The 3 placeholder codes (trigify_intent_signal, clay_legacy_intent,
  // n8n_external_signal) are isActive=false in the registry and are
  // NOT included in any of the config followUpTriggers arrays. They
  // must classify to null — drift here would silently route a dead
  // code to "passive" via a future config edit, hence the explicit test.
  it("[5] returns null for deactivated placeholder code", () => {
    expect(classifyTrigger("trigify_intent_signal", config)).toBeNull()
    expect(classifyTrigger("clay_legacy_intent", config)).toBeNull()
    expect(classifyTrigger("n8n_external_signal", config)).toBeNull()
  })

  // ─── [6] cross-bucket non-collision ───────────────────────────────
  // clay_director_change is in `rapid`. Asserts it does NOT also leak
  // into `passive` (defensive — would only fail if a maintainer
  // accidentally duplicates the code across buckets).
  it("[6] clay_director_change resolves to rapid (not passive)", () => {
    const result = classifyTrigger("clay_director_change", config)
    expect(result).toBe("rapid")
    expect(result).not.toBe("passive")
    expect(config.followUpTriggers.passive.signals).not.toContain(
      "clay_director_change",
    )
  })
})

// ─── v2 reconciliation (Sprint 3d) — reclassified runtime behavior ───
// Pinned to buildScoringConfigV2() so the runtime consumer (classifyTrigger)
// is proven to reflect the doc §8.3 reclassifications. Each case also
// asserts the v1 value to make the v2-scoped delta explicit.
describe("classifyTrigger (ScoringConfig v2)", () => {
  const v2 = buildScoringConfigV2()
  const v1 = buildScoringConfigV1()

  it("[7] trigify_oxen_engagement_comment → immediate (unchanged from v1 config)", () => {
    expect(classifyTrigger("trigify_oxen_engagement_comment", v2)).toBe(
      "immediate",
    )
  })

  it("[8] trigify_role_change → rapid in v2 (was passive in v1)", () => {
    expect(classifyTrigger("trigify_role_change", v2)).toBe("rapid")
    expect(classifyTrigger("trigify_role_change", v1)).toBe("passive")
  })

  it("[9] trigify_competitor_engagement → rapid in v2 (was passive in v1)", () => {
    expect(classifyTrigger("trigify_competitor_engagement", v2)).toBe("rapid")
    expect(classifyTrigger("trigify_competitor_engagement", v1)).toBe("passive")
  })
})
