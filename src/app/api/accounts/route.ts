/**
 * GET /api/accounts — fuzzy account search (Sprint 3d B5).
 *
 * Used by:
 *   - Operator account-picker UIs (CRM, future Intent Feed)
 *   - Server-side callers of /api/signals when the upstream payload
 *     identifies the account by a name/email-ish string rather than
 *     an exact ID. Auth-shape mirrors /api/signals so a single Bearer
 *     token (SIGNALS_INGESTION_SECRET) works across both endpoints.
 *
 * Implementation (Recon D6, D8):
 *   - V1 = ILIKE OR across Company.name, CrmContact.email,
 *     CrmContact.firstName, CrmContact.lastName. No pg_trgm — the
 *     current ~600-contact volume doesn't warrant the extension yet.
 *   - Tiered relevance scoring in JS post-fetch:
 *       exact email or domain match  → 100
 *       exact name (case-insensitive) → 90
 *       starts-with                   → 70
 *       contains                      → 40
 *   - Response = union { kind, id, displayName, score, ... } sorted
 *     by score desc, capped at `limit` (default 10).
 *
 * Auth (fail-closed, same pattern as /api/signals):
 *   - `Authorization: Bearer <SIGNALS_INGESTION_SECRET>` for
 *     server-to-server callers, OR
 *   - Authenticated session with CRM page access (UI calls).
 *
 * The route refuses to start if SIGNALS_INGESTION_SECRET is unset.
 *
 * V2 path (deferred):
 *   - pg_trgm + GIN trigram indexes + Postgres similarity() ranking.
 *   - Multi-select kind filter (only-companies / only-contacts).
 *   - Pagination — V1 is single-shot top-N.
 */

import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateSearchParams } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import {
  accountsSearchQuery,
  accountsMatchQuery,
  type AccountSearchHit,
  type AccountMatchHit,
} from "./_schemas"
import { normalizeCompanyName, matchConfidence } from "@/lib/account-match"

// Pulled from a deeper DB sample than `limit` so tier-promoted hits
// further down the contains-list can still beat a high contains hit
// returned in the head of the SELECT.
const PER_TABLE_FETCH = 30

export async function GET(request: Request) {
  const log = childLoggerFromRequest(request).child({ route: "accounts" })

  // ── Auth (Bearer or session) ──────────────────────────────────────
  const ingestionSecret = process.env.SIGNALS_INGESTION_SECRET
  if (!ingestionSecret) {
    log.error(
      "SIGNALS_INGESTION_SECRET is not defined; refusing /api/accounts.",
    )
    return NextResponse.json(
      { error: "Signal ingestion secret not configured" },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader)
  let authedViaBearer = false
  if (bearerMatch) {
    const provided = bearerMatch[1]
    const a = Buffer.from(provided)
    const b = Buffer.from(ingestionSecret)
    if (a.length === b.length && timingSafeEqual(a, b)) {
      authedViaBearer = true
    } else {
      log.warn("invalid bearer token on /api/accounts")
      return NextResponse.json(
        { error: "Invalid bearer token" },
        { status: 401 },
      )
    }
  }

  if (!authedViaBearer) {
    const { error: sessionErr } = await requirePageAccess("crm")
    if (sessionErr) return sessionErr
  }

  const { searchParams } = new URL(request.url)

  // ── D2 mode (Apify PR2): ?name= → normalized fuzzy company match ───
  // Distinct param + shape from ?q= (the union picker) so the existing UI
  // search is untouched.
  if (searchParams.has("name")) {
    return matchAccountsByName(searchParams, log)
  }

  // ── Validate query (?q= union mode) ───────────────────────────────
  const v = validateSearchParams(searchParams, accountsSearchQuery)
  if ("error" in v) return v.error
  const { q, limit } = v.data
  const trimmed = q.trim()
  if (trimmed.length === 0) {
    return NextResponse.json({ results: [] })
  }
  const lower = trimmed.toLowerCase()

  try {
    // ── Fetch ILIKE matches across both tables ────────────────────
    const [companies, contacts] = await Promise.all([
      prisma.company.findMany({
        where: {
          name: { contains: trimmed, mode: "insensitive" },
        },
        select: { id: true, name: true, country: true },
        take: PER_TABLE_FETCH,
      }),
      prisma.crmContact.findMany({
        where: {
          OR: [
            { email: { contains: trimmed, mode: "insensitive" } },
            { firstName: { contains: trimmed, mode: "insensitive" } },
            { lastName: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          country: true,
          company: { select: { country: true } },
        },
        take: PER_TABLE_FETCH,
      }),
    ])

    // ── Tiered scoring ────────────────────────────────────────────
    const hits: AccountSearchHit[] = []

    for (const c of companies) {
      hits.push({
        kind: "company",
        id: c.id,
        displayName: c.name,
        score: scoreNameMatch(c.name, lower),
        jurisdiction: c.country,
      })
    }
    for (const p of contacts) {
      const fullName = `${p.firstName} ${p.lastName}`.trim()
      hits.push({
        kind: "contact",
        id: p.id,
        displayName: fullName || p.email,
        score: scoreContactMatch(p, lower),
        jurisdiction: p.company?.country ?? p.country ?? null,
        email: p.email,
      })
    }

    // ── Sort + cap ───────────────────────────────────────────────
    hits.sort((a, b) => b.score - a.score)
    const results = hits.slice(0, limit)

    return NextResponse.json({ results })
  } catch (err) {
    log.error({ err: serializeError(err) }, "accounts search failed")
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 },
    )
  }
}

// ─── D2 (?name=) normalized fuzzy company match (Apify PR2) ──────────

const D2_CANDIDATE_FETCH = 200

async function matchAccountsByName(
  searchParams: URLSearchParams,
  log: ReturnType<typeof childLoggerFromRequest>,
): Promise<NextResponse> {
  const v = validateSearchParams(searchParams, accountsMatchQuery)
  if ("error" in v) return v.error
  const { name, limit } = v.data

  const normInput = normalizeCompanyName(name)
  if (!normInput) return NextResponse.json({ results: [] })
  const firstToken = normInput.split(" ")[0]

  try {
    // Reuse the ILIKE pre-filter, but on the first NORMALIZED token so a messy
    // input ("Mercury, Inc.") still fetches the right rows; then normalize +
    // tier in JS (the part ILIKE-on-raw can't do).
    const candidates = await prisma.company.findMany({
      where: { name: { contains: firstToken, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        group: true,
        contacts: { select: { priorityScore: true } },
      },
      take: D2_CANDIDATE_FETCH,
    })

    const matches: AccountMatchHit[] = []
    for (const c of candidates) {
      const confidence = matchConfidence(normInput, normalizeCompanyName(c.name))
      if (confidence <= 0) continue
      // Account "hotness" = its hottest contact's priorityScore (Company has no
      // own score column; scoring is contact-level).
      const priorityScore = c.contacts.reduce<number | null>((max, ct) => {
        const ps = ct.priorityScore
        if (typeof ps !== "number") return max
        return max === null ? ps : Math.max(max, ps)
      }, null)
      matches.push({
        accountId: c.id,
        name: c.name,
        confidence,
        group: c.group ?? null,
        priorityScore,
      })
    }

    // Return EVERYTHING matched (no 0.85 hard-filter — the caller decides).
    // Sort by confidence desc, tiebreak by the account's hottest contact.
    matches.sort(
      (a, b) =>
        b.confidence - a.confidence ||
        (b.priorityScore ?? -1) - (a.priorityScore ?? -1),
    )
    return NextResponse.json({ results: matches.slice(0, limit) })
  } catch (err) {
    log.error({ err: serializeError(err) }, "accounts name-match failed")
    return NextResponse.json({ error: "Match failed" }, { status: 500 })
  }
}

// ─── Tiered scoring helpers ─────────────────────────────────────────

function scoreNameMatch(name: string, lowerQ: string): number {
  const lowerName = name.toLowerCase()
  if (lowerName === lowerQ) return 90
  if (lowerName.startsWith(lowerQ)) return 70
  if (lowerName.includes(lowerQ)) return 40
  return 0 // shouldn't happen if SQL matched, but defensive
}

function scoreContactMatch(
  p: {
    firstName: string
    lastName: string
    email: string
  },
  lowerQ: string,
): number {
  const email = p.email.toLowerCase()
  // Exact email = top tier (100). Domain match also exact-100 because
  // a recruiter searching "acme.com" wants the Acme contacts.
  if (email === lowerQ) return 100
  const atIdx = email.indexOf("@")
  if (atIdx >= 0 && email.slice(atIdx + 1) === lowerQ) return 100

  const fullName = `${p.firstName} ${p.lastName}`.trim().toLowerCase()
  if (fullName === lowerQ) return 90
  if (p.firstName.toLowerCase() === lowerQ) return 85
  if (p.lastName.toLowerCase() === lowerQ) return 85
  if (fullName.startsWith(lowerQ) || email.startsWith(lowerQ)) return 70
  if (fullName.includes(lowerQ) || email.includes(lowerQ)) return 40
  return 0
}
