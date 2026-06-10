// Persist a freshly-computed score to CrmContact + ScoreHistory.
//
// Sprint 3c B4 — the orchestrator that glues Sprint 3b (pure compute)
// to the DB persistence layer. Single source of truth for : "given an
// accountId, fetch the contact, compute the score, apply negative
// signals, classify it, write the snapshot atomically, return the
// before/after delta for downstream consumers (Sprint 3d alert
// system)."
//
// Decisions actées (Recon Sprint 3c) :
//   D4 — `icpScoreBreakdown` Json on CrmContact is OVERWRITTEN with
//        the Sprint 3b breakdown format ({intermediaryType:{points,
//        tier}, companySize:{...}, ...}). Confirmed 0/597 contacts
//        carry the legacy AI-format breakdown today — safe overwrite.
//   D5 — score-recompute-runner.ts is a SEPARATE module (Sprint 3c
//        B5), not an extension of signal-decay-runner.ts. This file
//        deals only with one account per call.
//   D7 — Returns {previousLevel, newLevel, promoted}. Sprint 3d's
//        alert system consumes `promoted` to decide whether to fire
//        a BD Telegram broadcast on P-level upgrades.
//   D8 — Last-write-wins on CrmContact. ScoreHistory rows are never
//        overwritten — every recompute produces an additional audit
//        row. The composite (accountId, computedAt) index keeps
//        timeline queries fast.
//
// Out of scope (deferred Sprint 3d) :
//   - The promotion alert side-effect itself (this fn only RETURNS
//     the delta ; the caller decides whether to alert).
//
// Finding 1 (resolved) — configVersion is no longer hardcoded. The
// caller threads the real active version (from
// getActiveScoringConfigWithVersion) into the `configVersion` param so
// each ScoreHistory row records which config produced it (doc §13.3).

import { prisma } from "@/lib/prisma"
import { computePriorityScore } from "./compute-priority-score"
import { assignPriorityLevel } from "./assign-priority-level"
import {
  inferPainTier,
  painTierForPrismaWrite,
  type PainTier,
} from "./infer-pain-tier"
import { applyNegativeSignals } from "./apply-negative-signals"
import type { ScoringConfigBlob } from "./config-types"

export interface PersistScoreResult {
  accountId: string
  accountType: "contact" | "company"
  /** Pre-update priorityLevel from CrmContact (null when never scored). */
  previousLevel: string | null
  /** Newly computed priorityLevel that was just persisted. */
  newLevel: string
  /**
   * True when newLevel ranks STRICTLY HIGHER than previousLevel
   * (per LEVEL_RANK below). Sprint 3d alert system reads this to
   * decide whether to fire a BD Telegram broadcast.
   */
  promoted: boolean
  icpScore: number
  intentScore: number
  priorityScore: number
  signalCount: number
  painTier: PainTier | null
  excluded: boolean
  actions: string[]
}

// Ordinal ranking — higher is more urgent. Excluded sits below
// Monitor because moving out of Excluded is informative (operator
// un-opted-out, a manual change worth noting) but doesn't fire BD
// alerts — those are score-driven.
const LEVEL_RANK: Record<string, number> = {
  Excluded: -1,
  Monitor: 0,
  P3: 1,
  P2: 2,
  P1: 3,
}

const TRANSACTION_TIMEOUT_MS = 5000

export async function persistScore(
  accountId: string,
  accountType: "contact" | "company",
  config: ScoringConfigBlob,
  /**
   * The active ScoringConfig.version (Finding 1). Threaded from the
   * caller's getActiveScoringConfigWithVersion() so the ScoreHistory row
   * records which config produced this snapshot — was hardcoded to 1
   * before v2 shipped, which would have mislabelled every v2 conversion.
   */
  configVersion: number,
  now: Date = new Date(),
): Promise<PersistScoreResult> {
  // 1. Fetch the contact's negative-signal-relevant + override fields
  //    AND the previous priorityLevel for the delta computation.
  const contact = await prisma.crmContact.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      companyId: true, // PR2.5 — for account-signal read-time reflection
      lemlistStatus: true,
      doNotContact: true,
      excludedFrom: true,
      painTierOverride: true,
      priorityLevel: true,
    },
  })
  if (!contact) {
    throw new Error(`persistScore: contact ${accountId} not found`)
  }

  // 2. Compute the score via Sprint 3b. Reads the contact + company
  //    + intent signals + closed-won deals internally — no need to
  //    pre-fetch here.
  const score = await computePriorityScore(
    accountId,
    accountType,
    config,
    now,
    contact.companyId,
  )

  // 3. Apply negative signals. Reads CrmContact direct fields (Option
  //    A V1 — no negative-IntentSignal layer).
  const negatives = applyNegativeSignals(
    {
      lemlistStatus: contact.lemlistStatus,
      doNotContact: contact.doNotContact,
      excludedFrom: contact.excludedFrom,
    },
    score.total,
    config,
  )

  // 4. Determine the final excludedFrom. If negatives triggered an
  //    exclusion that wasn't already in the array, append "scoring".
  //    We DON'T mutate the input array.
  const finalExcludedFrom =
    negatives.excluded && !contact.excludedFrom.includes("scoring")
      ? [...contact.excludedFrom, "scoring"]
      : contact.excludedFrom

  // 5. Assign the priority level using the negative-adjusted score +
  //    the final exclusion state.
  const newLevel = assignPriorityLevel(
    {
      score: negatives.adjustedScore,
      signalCount: score.signalCount,
      excludedFrom: finalExcludedFrom,
    },
    config,
  )

  // 6. Infer pain tier (V1 override-only — see infer-pain-tier.ts).
  const painTier = inferPainTier({
    painTierOverride: contact.painTierOverride,
    excludedFrom: finalExcludedFrom,
  })

  // 7. Compute promotion delta. Treat null previous as "Monitor" so
  //    the first-ever scoring of a contact reflects properly :
  //    Monitor → P1 IS a promotion.
  const previousLevel = contact.priorityLevel
  const previousRank = LEVEL_RANK[previousLevel ?? "Monitor"] ?? 0
  const newRank = LEVEL_RANK[newLevel] ?? 0
  const promoted = newRank > previousRank

  // 8. Persist atomically — UPDATE CrmContact + INSERT ScoreHistory
  //    in a single transaction. Interactive form (function callback)
  //    so we can pass a timeout — the array form doesn't accept it
  //    in Prisma 5.
  await prisma.$transaction(
    async (tx) => {
      await tx.crmContact.update({
        where: { id: accountId },
        data: {
          icpScore: score.icp,
          intentScore: score.intent,
          priorityScore: negatives.adjustedScore,
          priorityLevel: newLevel,
          painTier: painTierForPrismaWrite(painTier),
          signalCount: score.signalCount,
          lastScoredAt: now,
          // D4 — overwrite with Sprint 3b breakdown shape. Legacy
          // AI-format rows are 0/597 today (pre-checked) ; this
          // write replaces them when V2 produces a richer
          // breakdown later, the same overwrite pattern applies.
          icpScoreBreakdown: score.breakdown.icp as unknown as Parameters<
            typeof tx.crmContact.update
          >[0]["data"]["icpScoreBreakdown"],
          excludedFrom: finalExcludedFrom,
        },
      })
      await tx.scoreHistory.create({
        data: {
          accountId,
          accountType,
          // Stamp the REAL active config version (Finding 1) — threaded
          // by the caller from getActiveScoringConfigWithVersion so each
          // audit row records which config produced it (doc §13.3). Was
          // hardcoded to 1 before v2 shipped.
          configVersion,
          icpScore: score.icp,
          intentScore: score.intent,
          priorityScore: negatives.adjustedScore,
          priorityLevel: newLevel,
          signalCount: score.signalCount,
          painTier,
        },
      })
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  )

  return {
    accountId,
    accountType,
    previousLevel,
    newLevel,
    promoted,
    icpScore: score.icp,
    intentScore: score.intent,
    priorityScore: negatives.adjustedScore,
    signalCount: score.signalCount,
    painTier,
    excluded: negatives.excluded,
    actions: negatives.actions,
  }
}
