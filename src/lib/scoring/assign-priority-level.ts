// Assign a CrmContact / Company a Priority Level from its computed
// priorityScore + signalCount + excludedFrom tags.
//
// Pure function. Pinned to ScoringConfig v1 thresholds (P1: 75/3/2h,
// P2: 55/2/24h, P3: 40/2, Monitor: catch-all). When the config bumps
// to v2 with different thresholds, this function picks them up
// without code change — config is the source of truth.
//
// Decisions actées (Recon Sprint 3c) :
//   D1 — "Excluded" is a 5th level distinct from Monitor. Triggered by
//        `excludedFrom.includes("scoring")`. Distinguishes "operator
//        opted this account out of scoring" from "score too low to
//        cross the entry rule" (Monitor). priorityLevel remains a
//        String column on CrmContact, so no migration is needed to
//        add "Excluded" — both Monitor and Excluded coexist as
//        free-string values.
//   D8 — last-write-wins on CrmContact. Race conditions are accepted
//        (the cron runs once daily, manual recalculate is rare).

import type { ScoringConfigBlob } from "./config-types"

export type PriorityLevel = "P1" | "P2" | "P3" | "Monitor" | "Excluded"

export interface AssignPriorityLevelInput {
  /** Combined ICP + Intent score post-negative-signal adjustment (0-100). */
  score: number
  /** Count of non-expired IntentSignals contributing to the score. */
  signalCount: number
  /**
   * The contact's `excludedFrom` array (Sprint 3a CrmContact extension).
   * If it contains "scoring", we short-circuit to "Excluded" regardless
   * of score / signalCount — the operator has explicitly opted out.
   */
  excludedFrom: string[]
}

/**
 * Assign a priority level to an account.
 *
 * Both AND-conditions (score AND signals) must hold for a tier to
 * trigger — a score-75 account with only 2 signals is P2, NOT P1.
 * This mirrors Andy's spec : signal count is part of the entry rule
 * at every tier, not just an additional gate at P1.
 */
export function assignPriorityLevel(
  input: AssignPriorityLevelInput,
  config: ScoringConfigBlob,
): PriorityLevel {
  // D1 — opt-out short-circuit. Excluded supersedes any computed level.
  if (input.excludedFrom.includes("scoring")) {
    return "Excluded"
  }

  const { P1, P2, P3 } = config.priorityLevels

  // Order matters: highest tier first. Each tier is (score AND signals).
  if (input.score >= P1.minScore && input.signalCount >= P1.minSignals) {
    return "P1"
  }
  if (input.score >= P2.minScore && input.signalCount >= P2.minSignals) {
    return "P2"
  }
  if (input.score >= P3.minScore && input.signalCount >= P3.minSignals) {
    return "P3"
  }
  return "Monitor"
}
