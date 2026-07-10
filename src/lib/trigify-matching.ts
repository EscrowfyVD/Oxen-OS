// Contact matching helper for the Trigify webhook (Sprint Trigify Phase 2A).
//
// Trigify "Get Post Likes LinkedIn" action returns a liker's
// fullName, profileUrl, and headline — but NOT their email. So
// matching a liker to an existing CrmContact prioritizes LinkedIn
// URL, with email/name+company fallbacks for legacy Sprint S1
// payloads and curl tests.
//
// On a complete miss, the helper auto-creates a CrmContact (and a
// Company if a company name was supplied) with `lifecycleStage =
// "intent_sourced"` so the slice is visible in the CRM as a
// Trigify-sourced lead from day one.

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { TrigifyWebhookPayload } from "@/app/api/webhooks/_schemas"

export type TrigifyMatchMethod =
  | "linkedin_url"
  | "email"
  | "name_company"
  | "auto_created"
  | "no_match"

export interface TrigifyMatchedContact {
  id: string
  email: string
  firstName: string
  lastName: string
  linkedinUrl: string | null
  companyId: string | null
}

export interface TrigifyMatchResult {
  contact: TrigifyMatchedContact | null
  matchMethod: TrigifyMatchMethod
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

const CONTACT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  linkedinUrl: true,
  companyId: true,
} as const

/**
 * Split a full name into firstName/lastName halves. Handles single-word
 * names ("Madonna") by leaving lastName empty.
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: "", lastName: "" }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

/**
 * Extract a slug from a LinkedIn URL — the last non-empty path segment
 * before any query string. Used to synthesize a placeholder email when
 * Trigify auto-creates a contact (CrmContact.email is NOT NULL UNIQUE,
 * so we need a deterministic placeholder).
 *
 * Examples:
 *   https://www.linkedin.com/in/jdoe-123/        → "jdoe-123"
 *   https://www.linkedin.com/in/jdoe-123         → "jdoe-123"
 *   https://www.linkedin.com/in/jdoe-123?utm=x   → "jdoe-123"
 */
function extractLinkedinSlug(url: string): string | null {
  try {
    const u = new URL(url)
    const segments = u.pathname.split("/").filter(Boolean)
    if (segments.length === 0) return null
    return segments[segments.length - 1].toLowerCase()
  } catch {
    return null
  }
}

/**
 * Build a stable placeholder email for an auto-created Trigify contact.
 * Deterministic from linkedinUrl when available so re-runs hit the same
 * email (and therefore the `email` unique index protects against double-
 * create races even if matching fails to find the linkedinUrl row).
 */
function synthesizePlaceholderEmail(payload: TrigifyWebhookPayload): string {
  if (payload.person_linkedin_url) {
    const slug = extractLinkedinSlug(payload.person_linkedin_url)
    if (slug) return `${slug}@trigify.placeholder`
  }
  // Fallback — non-deterministic but extremely unlikely to be hit in
  // practice (matching auto-creates only when no contact found AND no
  // linkedinUrl OR an unparseable one). Includes a random suffix to
  // avoid collision when multiple unparseable URLs arrive in parallel.
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `trigify-${stamp}-${rand}@trigify.placeholder`
}

/**
 * Find-or-create a Company row by name (case-insensitive). Trigify
 * does not provide a domain in the liker payload so we cannot use the
 * canonical domain-based upsert from clay-enrichment — accept the risk
 * of occasional name-cased duplicates (manual cleanup later).
 *
 * EXPORTED since Apify PR3c-a (was module-private): the Apify no-match
 * capture reuses it via matchOrCreateCompanyByName (apify-account-match.ts),
 * which adds a FUZZY dedup guard in front of this exact-match one. Returns
 * `{ id, created }` so callers can count real creates; `extraCreate` fields
 * are applied on CREATE only (an existing row is never touched).
 */
export interface FindOrCreateCompanyResult {
  id: string
  created: boolean
}

export async function findOrCreateCompanyByName(
  name: string,
  linkedinUrl?: string | null,
  extraCreate?: { location?: string | null; acquisitionSource?: string | null },
): Promise<FindOrCreateCompanyResult | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const existing = await prisma.company.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) return { id: existing.id, created: false }

  try {
    const created = await prisma.company.create({
      data: {
        name: trimmed,
        linkedinUrl: linkedinUrl ?? null,
        ...(extraCreate?.location ? { location: extraCreate.location } : {}),
        // acquisitionSource is set ONLY here (on CREATE) — the existing/raced
        // paths above return created:false and never touch an existing source.
        ...(extraCreate?.acquisitionSource ? { acquisitionSource: extraCreate.acquisitionSource } : {}),
      },
      select: { id: true },
    })
    return { id: created.id, created: true }
  } catch (err) {
    // Race: another concurrent webhook may have created the same name.
    // Re-fetch and return whatever exists now.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const racedExisting = await prisma.company.findFirst({
        where: { name: { equals: trimmed, mode: "insensitive" } },
        select: { id: true },
      })
      if (racedExisting) return { id: racedExisting.id, created: false }
    }
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve a Trigify payload to a CrmContact, creating one (and a
 * Company) when nothing matches.
 *
 * Match order:
 *   1. person_linkedin_url   → CrmContact.linkedinUrl (case-insensitive)
 *   2. email                 → CrmContact.email       (case-insensitive)
 *   3. person_name + company → firstName + lastName + company.name fuzzy
 *   4. auto-create
 *   5. no_match (when payload has no usable identifier — caller no-ops)
 */
export async function matchContact(
  payload: TrigifyWebhookPayload,
): Promise<TrigifyMatchResult> {
  // ── Step 1: LinkedIn URL (primary key for Phase 2A) ──
  if (payload.person_linkedin_url) {
    const byLinkedin = await prisma.crmContact.findFirst({
      where: {
        linkedinUrl: {
          equals: payload.person_linkedin_url,
          mode: "insensitive",
        },
      },
      select: CONTACT_SELECT,
    })
    if (byLinkedin) return { contact: byLinkedin, matchMethod: "linkedin_url" }
  }

  // ── Step 2: Email fallback (legacy Sprint S1 + curl tests) ──
  if (payload.email) {
    const byEmail = await prisma.crmContact.findFirst({
      where: { email: { equals: payload.email, mode: "insensitive" } },
      select: CONTACT_SELECT,
    })
    if (byEmail) return { contact: byEmail, matchMethod: "email" }
  }

  // ── Step 3: name + company fuzzy ──
  const nameSource = payload.person_name ?? payload.name ?? null
  const companySource = payload.company_name ?? payload.company ?? null
  if (nameSource) {
    const { firstName, lastName } = splitName(nameSource)
    if (firstName && lastName) {
      const where: Prisma.CrmContactWhereInput = {
        firstName: { contains: firstName, mode: "insensitive" },
        lastName: { contains: lastName, mode: "insensitive" },
      }
      if (companySource) {
        where.company = {
          name: { contains: companySource.trim(), mode: "insensitive" },
        }
      }
      const byNameCompany = await prisma.crmContact.findFirst({
        where,
        select: CONTACT_SELECT,
      })
      if (byNameCompany) {
        return { contact: byNameCompany, matchMethod: "name_company" }
      }
    }
  }

  // ── Step 4: auto-create ──
  // Require at least ONE usable identifier to avoid creating ghost
  // contacts on garbage payloads.
  if (!payload.person_linkedin_url && !payload.email && !nameSource) {
    return { contact: null, matchMethod: "no_match" }
  }

  const { firstName, lastName } = nameSource
    ? splitName(nameSource)
    : { firstName: "Unknown", lastName: "Trigify" }

  let companyId: string | null = null
  if (companySource) {
    const company = await findOrCreateCompanyByName(
      companySource,
      payload.company_linkedin_url ?? null,
    )
    companyId = company?.id ?? null
  }

  const email = payload.email ?? synthesizePlaceholderEmail(payload)

  // Defensive: if the synthesized email already exists (would happen
  // if linkedinUrl was case-different from a previously-stored row),
  // return that existing contact rather than crashing on the unique
  // constraint.
  try {
    const created = await prisma.crmContact.create({
      data: {
        firstName: firstName || "Unknown",
        lastName: lastName || "",
        email,
        linkedinUrl: payload.person_linkedin_url ?? null,
        jobTitle: payload.person_title ?? payload.title ?? null,
        companyId,
        acquisitionSource: "Other",
        acquisitionSourceDetail: "Trigify",
        lifecycleStage: "intent_sourced",
        createdBy: "webhook:trigify",
      },
      select: CONTACT_SELECT,
    })
    return { contact: created, matchMethod: "auto_created" }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const racedExisting = await prisma.crmContact.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: CONTACT_SELECT,
      })
      if (racedExisting) {
        return { contact: racedExisting, matchMethod: "email" }
      }
    }
    throw err
  }
}
