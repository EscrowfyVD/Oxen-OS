// ─── Targeted per-account recompute (Apify PR3b-pipeline, decision #3) ──
//
// Recompute + persist the priority score of every scoring-eligible contact
// of ONE company. The cheap, correct alternative to the full-scan recompute
// cron when a single company's score changes — e.g. a new account-level
// Apify signal that PR2.5 reflects onto all the company's contacts.
//
// Recon (PR3b) confirmed: no per-account recompute fn existed, but
// `persistScore` IS the reusable per-contact primitive (it threads
// companyId → computeIntentScore for the PR2.5 reflection), so a per-account
// recompute is just a loop over the company's contacts. We deliberately do
// NOT run the monolithic full-scan (runScoreRecompute) per signal.
//
// Mirrors runScoreRecompute's exclusion filter (NOT excludedFrom has
// "scoring"). Per-contact error isolation. Does NOT fire BD promotion alerts
// (PR3b scope = score only; the hourly recompute cron alerts on promotion).

import { prisma } from "@/lib/prisma"
import { persistScore } from "@/lib/scoring/persist-score"
import type { ScoringConfigBlob } from "@/lib/scoring/config-types"
import { logger, serializeError } from "@/lib/logger"

const log = logger.child({ component: "recompute-company-contacts" })

export interface RecomputeCompanyResult {
  contacts: number // scoring-eligible contacts found for the company
  recomputed: number // successfully re-scored
  errors: number // per-contact failures (isolated)
}

export async function recomputeCompanyContacts(
  companyId: string,
  config: ScoringConfigBlob,
  configVersion: number,
  now: Date = new Date(),
): Promise<RecomputeCompanyResult> {
  const contacts = await prisma.crmContact.findMany({
    where: { companyId, NOT: { excludedFrom: { has: "scoring" } } },
    select: { id: true },
  })

  let recomputed = 0
  let errors = 0
  for (const c of contacts) {
    try {
      await persistScore(c.id, "contact", config, configVersion, now)
      recomputed += 1
    } catch (err) {
      errors += 1
      log.error(
        { companyId, contactId: c.id, err: serializeError(err) },
        "recompute contact failed",
      )
    }
  }
  return { contacts: contacts.length, recomputed, errors }
}
