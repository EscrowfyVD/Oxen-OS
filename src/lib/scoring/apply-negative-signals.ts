// Apply negative-signal adjustments to a freshly-computed
// priorityScore.
//
// Sprint 3c B3 — Option A V1 (Recon Decision D3).
//
// Reads negative signals DIRECTLY off the CrmContact's existing
// fields (lemlistStatus, doNotContact, excludedFrom). Does NOT read
// dedicated negative-IntentSignal rows — the emission layer that
// would write them on Lemlist webhook events is deferred V2.
//
// Coverage : 3 of the 7 ScoringConfig.negativeSignals types (D9 —
// the seed defines 7, NOT 8 as some earlier prose suggested). The
// 4 not covered V1 :
//   - soft_not_interested      — Lemlist webhook can't distinguish
//                                 soft vs hard ; needs Lemlist
//                                 upstream change
//   - hard_not_interested      — same as above
//   - contact_left_company     — needs a Clay/Apollo enrichment
//                                 diff pipeline
//   - company_exited_space     — manual BD flag, no UI yet
//   - no_response_after_sequence — needs sequence-completion
//                                   detection (Lemlist webhook +
//                                   timer)
// Covered :
//   - email_bounce            — contact.lemlistStatus === "bounced"
//   - lemlist_unsubscribe     — contact.lemlistStatus === "unsubscribed"
//   - hard_not_interested-ish — contact.doNotContact === true
//     (treated as a hard exclusion ; semantically closer to "the
//      operator pinned this contact as do-not-contact for any reason"
//      than to Andy's strict hard_not_interested definition. V2
//      separates them when Lemlist exposes the distinct reply
//      classification.)

import type { ScoringConfigBlob } from "./config-types"

export interface NegativeSignalsInput {
  /**
   * Lemlist sequence status — populated by the lemlist webhook handler
   * on email-event delivery. Schema-permitted values include
   * "active" / "paused" / "completed" / "replied" / "bounced" /
   * "unsubscribed". Only the bounced + unsubscribed values trigger
   * negative adjustments here.
   */
  lemlistStatus: string | null
  /**
   * The operator's manual "do not contact" flag on CrmContact
   * (Boolean, default false). Treated as a hard exclusion regardless
   * of the score.
   */
  doNotContact: boolean
  /**
   * Current excludedFrom tags. We may APPEND "scoring" to this when
   * an unsubscribe or doNotContact triggers exclusion — but never
   * mutate the input array ; the caller decides whether to persist
   * the new list. See persistScore.ts for the integration.
   */
  excludedFrom: string[]
}

export interface NegativeSignalsResult {
  /** baseScore after deductions, clamped to ≥ 0. */
  adjustedScore: number
  /** True when at least one negative triggers a hard exclude action. */
  excluded: boolean
  /**
   * Ordered list of distinct action codes. May contain :
   *   - "already_excluded"  (short-circuit — contact was already opted out)
   *   - "flag_invalid"      (email_bounce)
   *   - "exclude"           (lemlist_unsubscribe or doNotContact)
   * Repeated calls do NOT duplicate actions (set-deduplicated).
   */
  actions: string[]
}

/**
 * Apply Option A V1 negatives. Pure function — no DB touch, no
 * config mutation. The returned `excluded` flag tells the caller
 * whether to APPEND "scoring" to the contact's excludedFrom array
 * (persistScore.ts does this) ; we don't mutate the input.
 */
export function applyNegativeSignals(
  input: NegativeSignalsInput,
  baseScore: number,
  config: ScoringConfigBlob,
): NegativeSignalsResult {
  // Already opted out — short-circuit. Don't read the contact's
  // lemlist status because we'd just re-confirm the exclusion ; the
  // action list says "already_excluded" so downstream consumers
  // don't double-fire any side effects (V2 Sprint 3d alert system).
  if (input.excludedFrom.includes("scoring")) {
    return {
      adjustedScore: baseScore,
      excluded: true,
      actions: ["already_excluded"],
    }
  }

  let adjustedScore = baseScore
  let excluded = false
  const actionSet = new Set<string>()

  // email_bounce → impact -15 (per ScoringConfig.negativeSignals.email_bounce),
  // action flag_invalid. Score stays in domain — clamped ≥ 0 below.
  if (input.lemlistStatus === "bounced") {
    const impact = config.negativeSignals.email_bounce?.impact ?? -15
    adjustedScore += impact // impact is already negative
    actionSet.add("flag_invalid")
  }

  // lemlist_unsubscribe → impact 0, action exclude. The unsubscribe
  // is a hard signal — even a P1-eligible score gets opted out.
  if (input.lemlistStatus === "unsubscribed") {
    excluded = true
    actionSet.add("exclude")
  }

  // doNotContact — operator manual flag. Treat as hard exclude.
  if (input.doNotContact) {
    excluded = true
    actionSet.add("exclude")
  }

  // Clamp to ≥ 0 — a contact that bounces with a base score of 10
  // shouldn't end up with -5.
  if (adjustedScore < 0) adjustedScore = 0

  return {
    adjustedScore,
    excluded,
    actions: Array.from(actionSet),
  }
}
