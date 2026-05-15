// Proxy scoring for the Intent Feed UI.
//
// V1 stand-in for the future Phase 3 Scoring Engine — combines the
// signal's raw points with a recency boost so newer signals float
// higher in the feed. When the real scoring engine ships (PRD-001
// Phase 3), this module is replaced by reading `IntentSignal.priorityScore`
// directly. Keeping the math here (and not embedded in the page or
// API route) means the cutover is a one-file rewrite.
//
// Spec (PRD-003 v1.1):
//   recencyBoost: 1.5 if <24h, 1.0 if <7d, 0.7 otherwise
//   proxyScore = points * recencyBoost
//   Hot threshold = 7.0 (anything above renders the HOT badge)

export const HOT_SIGNAL_THRESHOLD = 7.0

const MS_PER_HOUR = 1000 * 60 * 60
const MS_PER_DAY = MS_PER_HOUR * 24

/**
 * Compute the recency multiplier for a given signal age.
 * Pure function — extracted so the proxy-score test can assert each
 * boundary independently of the points multiplication.
 */
export function recencyBoost(ageMs: number): number {
  if (ageMs < 24 * MS_PER_HOUR) return 1.5
  if (ageMs < 7 * MS_PER_DAY) return 1.0
  return 0.7
}

/**
 * Compute the proxy score for a signal. `points` defaults to 0 (safe
 * fallback if the registry record is missing or 0-valued); the
 * `createdAt` anchor is treated as "now" if null, which collapses to
 * a 1.5x recency boost — the safest default for a signal whose
 * timestamp wasn't materialized yet.
 */
export function computeProxyScore(
  points: number | null | undefined,
  createdAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  const p = points ?? 0
  const occurred = createdAt
    ? typeof createdAt === "string"
      ? new Date(createdAt)
      : createdAt
    : now
  const ageMs = Math.max(0, now.getTime() - occurred.getTime())
  return p * recencyBoost(ageMs)
}

/**
 * Is this proxy score "hot"? Used for the HOT badge + the `hot_only`
 * filter. Strict greater-than so a borderline score of 7.0 doesn't
 * burn the badge.
 */
export function isHot(proxyScore: number): boolean {
  return proxyScore > HOT_SIGNAL_THRESHOLD
}
