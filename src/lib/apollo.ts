// ─── Apollo.io enrichment client (Apollo PR-Y) ──────────────────────
//
// Pure HTTP client for Apollo enrichment. NO CRM mapping here (that is PR-Z):
// this lib calls Apollo, parses, and returns the raw Apollo object (which IS
// the future `enrichmentRaw` stash) or null. Mirrors the lemcal/lemlist client
// shape (own module, never-throw, 429-aware).
//
// Spine = the guards:
//   - skip-if-no-key : no APOLLO_API_KEY → return null WITHOUT any HTTP call
//     (zero credit burn, no crash). The key is read at call time so the guard
//     and runtime always see the current env (also makes it unit-testable).
//   - never-throw    : every path returns the object or null. no-match / 404 /
//     network error → null.
//   - 429-aware      : respect Retry-After, retry with backoff (~3 attempts),
//     then null. Proactive volume control is the batch cap in PR-Z, not here.
//
// v1 = FIRMOGRAPHIC only: we already have the email, so we explicitly avoid the
// pricier reveal/waterfall credits (reveal_personal_emails / reveal_phone_number
// false; run_waterfall_* omitted).
//
// Auth: X-Api-Key header (HTTP header names are case-insensitive, so the exact
// casing Apollo expects does not matter). Single secret APOLLO_API_KEY.

import { logger, serializeError } from "./logger"
import { normalizeCompanyName, matchConfidence } from "./account-match"

const BASE_URL = "https://api.apollo.io/api/v1"
const MAX_RETRIES = 2 // → up to 3 attempts total on 429
// Confident org-name-match cutoff for disambiguation (mirrors the routing
// matcher's 0.85). LinkedIn match is preferred; name match is the fallback.
const ORG_NAME_MATCH_THRESHOLD = 0.85

const log = logger.child({ component: "apollo" })

function apolloApiKey(): string {
  return process.env.APOLLO_API_KEY || ""
}

export function isApolloConfigured(): boolean {
  return apolloApiKey().length > 0
}

function apolloHeaders(): Record<string, string> {
  return {
    "X-Api-Key": apolloApiKey(),
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  }
}

// ─── Types — shaped from the Apollo people/match + organizations/enrich
// response objects. Loose (optional + index signature) because the object is
// also persisted verbatim as enrichmentRaw — we never want a shape drift to
// drop a field. ───────────────────────────────────────────────────────
export interface ApolloOrg {
  id?: string
  name?: string | null
  website_url?: string | null
  blog_url?: string | null
  linkedin_url?: string | null
  twitter_url?: string | null
  facebook_url?: string | null
  primary_domain?: string | null
  industry?: string | null
  keywords?: string[] | null
  estimated_num_employees?: number | null
  annual_revenue?: number | null
  annual_revenue_printed?: string | null
  total_funding?: number | null
  total_funding_printed?: string | null
  latest_funding_stage?: string | null
  founded_year?: number | null
  phone?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  short_description?: string | null
  technology_names?: string[] | null
  [key: string]: unknown
}

export interface ApolloPerson {
  id?: string
  first_name?: string | null
  last_name?: string | null
  name?: string | null
  title?: string | null
  headline?: string | null
  email?: string | null
  email_status?: string | null
  linkedin_url?: string | null
  twitter_url?: string | null
  github_url?: string | null
  facebook_url?: string | null
  photo_url?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  seniority?: string | null
  departments?: string[] | null
  subdepartments?: string[] | null
  functions?: string[] | null
  employment_history?: unknown[] | null
  organization_id?: string | null
  organization_name?: string | null
  organization?: ApolloOrg | null
  [key: string]: unknown
}

export type EnrichPersonInput = { email: string } | { name: string; domain: string }

// ─── Shared fetch: 429-aware retry, never throws; returns parsed body or null.
async function apolloFetch(
  url: string,
  init: RequestInit,
  label: string,
): Promise<Record<string, unknown> | null> {
  let attempt = 0
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await fetch(url, init)
      if (res.ok) {
        return (await res.json().catch(() => null)) as Record<string, unknown> | null
      }
      if (res.status === 429) {
        if (attempt >= MAX_RETRIES) {
          log.error({ label, attempt }, "apollo: rate-limited, retries exhausted")
          return null
        }
        const retryAfter = res.headers.get("Retry-After")
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(8000, 500 * Math.pow(2, attempt))
        await new Promise((r) => setTimeout(r, Number.isFinite(waitMs) ? waitMs : 1000))
        attempt += 1
        continue
      }
      // 404 / 422 (no-match) / any other non-2xx → null, no throw.
      log.warn({ label, status: res.status }, "apollo: non-2xx response")
      return null
    } catch (err) {
      log.error({ label, err: serializeError(err) }, "apollo: network error")
      return null
    }
  }
  return null
}

/**
 * People Enrichment — POST /people/match. Identify by email (preferred) or
 * name+domain. Firmographic only (no reveal/waterfall credits). Returns the
 * parsed person object, or null on no-match / error / no key.
 */
export async function enrichPerson(input: EnrichPersonInput): Promise<ApolloPerson | null> {
  if (!isApolloConfigured()) {
    log.warn("APOLLO_API_KEY not set — skipping enrichPerson (no credit burn)")
    return null
  }
  const body: Record<string, unknown> = {
    // explicit: avoid the pricier reveal credits (we already have the email)
    reveal_personal_emails: false,
    reveal_phone_number: false,
    // run_waterfall_* intentionally OMITTED (default off → no waterfall credits)
  }
  if ("email" in input) {
    body.email = input.email
  } else {
    body.name = input.name
    body.domain = input.domain
  }

  const data = await apolloFetch(
    `${BASE_URL}/people/match`,
    { method: "POST", headers: apolloHeaders(), body: JSON.stringify(body) },
    "people/match",
  )
  const person = data?.person
  return person && typeof person === "object" ? (person as ApolloPerson) : null
}

/**
 * Organization Enrichment — GET /organizations/enrich?domain=. Firmographic.
 * Returns the parsed organization object, or null on no-match / error / no key.
 */
export async function enrichOrganization(input: { domain: string }): Promise<ApolloOrg | null> {
  if (!isApolloConfigured()) {
    log.warn("APOLLO_API_KEY not set — skipping enrichOrganization (no credit burn)")
    return null
  }
  const url = new URL(`${BASE_URL}/organizations/enrich`)
  url.searchParams.set("domain", input.domain)

  const data = await apolloFetch(
    url.toString(),
    { method: "GET", headers: apolloHeaders() },
    "organizations/enrich",
  )
  const org = data?.organization
  return org && typeof org === "object" ? (org as ApolloOrg) : null
}

// ─── Search (Apify PR3c-b slice 3) ──────────────────────────────────
// The search endpoints return the same loose org/person shape as enrich, so
// slice 4 gets typed inputs without new interfaces.
export type ApolloOrgSearchResult = ApolloOrg
export type ApolloPersonSearchResult = ApolloPerson

// Strip scheme / www / trailing slash for URL identity comparison.
function canonicalUrl(url: string): string {
  return url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "")
}

/**
 * Organization Search — POST /mixed_companies/search (q_organization_name).
 * Resolves a scraped company (name [+ the LinkedIn URL captured in PR3c-a], NO
 * domain) to an Apollo org carrying primary_domain + firmographics, so slice 4
 * can then enrichOrganization({domain}).
 *
 * Disambiguation: prefer the candidate whose linkedin_url matches ours — the
 * confident match; else the best normalized-name match at ≥ 0.85. Returns the
 * matched org (whatever fields Apollo gave — the CALLER checks primary_domain)
 * or null (no confident match / error / bad body).
 *
 * Does NOT consume email credits (search is rate-limited only; the credit step
 * is the people/match reveal in slice 4). Guards mirror the rest of the client:
 * skip-no-key → null (no HTTP), never-throw, 429-aware.
 */
export async function searchOrganizations(input: {
  name: string
  linkedinUrl?: string | null
}): Promise<ApolloOrgSearchResult | null> {
  if (!isApolloConfigured()) {
    log.warn("APOLLO_API_KEY not set — skipping searchOrganizations (no HTTP)")
    return null
  }
  const data = await apolloFetch(
    `${BASE_URL}/mixed_companies/search`,
    {
      method: "POST",
      headers: apolloHeaders(),
      body: JSON.stringify({ q_organization_name: input.name, page: 1, per_page: 10 }),
    },
    "mixed_companies/search",
  )
  if (!data) return null // error / 429-exhausted / non-2xx
  const orgs = data.organizations
  if (!Array.isArray(orgs)) return null // bad body
  const candidates = orgs.filter((o): o is ApolloOrg => o != null && typeof o === "object")
  if (candidates.length === 0) return null

  // 1. LinkedIn disambiguation — the confident match.
  if (input.linkedinUrl) {
    const target = canonicalUrl(input.linkedinUrl)
    const byLinkedin = candidates.find(
      (o) => typeof o.linkedin_url === "string" && canonicalUrl(o.linkedin_url) === target,
    )
    if (byLinkedin) return byLinkedin
  }

  // 2. Normalized-name best match (≥ threshold).
  const normTarget = normalizeCompanyName(input.name)
  if (!normTarget) return null
  let best: { org: ApolloOrg; conf: number } | null = null
  for (const o of candidates) {
    if (typeof o.name !== "string") continue
    const conf = matchConfidence(normTarget, normalizeCompanyName(o.name))
    if (conf <= 0) continue
    if (!best || conf > best.conf) best = { org: o, conf }
  }
  return best && best.conf >= ORG_NAME_MATCH_THRESHOLD ? best.org : null
}

/**
 * People Search — POST /mixed_people/search (organization_ids + person_titles +
 * person_seniorities). Level-agnostic: slice 4 calls it TWICE (decision-maker
 * titles/seniorities, then operational). Returns the people list WITHOUT
 * unlocked email (email is a separate people/match reveal — the credit step,
 * done in slice 4, not here) so slice 4 can pick + reveal.
 *
 * Empty result → [] (a valid "no people matched"); null → error / bad body.
 * Guards mirror the rest of the client (skip-no-key → null, never-throw, 429).
 */
export async function searchPeople(input: {
  organizationId: string
  titles: string[]
  seniorities: string[]
}): Promise<ApolloPersonSearchResult[] | null> {
  if (!isApolloConfigured()) {
    log.warn("APOLLO_API_KEY not set — skipping searchPeople (no HTTP)")
    return null
  }
  const data = await apolloFetch(
    `${BASE_URL}/mixed_people/search`,
    {
      method: "POST",
      headers: apolloHeaders(),
      body: JSON.stringify({
        organization_ids: [input.organizationId],
        person_titles: input.titles,
        person_seniorities: input.seniorities,
        page: 1,
        per_page: 25,
      }),
    },
    "mixed_people/search",
  )
  if (!data) return null // error / 429-exhausted / non-2xx
  const people = data.people
  if (!Array.isArray(people)) return null // bad body (a 2xx with no people[] key)
  return people.filter((p): p is ApolloPerson => p != null && typeof p === "object")
}
