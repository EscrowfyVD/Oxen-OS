// Server-only Apollo → Oxen upsert mappers (Apollo PR-Z).
//
// Reworked from clay-enrichment.ts: the upsert/transaction structure +
// assignRandomBD() are kept; only the field-mapping is swapped to the Apollo
// people/match + organizations/enrich response shapes (see src/lib/apollo.ts).
//
// Imports Prisma at top-level — DO NOT import from any "use client" component.
// Reuses the vendor-agnostic pure helpers (classifyPersona,
// extractCountryFromLocation) from their CURRENT location (clay-helpers.ts);
// the rename → enrichment-helpers.ts is PR-X's job.

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { classifyPersona, extractCountryFromLocation } from "@/lib/clay-helpers"
import type { ApolloOrg, ApolloPerson } from "@/lib/apollo"

const log = logger.child({ component: "apollo-enrichment" })

/**
 * Random 50/50 BD assignment — KEPT verbatim from clay-enrichment.ts. The v1
 * runner enriches EXISTING contacts (no create), so it does not call this, but
 * it is preserved for any future create path. Returns null if CRM_BD_EMAILS is
 * unset or no active Employee matches.
 */
export async function assignRandomBD(): Promise<string | null> {
  const emailsEnv = process.env.CRM_BD_EMAILS ?? ""
  const emails = emailsEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
  if (emails.length === 0) return null

  const bds = await prisma.employee.findMany({
    where: { email: { in: emails, mode: "insensitive" }, isActive: true },
    select: { id: true },
  })
  if (bds.length === 0) return null

  const idx = Math.floor(Math.random() * bds.length)
  return bds[idx].id
}

export type ApolloUpsertResult =
  | { ok: true; action: "created" | "updated" | "skipped"; companyId?: string | null; contactId?: string }
  | { ok: false; error: string }

function locationString(
  city?: string | null,
  state?: string | null,
  country?: string | null,
): string | null {
  const s = [city, state, country]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(", ")
  return s || null
}

function orgDomain(org: ApolloOrg): string | null {
  const d = org.primary_domain || null
  return d ? d.toLowerCase() : null
}

// Apollo org → Company writable fields (excludes the `domain` key + `name`,
// which are handled per create/update so we never null the key or the
// non-nullable name on an UPDATE).
function orgFields(org: ApolloOrg) {
  const revenue =
    org.annual_revenue_printed ??
    (typeof org.annual_revenue === "number" ? String(org.annual_revenue) : null)
  const funding =
    org.total_funding_printed ??
    (typeof org.total_funding === "number" ? String(org.total_funding) : null)
  return {
    website: org.website_url ?? null,
    industry: org.industry ?? null,
    description: org.short_description ?? null,
    employeeCount:
      typeof org.estimated_num_employees === "number" ? org.estimated_num_employees : null,
    revenueRange: revenue,
    fundingTotal: funding,
    techStack: Array.isArray(org.technology_names) ? (org.technology_names as string[]) : [],
    hqCity: org.city ?? null,
    country: org.country ?? null,
    location: locationString(org.city, org.state, org.country),
    linkedinUrl: org.linkedin_url ?? null,
    enrichmentSource: "apollo" as const,
    enrichedAt: new Date(),
    enrichmentRaw: org as unknown as Prisma.InputJsonValue,
  }
}

/**
 * Upsert a Company from an Apollo organization object.
 * - opts.companyId set (secondary company pass) → UPDATE that company by id.
 * - else key by primary_domain: existing+already-enriched → SKIP (don't clobber
 *   a fully-enriched company, just link); existing+unenriched → UPDATE; new → CREATE.
 * - no domain → skipped (cannot key).
 */
export async function upsertCompanyFromApollo(
  org: ApolloOrg,
  opts: { companyId?: string } = {},
): Promise<ApolloUpsertResult> {
  const fields = orgFields(org)

  if (opts.companyId) {
    await prisma.company.update({ where: { id: opts.companyId }, data: fields })
    return { ok: true, action: "updated", companyId: opts.companyId }
  }

  const domain = orgDomain(org)
  if (!domain) return { ok: true, action: "skipped", companyId: null }

  const existing = await prisma.company.findUnique({
    where: { domain },
    select: { id: true, enrichedAt: true },
  })
  if (existing) {
    if (existing.enrichedAt) {
      // already enriched — link only, never clobber (idempotent).
      return { ok: true, action: "skipped", companyId: existing.id }
    }
    await prisma.company.update({ where: { id: existing.id }, data: fields })
    return { ok: true, action: "updated", companyId: existing.id }
  }

  const created = await prisma.company.create({
    data: { name: org.name ?? domain, domain, ...fields },
  })
  return { ok: true, action: "created", companyId: created.id }
}

/**
 * Map/upsert a CrmContact from an Apollo person object. Two modes:
 *
 *  - `{ contactId }` (pass-1) — UPDATE that existing contact. The linked Company
 *    is derived FROM person.organization (free firmographics). dealOwner /
 *    acquisitionSource are left untouched (preserved).
 *  - `{ companyId }` (pass-3 sweep, slice 4) — CREATE-or-LINK a contact keyed by
 *    the person's REVEALED email, linked to the caller's company. Does NOT
 *    re-derive the company from person.organization (the sweep already resolved
 *    it). Requires a non-empty email (CrmContact.email is @unique + non-null) —
 *    returns { ok:false } if the reveal produced none. Upsert-by-email so a
 *    reveal that collides with an existing contact links it instead of throwing.
 */
export async function upsertPersonFromApollo(
  person: ApolloPerson,
  opts: { contactId: string } | { companyId: string },
): Promise<ApolloUpsertResult> {
  // 1) Linked company:
  //    - contactId mode: derive from person.organization (free firmographics).
  //    - companyId mode: the caller's company — do NOT re-derive (avoids
  //      creating a second company row from the person's org).
  let companyId: string | null
  if ("companyId" in opts) {
    companyId = opts.companyId
  } else {
    companyId = null
    if (person.organization) {
      const r = await upsertCompanyFromApollo(person.organization)
      if (r.ok) companyId = r.companyId ?? null
    }
  }

  // 2) Contact country: explicit → parse location → inherit from the company.
  let country =
    person.country ??
    extractCountryFromLocation(locationString(person.city, person.state, person.country)) ??
    null
  if (!country && companyId) {
    const co = await prisma.company.findUnique({
      where: { id: companyId },
      select: { country: true },
    })
    if (co?.country) {
      country = co.country
      log.info({ companyId }, "apollo: inherited contact country from company")
    }
  }

  // 3) The mapped fields (shared by both modes). companyId / firstName /
  //    lastName use `?? undefined` so we never null an existing company link or
  //    overwrite names with blanks.
  const mapped = {
    firstName: person.first_name || undefined,
    lastName: person.last_name || undefined,
    jobTitle: person.title ?? null,
    linkedinUrl: person.linkedin_url ?? null,
    city: person.city ?? null,
    country: country ?? null,
    location: locationString(person.city, person.state, person.country),
    persona: classifyPersona(person.title),
    companyId: companyId ?? undefined,
    enrichmentSource: "apollo" as const,
    enrichedAt: new Date(),
    enrichmentRaw: person as unknown as Prisma.InputJsonValue,
  }

  if ("contactId" in opts) {
    await prisma.crmContact.update({ where: { id: opts.contactId }, data: mapped })
    return { ok: true, action: "updated", contactId: opts.contactId, companyId }
  }

  // CREATE-or-LINK by revealed email (slice-4 sweep). Conservative on purpose:
  //  - match case-INSENSITIVELY: the email @unique index is case-sensitive, but
  //    existing rows may be mixed-case (e.g. the CSV import stores email verbatim),
  //    so a lowercased-only findUnique would miss them and CREATE a duplicate.
  //  - never HIJACK a contact that already belongs to a DIFFERENT company → skip.
  //  - never NULL an existing contact's populated fields → fill-only (`|| undefined`).
  const email = (person.email ?? "").trim().toLowerCase()
  if (!email) {
    return { ok: false, error: "apollo person has no revealed email — cannot create contact" }
  }
  const existing = await prisma.crmContact.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, companyId: true },
  })
  if (existing) {
    if (existing.companyId && existing.companyId !== opts.companyId) {
      // belongs to another company — do not move or overwrite it.
      return { ok: true, action: "skipped", contactId: existing.id, companyId: existing.companyId }
    }
    await prisma.crmContact.update({
      where: { id: existing.id },
      data: {
        firstName: person.first_name || undefined,
        lastName: person.last_name || undefined,
        jobTitle: person.title || undefined,
        linkedinUrl: person.linkedin_url || undefined,
        city: person.city || undefined,
        country: country || undefined,
        location: locationString(person.city, person.state, person.country) || undefined,
        persona: classifyPersona(person.title) || undefined,
        companyId: opts.companyId,
        enrichmentSource: "apollo",
        enrichedAt: new Date(),
        enrichmentRaw: person as unknown as Prisma.InputJsonValue,
      },
    })
    return { ok: true, action: "updated", contactId: existing.id, companyId: opts.companyId }
  }
  // CREATE requires the non-null keys (email + firstName + lastName) and the
  // scalar companyId FK; the rest reuse the shared `mapped` values.
  const created = await prisma.crmContact.create({
    data: {
      email,
      firstName: person.first_name ?? "",
      lastName: person.last_name ?? "",
      companyId: opts.companyId,
      jobTitle: mapped.jobTitle,
      linkedinUrl: mapped.linkedinUrl,
      city: mapped.city,
      country: mapped.country,
      location: mapped.location,
      persona: mapped.persona,
      enrichmentSource: "apollo",
      enrichedAt: mapped.enrichedAt,
      enrichmentRaw: mapped.enrichmentRaw,
    },
  })
  return { ok: true, action: "created", contactId: created.id, companyId }
}
