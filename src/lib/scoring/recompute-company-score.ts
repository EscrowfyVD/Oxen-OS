// Persist a freshly-computed COMPANY intent score — the company-side mirror
// of persistScore (Apify PR3c-b-score).
//
// Writes the score the enrichment trigger (PR3c-b-enrich, pass-3 of the Apollo
// runner) will later read: `intentScore >= COMPANY_ENRICH_THRESHOLD AND
// enrichedAt IS NULL AND domain IS NULL`. THIS module only computes and writes
// — NO Apollo, NO enrichment, NO credit spend. `crossedThreshold` is returned
// for inline logging of the crossing (mirror of persistScore's `promoted`,
// D7 precedent); acting on it is the sweep's job, never ours.
//
// Score semantics (level-partition invariant):
//   - Aggregates the company's ACCOUNT-LEVEL signals only ({companyId,
//     contactId: null} — the PR2.5 reflection set) via computeIntentScore's
//     company mode (guard fixed in this PR). Contact signals NEVER count here;
//     this score is NEVER added to a contact score — disjoint consumers.
//   - Same decay mechanic as contacts (computeIntentScore → applyTimeDecay,
//     brackets 1.0/0.75/0.5/0, 90d lookback) — reused, not forked.
//   - NULL intentScore = "never scored" (matches the migration's semantics);
//     0 = "scored, zero live signals" (all decayed/expired or none present).
//     So a company that has RUN through here always carries a number.
//   - No contact dependency: a freshly captured company (PR3c-a — one account
//     signal, zero contacts) scores cleanly.

import { prisma } from "@/lib/prisma"
import { computeIntentScore } from "./compute-intent-score"
import type { ScoringConfigBlob } from "./config-types"

/**
 * FALLBACK for the enrichment-trigger threshold T (Vernon doctrine).
 * ~ "2 fresh hiring posts" (apify_g 6+6) or "funding + anything".
 *
 * The LIVE value is `config.enrichment.gate1Threshold` (PR3c-b slice 2 —
 * runtime-editable by Andy, ≤60s config-loader TTL, no redeploy). This const
 * is read ONLY when the active config predates v3 and carries no enrichment
 * block (the deploy→seed window, or any pre-v3 row): using it keeps the
 * crossing BYTE-IDENTICAL to the pre-slice-2 behaviour. 10 = the exact old
 * hardcoded value. (The runner still imports + logs this as the default
 * label — left untouched this slice.)
 */
export const COMPANY_ENRICH_THRESHOLD = 10

export interface RecomputeCompanyScoreResult {
  companyId: string
  /** Pre-update Company.intentScore (null = never scored before). */
  previousScore: number | null
  /** Newly computed + persisted score. */
  newScore: number
  /** Non-expired account-level signals contributing to newScore. */
  signalCount: number
  /**
   * True ONLY on an UPWARD crossing: previous (null → 0) < T AND new >= T.
   * A decay-only recompute (newScore <= previousScore) can NEVER set this —
   * a falling score cannot cross T upward. Already-above-T recomputes stay
   * false too (no re-fire). Logged by callers; ACTED ON only by the
   * PR3c-b-enrich sweep (which is additionally enrichedAt-idempotent).
   */
  crossedThreshold: boolean
  /**
   * The threshold T actually used this call: `config.enrichment.gate1Threshold`
   * when present, else the COMPANY_ENRICH_THRESHOLD fallback. Exposed so the
   * live wire is observable (tests + slice-4 logging of the real T).
   */
  threshold: number
}

export async function recomputeCompanyScore(
  companyId: string,
  config: ScoringConfigBlob,
  /** Active ScoringConfig.version — stamped on the ScoreHistory row (Finding 1). */
  configVersion: number,
  now: Date = new Date(),
): Promise<RecomputeCompanyScoreResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, intentScore: true },
  })
  if (!company) {
    throw new Error(`recomputeCompanyScore: company ${companyId} not found`)
  }

  // Account-level partition only — company mode carries the contactId:null
  // guard (fixed this PR). Reads signals, not contacts.
  const intent = await computeIntentScore(companyId, "company", config, now)

  const previousScore = company.intentScore
  const newScore = intent.score
  // Live threshold: config.enrichment.gate1Threshold when present, else the
  // pre-v3 fallback (= the old const → byte-identical on default). config is
  // the already-loaded blob (from getActiveScoringConfigWithVersion), so this
  // is the same value the rest of scoring reads — no extra accessor call, and
  // it NEVER throws on a missing block (optional key + ?? fallback).
  const threshold = config.enrichment?.gate1Threshold ?? COMPANY_ENRICH_THRESHOLD
  const crossedThreshold =
    (previousScore ?? 0) < threshold && newScore >= threshold

  // Atomic pair: last-write-wins on Company + append-only ScoreHistory audit
  // row (accountType "company" — the table was company-ready from day one:
  // untyped accountId, no FK).
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { intentScore: newScore, lastScoredAt: now },
    }),
    prisma.scoreHistory.create({
      data: {
        accountId: companyId,
        accountType: "company",
        configVersion,
        // Companies have no ICP layer — 0 by construction; priorityScore
        // mirrors the intent score (the only component at company level).
        icpScore: 0,
        intentScore: newScore,
        priorityScore: newScore,
        // NOT a P-level: companies aren't leveled. "Company" is an explicit
        // audit label that can never collide with contact-level consumers
        // (P1/P2/P3/Monitor filters skip it). ScoreHistory has zero readers
        // today (verified at build time) — this is purely forward-honest.
        priorityLevel: "Company",
        signalCount: intent.signalCount,
        painTier: null,
      },
    }),
  ])

  return {
    companyId,
    previousScore,
    newScore,
    signalCount: intent.signalCount,
    crossedThreshold,
    threshold,
  }
}
