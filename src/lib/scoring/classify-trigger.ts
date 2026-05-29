/**
 * Classify a signal code into one of three follow-up trigger buckets.
 *
 * Pure function — no I/O. Source of truth: the validated
 * `ScoringConfigBlob.followUpTriggers` arrays (already loaded + cached
 * 60s by `getActiveScoringConfig()`).
 *
 * Recon decision D2 (Sprint 3d) — we DO NOT read
 * `SignalTypeRegistry.triggerType` here. The config blob is the runtime
 * read path; the registry column remains the canonical mapping (and
 * the source the backfill seeds from). A drift detector at boot or
 * backfill time guarantees the two stay in sync — see PRD-004 §8.
 *
 * Behaviour:
 *   - Returns `"immediate" | "rapid" | "passive"` if the code maps to a bucket.
 *   - Returns `null` for unknown codes AND for deactivated registry
 *     codes (the seed config arrays exclude them). The caller decides
 *     whether to log/skip/alert.
 *
 * Refs:
 *   - PRD-004 §2.2.7 (followUpTriggers config shape)
 *   - PRD-004 §8 (immediate 2h, rapid 24h, passive score-only)
 *   - Sprint 3a B3 — `scripts/db/backfill-signal-types-categories.ts`
 *     defines the 11-code mapping that seeds both the registry column
 *     AND the seed-scoring-config arrays.
 */

import type { ScoringConfigBlob } from "./config-types"

export type TriggerType = "immediate" | "rapid" | "passive"

export function classifyTrigger(
  signalCode: string,
  config: ScoringConfigBlob,
): TriggerType | null {
  const { immediate, rapid, passive } = config.followUpTriggers
  if (immediate.signals.includes(signalCode)) return "immediate"
  if (rapid.signals.includes(signalCode)) return "rapid"
  if (passive.signals.includes(signalCode)) return "passive"
  return null
}
