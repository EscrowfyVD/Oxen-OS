// Combined Priority Score (0-100) = ICP (0-50) + Intent (0-50).
//
// Thin orchestrator that calls computeICPScore and computeIntentScore
// in parallel and assembles the breakdown for the explain UI. No
// extra math here — the sub-functions cap their own outputs, so the
// sum is naturally ≤ 100.

import { computeICPScore, type ICPScoreResult } from "./compute-icp-score"
import {
  computeIntentScore,
  type IntentScoreResult,
} from "./compute-intent-score"
import type { ScoringConfigBlob } from "./config-types"

export interface PriorityScoreResult {
  /** ICP sub-score (0-50). */
  icp: number
  /** Intent sub-score (0-50). */
  intent: number
  /** Combined priority score (0-100). */
  total: number
  /** Number of non-expired intent signals contributing to the score. */
  signalCount: number
  breakdown: {
    icp: ICPScoreResult["breakdown"]
    intent: IntentScoreResult["breakdown"]
  }
}

/**
 * Compute the combined priority score for an account.
 *
 * accountId + accountType are passed through to the sub-functions:
 *   - ICP scoring is contact-only V1 (no Company-side ICP factors —
 *     the company data is read THROUGH the contact's relation), so
 *     a "company" accountType is supported only for the Intent side.
 *   - Intent scoring filters its IntentSignal query by contactId or
 *     companyId depending on accountType.
 *
 * Both sub-fetches happen in parallel (Promise.all) — they're
 * independent and the typical "warm cache" round trip is dominated
 * by the longer of the two.
 */
export async function computePriorityScore(
  accountId: string,
  accountType: "contact" | "company",
  config: ScoringConfigBlob,
  now: Date = new Date(),
): Promise<PriorityScoreResult> {
  const [icp, intent] = await Promise.all([
    computeICPScore(accountId, config),
    computeIntentScore(accountId, accountType, config, now),
  ])

  return {
    icp: icp.score,
    intent: intent.score,
    total: icp.score + intent.score,
    signalCount: intent.signalCount,
    breakdown: {
      icp: icp.breakdown,
      intent: intent.breakdown,
    },
  }
}
