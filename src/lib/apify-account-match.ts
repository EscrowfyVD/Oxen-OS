// ─── Server-side fuzzy company matcher (Apify PR3b-pipeline) ────────
//
// The D2 match logic currently lives INLINE inside the HTTP route
// (matchAccountsByName in src/app/api/accounts/route.ts) and isn't callable
// from a server worker. This is the server-side twin: same helpers
// (normalizeCompanyName + matchConfidence) and the same candidate query
// (ILIKE on the first normalized token), but it returns the single BEST
// match and lets the caller apply the >=0.85 cutoff (the route's documented
// contract — the route returns all matches, the caller thresholds).
//
// NOT a refactor of the route — additive. The route can adopt this later.

import { prisma } from "@/lib/prisma"
import { normalizeCompanyName, matchConfidence } from "@/lib/account-match"
import { findOrCreateCompanyByName } from "@/lib/trigify-matching"

// Mirror D2_CANDIDATE_FETCH in the route. ILIKE on an un-indexed name at
// ~600-company volume is fine (route docstring).
const CANDIDATE_FETCH = 200

// The documented caller-side cutoff (the D2 route returns ALL matches and the
// caller thresholds). Single source of truth — the ingestion runner imports it.
export const MATCH_THRESHOLD = 0.85

export interface CompanyMatch {
  companyId: string
  name: string
  confidence: number
}

/**
 * Best fuzzy match for a scraped company name, or null if nothing scores
 * above 0. The caller applies the >=0.85 cutoff (matchCompanyByName returns
 * the raw best so a caller can log near-misses).
 */
export async function matchCompanyByName(rawName: string): Promise<CompanyMatch | null> {
  const normInput = normalizeCompanyName(rawName)
  if (!normInput) return null // empty / legal-suffix-only → unmatchable

  const firstToken = normInput.split(" ")[0]
  if (!firstToken) return null

  const candidates = await prisma.company.findMany({
    where: { name: { contains: firstToken, mode: "insensitive" } },
    select: { id: true, name: true },
    take: CANDIDATE_FETCH,
  })

  let best: CompanyMatch | null = null
  for (const c of candidates) {
    const confidence = matchConfidence(normInput, normalizeCompanyName(c.name))
    if (confidence <= 0) continue
    if (!best || confidence > best.confidence) {
      best = { companyId: c.id, name: c.name, confidence }
    }
  }
  return best
}

export interface CompanyCapture {
  companyId: string
  created: boolean // true = a new Company row was created (vs attached to an existing one)
  confidence: number | null // best fuzzy confidence seen (null = no candidate at all)
}

/**
 * PR3c-a no-match capture: fuzzy-guarded find-or-create.
 *
 * Order matters — the FUZZY guard runs BEFORE the exact-match create so
 * "Wirex" never duplicates an existing "Wirex Limited" (legal suffixes are
 * stripped by normalizeCompanyName; exact create alone would miss that):
 *   1. unmatchable name (normalizes to "" — e.g. suffix-only) → null. Never
 *      create junk accounts.
 *   2. fuzzy match >= MATCH_THRESHOLD → attach to THAT account (created:false).
 *      In the runner flow this only fires on races (the routing already
 *      matched below threshold), but it makes the helper safe standalone.
 *   3. else findOrCreateCompanyByName (exact-match + create, P2002
 *      race-safe — reused from trigify-matching).
 *
 * NO Apollo call anywhere on this path — enrichment is PR3c-b.
 */
export async function matchOrCreateCompanyByName(
  rawName: string,
  opts: { linkedinUrl?: string | null; location?: string | null; acquisitionSource?: string | null } = {},
): Promise<CompanyCapture | null> {
  if (!normalizeCompanyName(rawName)) return null

  const match = await matchCompanyByName(rawName)
  if (match && match.confidence >= MATCH_THRESHOLD) {
    // fuzzy-attach to an existing account — never touch its acquisitionSource.
    return { companyId: match.companyId, created: false, confidence: match.confidence }
  }

  const company = await findOrCreateCompanyByName(rawName, opts.linkedinUrl ?? null, {
    location: opts.location ?? null,
    acquisitionSource: opts.acquisitionSource ?? null,
  })
  if (!company) return null
  return { companyId: company.id, created: company.created, confidence: match?.confidence ?? null }
}
