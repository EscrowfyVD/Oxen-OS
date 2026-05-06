// Time-decay math for IntentSignal + MarketSignal points (Sprint S1
// batch 3).
//
// Each signal in the registry carries a `decayDays` window and a
// `decayCurve` shape. As time passes between `occurredAt` and `now`,
// the original `points` value decays toward 0. The decayed value is
// what the scoring engine consumes; the original `points` stays
// immutable on the row so we can replay the math at any time.
//
// The cron `scripts/cron/recompute-signal-decay.ts` calls this helper
// in batches to materialize `decayedPoints` so dashboard reads don't
// pay the math on every query.
//
// Pure function: no Prisma, no DB, no logger, no env vars — safe to
// unit-test against arbitrary inputs.
//
// Refs: PRD-001 §4.2 Signal Decay (Sprint S1 batch 3)

import type { SignalDecayCurve } from "@prisma/client"

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Compute the decayed point value of a signal at a given moment.
 *
 *   - originalPoints : the immutable `points` recorded when the
 *     signal was ingested (typically equal to
 *     SignalTypeRegistry.defaultPoints, or a `customPoints` override).
 *   - occurredAt     : real-world timestamp of the event the signal
 *     captures (Lemlist reply, LinkedIn post, regulatory change…).
 *   - decayDays      : window over which the curve interpolates from
 *     full points to 0. After this window, the signal contributes 0
 *     to scoring. Special case: `decayDays <= 0` is treated as
 *     "permanent — never decays" (returns originalPoints unchanged).
 *   - curve          : LINEAR | EXPONENTIAL | STEP — see comments
 *     inline.
 *   - now            : evaluation moment, defaults to `new Date()`.
 *     Exposed as a parameter so tests can pin time without faking
 *     globals, and so the cron can pass a fixed timestamp for a
 *     coherent batch run.
 *
 * Always returns Math.max(0, ...) — a signal never contributes
 * negative points to scoring.
 *
 * Edge cases:
 *   - originalPoints === 0  → returns 0
 *   - decayDays <= 0        → returns originalPoints (permanent signal)
 *   - now < occurredAt      → returns originalPoints (signal hasn't
 *                              started decaying yet — useful for
 *                              backdated signals or clock drift)
 *   - elapsedDays >= decayDays → returns 0 (clamp)
 */
export function calculateDecayedPoints(
  originalPoints: number,
  occurredAt: Date,
  decayDays: number,
  curve: SignalDecayCurve,
  now: Date = new Date(),
): number {
  // Permanent / non-decaying signals — short-circuit.
  if (decayDays <= 0) return Math.max(0, originalPoints)
  if (originalPoints <= 0) return 0

  const elapsedDays = (now.getTime() - occurredAt.getTime()) / MS_PER_DAY

  // Backdated or clock-drift case — signal hasn't begun decaying.
  if (elapsedDays < 0) return originalPoints

  // Past the decay window — clamp to 0 so the curve switch below never
  // returns negative or near-floating-point-error positive values.
  if (elapsedDays >= decayDays) return 0

  const ratio = elapsedDays / decayDays

  switch (curve) {
    case "LINEAR":
      // Straight-line interpolation: full → 0 over decayDays.
      return Math.max(0, Math.round(originalPoints * (1 - ratio)))

    case "EXPONENTIAL":
      // Half-life anchored at decayDays/2 (signal is worth 50% of its
      // original points at the midpoint of the decay window). The
      // factor is `exp(-ratio * LN2 * 2)`:
      //   - at ratio=0   : exp(0)            = 1.0  → full points
      //   - at ratio=0.5 : exp(-LN2)         = 0.5  → half-life
      //   - at ratio=1.0 : exp(-2 * LN2)     = 0.25 → would give 25%
      //                                              but clamped to 0
      //                                              by the `>=`
      //                                              branch above
      return Math.max(
        0,
        Math.round(originalPoints * Math.exp(-ratio * Math.LN2 * 2)),
      )

    case "STEP":
      // 3 paliers — useful for "all or nothing" signals where the
      // analyst wants a hard cliff rather than a smooth curve.
      //   - ratio < 0.33  : 100% of original points
      //   - ratio < 0.66  : 50% of original points
      //   - ratio >= 0.66 : 0
      if (ratio < 0.33) return originalPoints
      if (ratio < 0.66) return Math.max(0, Math.round(originalPoints * 0.5))
      return 0
  }
}
