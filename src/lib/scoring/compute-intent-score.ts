// Compute the Intent sub-score (0-50) for one account.
//
// Sums the decayed points of every non-expired IntentSignal attached
// to the account in the active decay window, broken down by Andy's
// A-I taxonomy. Caps at 50 (other 50 of the priority score is ICP).
//
// Reaches into prisma to fetch signals — kept here (rather than in
// the Sprint 3c orchestrator) so the function is callable directly
// from any caller that has an accountId, without rebuilding the
// query each time. The function is otherwise pure: deterministic for
// a given (DB state, config, now) triple.

import { prisma } from "@/lib/prisma"
import { applyTimeDecay } from "./apply-time-decay"
import type { ScoringConfigBlob } from "./config-types"

export interface IntentScoreResult {
  /** Total Intent points after decay, capped at 50. */
  score: number
  breakdown: {
    /** Per-category subtotals (decayed sums). Categories with 0 omitted. */
    byCategory: Record<string, number>
  }
  /** Count of non-expired signals contributing to the score. */
  signalCount: number
  /** Per-category signal count (categories with 0 omitted). */
  signalCountByCategory: Record<string, number>
}

const INTENT_SCORE_CAP = 50 // matches Andy doc §4 — half of 100 priority score
const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Derive the look-back window from the decay config. The largest
 * non-null `maxDays` is the "expired" boundary — anything older
 * gets coefficient 0 and contributes nothing, so the DB query
 * filters it out for efficiency.
 */
function getLookbackDays(config: ScoringConfigBlob): number {
  const finite = config.timeDecay.brackets
    .map((b) => b.maxDays)
    .filter((d): d is number => d !== null)
  if (finite.length === 0) return 90 // defensive fallback
  return Math.max(...finite)
}

export async function computeIntentScore(
  accountId: string,
  accountType: "contact" | "company",
  config: ScoringConfigBlob,
  now: Date = new Date(),
  // PR2.5 — account-signal read-time reflection. When scoring a CONTACT and its
  // companyId is supplied, ALSO count the company's ACCOUNT-LEVEL signals
  // (companyId set, contactId NULL) so an account event lifts every contact at
  // the account. The `contactId: null` guard is the whole correctness of this:
  // contact-scoped signals denormalize companyId (they have BOTH ids), so
  // without the guard they'd be counted twice (via {contactId} AND {companyId}).
  // The guard keeps the two OR branches DISJOINT. companyId null → no branch →
  // identical to the pre-PR2.5 behaviour (no regression).
  contactCompanyId?: string | null,
): Promise<IntentScoreResult> {
  const lookbackDays = getLookbackDays(config)
  const since = new Date(now.getTime() - lookbackDays * MS_PER_DAY)

  const where =
    accountType === "contact"
      ? contactCompanyId
        ? {
            OR: [
              { contactId: accountId },
              { companyId: contactCompanyId, contactId: null },
            ],
          }
        : { contactId: accountId }
      : { companyId: accountId }

  const signals = await prisma.intentSignal.findMany({
    where: {
      ...where,
      createdAt: { gte: since },
      // Exclude placeholders (intentCategory NULL means "legacy /
      // un-categorized — Sprint 3a B3 hasn't reached this code yet").
      intentCategory: { not: null },
    },
    select: {
      points: true,
      createdAt: true,
      intentCategory: true,
    },
  })

  const byCategory: Record<string, number> = {}
  const signalCountByCategory: Record<string, number> = {}
  let total = 0
  let signalCount = 0

  for (const signal of signals) {
    const decayed = applyTimeDecay(signal, config, now)
    if (decayed === 0) continue
    // intentCategory was non-null per the query — coerce safely.
    const cat = signal.intentCategory as string
    byCategory[cat] = (byCategory[cat] ?? 0) + decayed
    signalCountByCategory[cat] = (signalCountByCategory[cat] ?? 0) + 1
    total += decayed
    signalCount += 1
  }

  return {
    score: Math.min(total, INTENT_SCORE_CAP),
    breakdown: { byCategory },
    signalCount,
    signalCountByCategory,
  }
}
