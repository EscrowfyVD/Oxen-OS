// Apply time-decay coefficient to a single signal's raw points.
//
// Pure function — no DB touch, no system clock side effect (the `now`
// parameter is injectable so tests can pin a deterministic boundary).
//
// Decay model (Andy doc §5, materialized in ScoringConfig v1):
//   age ≤ 7d   → 1.0  (full weight)
//   age ≤ 30d  → 0.75 (warm)
//   age ≤ 90d  → 0.5  (cooling)
//   age > 90d  → 0    (expired — bracket with maxDays=null catches it)
//
// Boundaries are inclusive on the upper bound (≤, not <) so a signal
// landing exactly on a bracket edge keeps the higher coefficient.

import type { ScoringConfigBlob } from "./config-types"

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Compute the decayed points for one signal, using the bracket
 * coefficients from the active ScoringConfig.
 *
 * The bracket list is walked in order; the first bracket whose
 * maxDays envelope contains the signal's age wins. The final bracket
 * has `maxDays=null` and acts as the "expired" catch-all (coefficient
 * 0 by convention). Returns the raw arithmetic — caller decides
 * whether to round or clamp.
 *
 * Negative ages (signal createdAt in the future, e.g. clock skew on a
 * webhook source) are clamped to 0 days → full weight. This is the
 * safest default: a skewed signal is treated as fresh, not as a
 * crashed compute path.
 */
export function applyTimeDecay(
  signal: { points: number; createdAt: Date },
  config: ScoringConfigBlob,
  now: Date = new Date(),
): number {
  const ageMs = Math.max(0, now.getTime() - signal.createdAt.getTime())
  const ageDays = ageMs / MS_PER_DAY

  for (const bracket of config.timeDecay.brackets) {
    if (bracket.maxDays === null || ageDays <= bracket.maxDays) {
      return signal.points * bracket.coefficient
    }
  }

  // Should be unreachable when the config has a null-maxDays catch-all
  // (validated by Zod at load time). Defensive 0 returned anyway so a
  // malformed config doesn't propagate NaN into the scoring engine.
  return 0
}
