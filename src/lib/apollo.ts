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

const BASE_URL = "https://api.apollo.io/api/v1"
const MAX_RETRIES = 2 // → up to 3 attempts total on 429

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
