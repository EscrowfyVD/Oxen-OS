// Iterate every scoring-active CrmContact and call persistScore.
//
// Sprint 3c B5. Shared by :
//   - the daily cron at /api/cron/recompute-scores
//   - the admin batch endpoint at /api/scoring/recalculate-all
//
// Per Recon D5 — this is a SEPARATE module from signal-decay-runner.
// The decay cron (signal-decay-runner) and the score cron run
// independently so they can scale + fail independently. Today both
// run small (~10 active contacts, ~hundreds of signals) but the
// decoupling is cheap to maintain and pays off when volume grows.
//
// Per Recon D6 — synchronous V1. The current "active" pool is
// 10 contacts (587/597 are excluded). One persistScore call is
// ~200ms in dev against Railway. Total ~2s for V1, well under any
// HTTP timeout. V2 = queue (pg-boss / bull / Railway scheduler) when
// the pool grows beyond ~500.
//
// Per Recon D8 — last-write-wins. Two concurrent runs (cron + manual)
// will produce two ScoreHistory rows (audit-safe) and the second
// CrmContact write wins on the columns. Acceptable for V1.

import { prisma } from "@/lib/prisma"
import { getActiveScoringConfig } from "./config-loader"
import { persistScore } from "./persist-score"

export interface ScoreRecomputeRunnerResult {
  /** Total CrmContacts the runner processed (excluded ones are skipped). */
  processed: number
  /** Count of accounts whose newLevel ranked strictly higher than previous. */
  promoted: number
  /** Per-account errors (the runner continues on failure ; the array
   *  is the audit trail for ops triage). */
  errors: Array<{ accountId: string; error: string }>
  /** Optional total wall clock for the run — set by the cron route. */
  durationMs?: number
}

/**
 * Run the score recompute over every scoring-eligible CrmContact.
 *
 * Skips contacts whose `excludedFrom` array contains "scoring" — the
 * exclusion is honored at the QUERY level rather than inside
 * persistScore, so excluded contacts don't generate ScoreHistory
 * rows at every cron fire (the cron is supposed to be a periodic
 * refresh of accounts still under active scoring).
 *
 * Manually opting one back in (BD removes "scoring" from
 * excludedFrom) brings it back into the next cron run automatically.
 *
 * Continues on per-account failure : one contact throwing doesn't
 * stop the runner. The error gets collected in `errors[]` for the
 * caller to log + alert as needed.
 */
export async function runScoreRecompute(
  now: Date = new Date(),
): Promise<ScoreRecomputeRunnerResult> {
  const config = await getActiveScoringConfig()

  const contacts = await prisma.crmContact.findMany({
    where: {
      NOT: { excludedFrom: { has: "scoring" } },
    },
    select: { id: true },
  })

  let processed = 0
  let promoted = 0
  const errors: ScoreRecomputeRunnerResult["errors"] = []

  for (const c of contacts) {
    try {
      const result = await persistScore(c.id, "contact", config, now)
      processed++
      if (result.promoted) promoted++
    } catch (err) {
      errors.push({
        accountId: c.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { processed, promoted, errors }
}
