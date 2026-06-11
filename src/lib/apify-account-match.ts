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

// Mirror D2_CANDIDATE_FETCH in the route. ILIKE on an un-indexed name at
// ~600-company volume is fine (route docstring).
const CANDIDATE_FETCH = 200

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
