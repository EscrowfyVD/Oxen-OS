// AIRA / CRM — Apollo enrichment batch runner (Apollo PR-Z + Apify PR3c-b slice 4).
//
// Mirrors score-recompute-runner / refresh-meeting-briefs-runner: per-item
// try/catch (batch continues on failure), capped per run, returns a summary.
// Credit-controlled by the cap; idempotent via the enrichedAt marker (a row is
// enriched at most once — null-on-failure leaves it for the next run).
//
// Three passes:
//   1. CONTACTS  — CrmContact enrichedAt IS NULL (non-blank email), capped →
//      enrichPerson → upsertPersonFromApollo (+ the linked Company for FREE
//      from person.organization).
//   2. COMPANIES — TRULY contact-less companies (contacts: none) with
//      enrichedAt IS NULL + domain, capped → enrichOrganization →
//      upsertCompanyFromApollo. A company with ANY contact is enriched FREE via
//      that contact (now or later) → it never pays an org credit. Pass 2 runs
//      AFTER pass 1, so same-run contact-enriched companies are excluded too.
//   3. SWEEP (slice 4) — the intent-triggered enrichment of captured prospects
//      (domain IS NULL, so pass-2 can't see them). DRY-RUN by default: logs what
//      it WOULD do, spends nothing, until config.enrichment.dryRun is flipped.
//
// No-key / no-match / 429 → the client returns null → we leave enrichedAt NULL
// and move on (no credit burned, retried next run).

import { prisma } from "@/lib/prisma"
import type { ApolloPerson } from "@/lib/apollo"
import {
  enrichPerson,
  enrichOrganization,
  searchOrganizations,
  searchPeople,
} from "@/lib/apollo"
import { upsertPersonFromApollo, upsertCompanyFromApollo } from "./apollo-enrichment"
import { getActiveScoringConfigWithVersion } from "@/lib/scoring/config-loader"
import { recomputeCompanyContacts } from "@/lib/scoring/recompute-company-contacts"
import type { ScoringConfigBlob } from "@/lib/scoring/config-types"
import { logger, serializeError } from "@/lib/logger"

const log = logger.child({ component: "apollo-enrichment-runner" })

// Per-run cap (tunable). Bounds credit spend: ≤ cap people/match calls +
// ≤ cap organizations/enrich calls per run; also bounds the pass-3 candidate scan.
export const DEFAULT_APOLLO_ENRICH_CAP = 40

// ─── Pass-3 sweep constants ──────────────────────────────────────────
// Apollo person_seniorities per contact level (people/search).
const DECISION_MAKER_SENIORITIES = ["owner", "founder", "c_suite", "partner", "vp", "head", "director"]
const OPERATIONAL_SENIORITIES = ["manager", "senior", "entry"]
// Dry-run per-company credit ESTIMATE = the 2 email reveals (DM + operational).
// Search + firmographic enrich cost no email credits (recon); reveals do.
const REVEALS_PER_COMPANY_ESTIMATE = 2
// Give-up after N failed attempts (Gate-1 predicate: enrichmentAttempts < 3).
const MAX_ENRICH_ATTEMPTS = 3

export interface EnrichmentSweepResult {
  dryRun: boolean
  candidates: number // eligible after Gate 1 (score + distinctSignals + null domain + attempts<3)
  capRemaining: number // baseEnrichmentCap − successes-this-month, at run start
  processed: number // companies acted on this tick (≤ capRemaining)
  enriched: number // company successes (enrichedAt set) — live only
  failed: number // domain unresolved / write error — live only
  contactsCreated: number // live only
  creditsSpent: number // ACTUAL reveal credits — live; 0 in dry-run
  wouldSpendCredits: number // ESTIMATE = processed × REVEALS_PER_COMPANY_ESTIMATE
}

export interface ApolloEnrichmentResult {
  processed: number // contacts + companies attempted (passes 1+2)
  enriched: number // hits applied (person or org) (passes 1+2)
  skipped: number // no-match / null / no-key — left for retry (passes 1+2)
  errors: Array<{ kind: "contact" | "company"; id: string; error: string }>
  sweep: EnrichmentSweepResult // pass 3
  durationMs: number
}

export async function runApolloEnrichment(
  { cap = DEFAULT_APOLLO_ENRICH_CAP }: { cap?: number } = {},
): Promise<ApolloEnrichmentResult> {
  const wallStart = Date.now()
  const result: ApolloEnrichmentResult = {
    processed: 0,
    enriched: 0,
    skipped: 0,
    errors: [],
    sweep: emptySweep(true),
    durationMs: 0,
  }

  // ── Pass 1: contacts (email is @unique, non-null → skip blanks) ──
  const contacts = await prisma.crmContact.findMany({
    where: { enrichedAt: null, email: { not: "" } },
    take: cap,
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  })
  for (const c of contacts) {
    result.processed += 1
    try {
      const person = await enrichPerson({ email: c.email })
      if (!person) {
        result.skipped += 1 // leave enrichedAt NULL → retried next run
        continue
      }
      await upsertPersonFromApollo(person, { contactId: c.id })
      result.enriched += 1
    } catch (err) {
      log.error({ kind: "contact", id: c.id, err: serializeError(err) }, "apollo enrich (contact) failed")
      result.errors.push({ kind: "contact", id: c.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // ── Pass 2: TRULY contact-less companies still unenriched ──
  // `contacts: { none: {} }` is the credit guard: a company with ANY contact is
  // enriched FOR FREE via that contact's person.organization (this run or a
  // future one), so it must NEVER cost an org/enrich credit here — this also
  // closes the beyond-cap boundary (a company whose contact is still in the
  // backlog). And because this query runs AFTER pass 1, companies enriched via a
  // contact THIS run already have enrichedAt set → excluded too. Zero double-pay.
  const companies = await prisma.company.findMany({
    where: { enrichedAt: null, domain: { not: null }, contacts: { none: {} } },
    take: cap,
    orderBy: { createdAt: "asc" },
    select: { id: true, domain: true },
  })
  for (const co of companies) {
    result.processed += 1
    if (!co.domain) {
      result.skipped += 1
      continue
    }
    try {
      const org = await enrichOrganization({ domain: co.domain })
      if (!org) {
        result.skipped += 1
        continue
      }
      await upsertCompanyFromApollo(org, { companyId: co.id })
      result.enriched += 1
    } catch (err) {
      log.error({ kind: "company", id: co.id, err: serializeError(err) }, "apollo enrich (company) failed")
      result.errors.push({ kind: "company", id: co.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // ── Pass 3: intent-triggered enrichment sweep (slice 4) ──
  // Loads the active config for the gate thresholds + the dry-run flag. A config
  // load / sweep failure must NOT break passes 1-2 (isolated).
  try {
    const { config, version } = await getActiveScoringConfigWithVersion()
    result.sweep = await runEnrichmentSweep(config, version, { cap, now: new Date() })
  } catch (err) {
    log.error({ err: serializeError(err) }, "enrichment sweep failed (passes 1-2 unaffected)")
  }

  result.durationMs = Date.now() - wallStart
  log.info(
    {
      processed: result.processed,
      enriched: result.enriched,
      skipped: result.skipped,
      errors: result.errors.length,
      sweep: result.sweep,
    },
    "apollo enrichment batch complete",
  )
  return result
}

// ─── Pass-3 sweep ────────────────────────────────────────────────────

function emptySweep(dryRun: boolean): EnrichmentSweepResult {
  return {
    dryRun,
    candidates: 0,
    capRemaining: 0,
    processed: 0,
    enriched: 0,
    failed: 0,
    contactsCreated: 0,
    creditsSpent: 0,
    wouldSpendCredits: 0,
  }
}

function apolloPersonName(p: ApolloPerson): string | null {
  const full =
    (typeof p.name === "string" && p.name.trim()) ||
    [p.first_name, p.last_name]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .join(" ")
      .trim()
  return full || null
}

function startOfMonthUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

// Failure marker — the loop-killer. Bumps enrichmentAttempts (+ attemptedAt) but
// NEVER enrichedAt (success-only). After MAX_ENRICH_ATTEMPTS the Gate-1 predicate
// (enrichmentAttempts < 3) drops the company → no infinite retry. The monthly cap
// counts successes (enrichedAt) only, so a failed attempt never eats the cap.
// Best-effort: swallows its own error so a single row can never break the batch.
// Trade-off: if this write itself persistently fails (a degenerate per-row DB
// fault), attempts won't increment and the row is re-swept — but each tick's work
// is bounded by `take: cap` and such a row burns NO credits (reveals are gated
// behind the successful company write), so the blast radius is bounded free retries.
async function safeMarkAttempt(companyId: string, now: Date): Promise<void> {
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { enrichmentAttemptedAt: now, enrichmentAttempts: { increment: 1 } },
    })
  } catch (err) {
    log.error({ companyId, err: serializeError(err) }, "enrichment sweep: failed to mark attempt")
  }
}

// The {companyId} update path in upsertCompanyFromApollo intentionally does NOT
// write `domain` (it excludes the key to avoid nulling/clobbering). Claim the
// resolved domain here, guarding the @unique constraint: if another company
// already owns it, this prospect is a DUPLICATE of that company — a dedup case
// the no-match capture (keyed on name/linkedin, not domain) could not see. Leave
// domain null in that case (enrichedAt already fire-once-guards the row) and flag
// it; the dedup/merge is deferred debt (same family as cross-source event keys).
async function claimDomainIfFree(companyId: string, domain: string): Promise<void> {
  try {
    const owner = await prisma.company.findUnique({ where: { domain }, select: { id: true } })
    if (!owner) {
      await prisma.company.update({ where: { id: companyId }, data: { domain } })
    } else if (owner.id !== companyId) {
      log.warn(
        { companyId, domain, existingCompanyId: owner.id },
        "enrichment sweep: resolved domain already owned by another company — prospect is a duplicate; leaving domain null (dedup debt, deferred)",
      )
    }
  } catch (err) {
    // Best-effort: a race (P2002 between the read and write) or transient error on
    // the domain claim must NOT abort the already-fire-once-committed enrichment or
    // lose the contact reveals. Leave domain null; enrichedAt still guards fire-once.
    log.warn({ companyId, domain, err: serializeError(err) }, "enrichment sweep: domain claim failed (best-effort) — leaving domain null")
  }
}

// One contact level: search people (titles + seniorities) → pick the best named
// person → REVEAL the email (the credit step) → create/link the contact.
// Returns whether a reveal credit was spent + whether a contact landed.
async function enrichLevelContact(
  companyId: string,
  organizationId: string,
  domain: string,
  titles: string[],
  seniorities: string[],
): Promise<{ credit: number; created: boolean }> {
  const people = await searchPeople({ organizationId, titles, seniorities })
  if (!people || people.length === 0) return { credit: 0, created: false }
  const picked = people.find((p) => apolloPersonName(p) !== null)
  const name = picked ? apolloPersonName(picked) : null
  if (!picked || !name) return { credit: 0, created: false }

  // THE credit step — unlock the personal email.
  const revealed = await enrichPerson({ name, domain }, { revealEmail: true })
  if (!revealed || !revealed.email) return { credit: 0, created: false } // no reveal → assume no charge
  // The credit is spent the moment the reveal returns an email → count it even if
  // the downstream contact write fails (spend tracking must never under-report),
  // and never let a contact-write throw abort the other level / the recompute.
  try {
    const r = await upsertPersonFromApollo(revealed, { companyId })
    return { credit: 1, created: r.ok && r.action !== "skipped" }
  } catch (err) {
    log.error({ companyId, err: serializeError(err) }, "enrichment sweep: contact upsert failed after reveal (credit already spent)")
    return { credit: 1, created: false }
  }
}

/**
 * Pass-3 — the intent-triggered enrichment sweep (Apify PR3c-b slice 4).
 *
 * GATE 1 (uses the partial index #35, config from v3): intentScore ≥
 * gate1Threshold AND distinctSignals ≥ gate1MinSignals AND enrichedAt IS NULL
 * AND domain IS NULL AND enrichmentAttempts < 3, hottest-first (intentScore DESC).
 * MONTHLY CAP: successes this month (Company.enrichedAt ≥ month-start) ≥
 * baseEnrichmentCap → enrich nothing more this tick (remainder stays null → an
 * implicit queue, re-swept next tick/month — no 'queued' column).
 *
 * DRY-RUN (default, config.enrichment.dryRun ?? true): run the gate + cap +
 * ordering and LOG per candidate what would happen — ZERO Apollo calls, ZERO
 * writes. Live: the full chain (resolve org → firmographics → 2 contact levels →
 * reveal → recompute). The flip dry-run→live is a DELIBERATE, SEPARATE config
 * edit by Vernon AFTER reading a dry-run report on real captures.
 *
 * Additive + safe: pass-2 excludes domain:null, so captured prospects are
 * invisible to it; this pass owns them.
 */
export async function runEnrichmentSweep(
  config: ScoringConfigBlob,
  configVersion: number,
  { cap = DEFAULT_APOLLO_ENRICH_CAP, now = new Date() }: { cap?: number; now?: Date } = {},
): Promise<EnrichmentSweepResult> {
  const enrichment = config.enrichment
  if (!enrichment) {
    // pre-v3 config (no enrichment block) — nothing to sweep. Safe no-op.
    log.info("enrichment sweep: no enrichment config (pre-v3) — skipping")
    return emptySweep(true)
  }
  const dryRun = enrichment.dryRun ?? true // absent → no-spend
  const result = emptySweep(dryRun)

  // ── GATE 1 candidate scan (partial-index-ordered, hottest first) ──
  const candidates = await prisma.company.findMany({
    where: {
      enrichedAt: null,
      domain: null,
      intentScore: { gte: enrichment.gate1Threshold }, // ≥ threshold implies non-null
      enrichmentAttempts: { lt: MAX_ENRICH_ATTEMPTS },
    },
    orderBy: { intentScore: "desc" },
    take: cap,
    select: { id: true, name: true, linkedinUrl: true, intentScore: true },
  })

  // distinctSignals gate — account-level signals ({companyId, contactId:null}),
  // per the brief's spec (raw row count). TODAY exact: only crunchbase-f +
  // jobboard-g route, non-overlapping event types → one row per real event.
  // Two deferred refinements (both bounded by the independent intentScore ≥
  // gate1Threshold gate, which already requires a live decayed score, and by
  // dry-run surfacing every candidate before any spend):
  //   1. cross-source dedup — when a 2nd source on the SAME event-type activates,
  //      this over-counts that event's double detections → switch to a canonical
  //      event key, not rows.
  //   2. decay-consistency — this counts ALL account signals incl. expired /
  //      uncategorized ones, looser than computeIntentScore's live-signal filter
  //      (createdAt ≥ since AND intentCategory != null AND decayed != 0); a
  //      stricter, scoring-consistent count could be adopted if over-admission
  //      shows up in the dry-run reports.
  const eligible: Array<{
    id: string
    name: string
    linkedinUrl: string | null
    intentScore: number
    distinctSignals: number
  }> = []
  for (const c of candidates) {
    const distinctSignals = await prisma.intentSignal.count({
      where: { companyId: c.id, contactId: null },
    })
    if (distinctSignals >= enrichment.gate1MinSignals) {
      eligible.push({
        id: c.id,
        name: c.name,
        linkedinUrl: c.linkedinUrl,
        intentScore: c.intentScore ?? 0,
        distinctSignals,
      })
    }
  }
  result.candidates = eligible.length

  // ── MONTHLY CAP (derived, no counter): successes this month vs baseEnrichmentCap ──
  const successesThisMonth = await prisma.company.count({
    where: { enrichedAt: { gte: startOfMonthUTC(now) } },
  })
  result.capRemaining = Math.max(0, enrichment.baseEnrichmentCap - successesThisMonth)
  // Cap breaker: process only up to capRemaining; the remainder stays
  // enrichedAt-null → an implicit queue re-swept next tick/month.
  const toProcess = eligible.slice(0, result.capRemaining)

  for (const cand of toProcess) {
    result.processed += 1

    if (dryRun) {
      result.wouldSpendCredits += REVEALS_PER_COMPANY_ESTIMATE
      log.info(
        {
          companyId: cand.id,
          name: cand.name,
          intentScore: cand.intentScore,
          distinctSignals: cand.distinctSignals,
          wouldSpendCredits: REVEALS_PER_COMPANY_ESTIMATE,
        },
        "enrichment sweep [DRY-RUN] would enrich: resolve org + firmographics + search 2 contact levels + reveal ≤2 emails",
      )
      continue
    }

    // ── LIVE — resolve the org (failure marker on no-domain) ──
    const searchOrg = await searchOrganizations({ name: cand.name, linkedinUrl: cand.linkedinUrl })
    const domain =
      searchOrg && typeof searchOrg.primary_domain === "string"
        ? searchOrg.primary_domain.toLowerCase()
        : null
    if (!searchOrg || !searchOrg.id || !domain) {
      await safeMarkAttempt(cand.id, now) // attempts++ / attemptedAt — NOT enrichedAt
      result.failed += 1
      continue
    }
    const organizationId = searchOrg.id

    // ── LIVE — firmographics + the fire-once company write ──
    // Only the enrichOrganization + upsertCompanyFromApollo write is inside this
    // try: a throw here means enrichedAt was NOT set → mark a failed attempt +
    // retry later. Everything AFTER (domain claim, contacts) is best-effort and
    // must NOT re-mark this row as failed (it already succeeded / fire-once armed).
    try {
      const org = (await enrichOrganization({ domain })) ?? searchOrg
      await upsertCompanyFromApollo(org, { companyId: cand.id }) // firmographics + enrichedAt (fire-once)
    } catch (err) {
      await safeMarkAttempt(cand.id, now)
      result.failed += 1
      log.error({ companyId: cand.id, err: serializeError(err) }, "enrichment sweep [LIVE] company write failed")
      continue
    }
    result.enriched += 1 // fire-once armed (enrichedAt committed) — the company is done
    await claimDomainIfFree(cand.id, domain) // best-effort; never throws, never re-marks failed

    // ── LIVE — 2 contact levels + recompute (best-effort; company already fire-once-safe) ──
    try {
      const dm = await enrichLevelContact(
        cand.id,
        organizationId,
        domain,
        enrichment.titles.decisionMaker,
        DECISION_MAKER_SENIORITIES,
      )
      const ops = await enrichLevelContact(
        cand.id,
        organizationId,
        domain,
        enrichment.titles.operational,
        OPERATIONAL_SENIORITIES,
      )
      result.creditsSpent += dm.credit + ops.credit
      const created = (dm.created ? 1 : 0) + (ops.created ? 1 : 0)
      result.contactsCreated += created
      // Recompute so Gate 2 (priorityScore ≥ 40 + 2 signals) is legible on the
      // new contacts (PR2.5 reflection now fires on them). Gate 2 = sequence
      // entry, a LATER concern — we just make it readable here.
      await recomputeCompanyContacts(cand.id, config, configVersion, now)
      log.info(
        { companyId: cand.id, name: cand.name, creditsSpent: dm.credit + ops.credit, contactsCreated: created },
        "enrichment sweep [LIVE] enriched company",
      )
    } catch (err) {
      log.error(
        { companyId: cand.id, err: serializeError(err) },
        "enrichment sweep [LIVE] contacts/recompute failed (company already enriched — fire-once holds)",
      )
    }
  }

  log.info({ ...result }, dryRun ? "enrichment sweep [DRY-RUN] complete" : "enrichment sweep [LIVE] complete")
  return result
}
