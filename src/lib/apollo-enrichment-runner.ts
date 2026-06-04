// AIRA / CRM — Apollo enrichment batch runner (Apollo PR-Z).
//
// Mirrors score-recompute-runner / refresh-meeting-briefs-runner: per-item
// try/catch (batch continues on failure), capped per run, returns a summary.
// Credit-controlled by the cap; idempotent via the enrichedAt marker (a row is
// enriched at most once — null-on-failure leaves it for the next run).
//
// Two passes:
//   1. CONTACTS  — CrmContact enrichedAt IS NULL (non-blank email), capped →
//      enrichPerson → upsertPersonFromApollo (+ the linked Company for FREE
//      from person.organization).
//   2. COMPANIES — TRULY contact-less companies (contacts: none) with
//      enrichedAt IS NULL + domain, capped → enrichOrganization →
//      upsertCompanyFromApollo. A company with ANY contact is enriched FREE via
//      that contact (now or later) → it never pays an org credit. Pass 2 runs
//      AFTER pass 1, so same-run contact-enriched companies are excluded too.
//
// No-key / no-match / 429 → the client returns null → we leave enrichedAt NULL
// and move on (no credit burned, retried next run).

import { prisma } from "@/lib/prisma"
import { enrichPerson, enrichOrganization } from "@/lib/apollo"
import { upsertPersonFromApollo, upsertCompanyFromApollo } from "./apollo-enrichment"
import { logger, serializeError } from "@/lib/logger"

const log = logger.child({ component: "apollo-enrichment-runner" })

// Per-run cap (tunable). Bounds credit spend: ≤ cap people/match calls +
// ≤ cap organizations/enrich calls per run.
export const DEFAULT_APOLLO_ENRICH_CAP = 40

export interface ApolloEnrichmentResult {
  processed: number // contacts + companies attempted
  enriched: number // hits applied (person or org)
  skipped: number // no-match / null / no-key — left for retry
  errors: Array<{ kind: "contact" | "company"; id: string; error: string }>
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

  result.durationMs = Date.now() - wallStart
  log.info(
    { processed: result.processed, enriched: result.enriched, skipped: result.skipped, errors: result.errors.length },
    "apollo enrichment batch complete",
  )
  return result
}
