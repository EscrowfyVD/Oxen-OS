// Server-only Clay enrichment logic for PRD-001 Sprint S0.
//
// This module imports Prisma at top-level — DO NOT import it from any
// "use client" component. For client-safe pure helpers (classifyPersona,
// extractClayTableSegment, parseClayTableName), import from
// `@/lib/clay-helpers` instead.
//
// Single source of truth for Clay → Oxen upsert logic. Both the HTTP
// webhook (/api/webhooks/clay-enrichment) and the CSV import endpoint
// (/api/crm/contacts/import-clay) call upsertCompanyFromClay() and
// upsertPersonFromClay() — guaranteeing identical idempotency, mapping,
// and side effects regardless of the entry path.
//
// Refs: CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 4.2, 5, 10 (D1).

import { prisma } from "@/lib/prisma"
import {
  classifyPersona,
  extractClayTableSegment,
} from "@/lib/clay-helpers"
import type { ClayEnrichmentPayload } from "@/app/api/webhooks/_schemas"

// Re-export client-safe helpers for back-compat with existing server-side
// imports from this module (`@/app/api/webhooks/clay-enrichment/route.ts`,
// `@/app/api/crm/contacts/import-clay/route.ts`, etc.). Test files also
// continue importing parseClayTableName from here via the re-export.
export {
  classifyPersona,
  extractClayTableSegment,
  parseClayTableName,
} from "@/lib/clay-helpers"
export type { ParsedClayTableName } from "@/lib/clay-helpers"

/**
 * Random 50/50 BD assignment for new contacts created via Clay enrichment.
 *
 * Reads the comma-separated list of BD emails from `CRM_BD_EMAILS` env
 * var (e.g. "andy@oxen.finance,paullouis@oxen.finance"), looks up active
 * Employee records matching those emails, and returns one ID at random
 * (uniform distribution across N matched BDs — 50/50 if exactly 2).
 *
 * Returns null if:
 * - env var is unset or empty
 * - no matching active Employee found
 *
 * Caller should NOT fail the import on null return — leave dealOwnerId
 * unassigned and surface in admin UI for manual triage.
 */
export async function assignRandomBD(): Promise<string | null> {
  const emailsEnv = process.env.CRM_BD_EMAILS ?? ""
  const emails = emailsEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
  if (emails.length === 0) return null

  const bds = await prisma.employee.findMany({
    where: {
      email: { in: emails, mode: "insensitive" },
      isActive: true,
    },
    select: { id: true },
  })

  if (bds.length === 0) return null

  const idx = Math.floor(Math.random() * bds.length)
  return bds[idx].id
}

// ──────────────────────────────────────────────────────────────────────
// Upsert helpers — single source of truth for Clay → Oxen writes
// (consumed by both /api/webhooks/clay-enrichment and the CSV import).
// ──────────────────────────────────────────────────────────────────────

export type ClayUpsertResult =
  | {
      ok: true
      action: "created" | "updated"
      companyId?: string | null
      contactId?: string
    }
  | { ok: false; error: string }

/**
 * scope="company" — upsert a Company row keyed by domain (lowercase).
 *
 * MAPPING NOTE: Clay payload uses `primaryIndustry`, Oxen schema uses
 * `industry` (decision C1 — Sprint S0 batch 1). Mapping is intentional.
 */
export async function upsertCompanyFromClay(
  data: ClayEnrichmentPayload,
): Promise<ClayUpsertResult> {
  if (data.scope !== "company" || !data.company) {
    return { ok: false, error: "Invalid scope or missing company payload" }
  }
  const c = data.company
  const segment = extractClayTableSegment(data.source_table)
  const domain = c.domain.toLowerCase()

  const fields = {
    name: c.name,
    description: c.description ?? null,
    industry: c.primaryIndustry ?? null,
    companySize: c.size ?? null,
    companyType: c.type ?? null,
    location: c.location ?? null,
    country: c.country ?? null,
    domain,
    linkedinUrl: c.linkedinUrl ?? null,
    clayTableSegment: segment,
    group: data.group,
    painTier: data.pain_tier,
    enrichmentSource: "clay" as const,
    enrichedAt: new Date(),
  }

  const existing = await prisma.company.findUnique({
    where: { domain },
    select: { id: true },
  })

  if (existing) {
    await prisma.company.update({
      where: { id: existing.id },
      data: fields,
    })
    return { ok: true, action: "updated", companyId: existing.id }
  }

  const created = await prisma.company.create({ data: fields })
  return { ok: true, action: "created", companyId: created.id }
}

/**
 * scope="people" — upsert Company (if domain) + upsert CrmContact by email.
 *
 * - Existing Company: only group/painTier/clayTableSegment/enrichedAt
 *   are updated (Clay people payload is minimal — don't overwrite a
 *   fully-enriched Company record).
 * - Existing Contact: PRESERVE existing dealOwner (re-enrichment must
 *   NOT reassign).
 * - New Contact: dealOwner = await assignRandomBD() → Employee.name,
 *   persona = classifyPersona(jobTitle).
 */
export async function upsertPersonFromClay(
  data: ClayEnrichmentPayload,
): Promise<ClayUpsertResult> {
  if (data.scope !== "people" || !data.person) {
    return { ok: false, error: "Invalid scope or missing person payload" }
  }
  const p = data.person
  const segment = extractClayTableSegment(data.source_table)
  const email = p.email.toLowerCase()

  // Step 1: upsert Company if domain provided
  let companyId: string | null = null
  if (p.company?.domain) {
    const companyDomain = p.company.domain.toLowerCase()
    const existingCompany = await prisma.company.findUnique({
      where: { domain: companyDomain },
      select: { id: true },
    })

    if (existingCompany) {
      await prisma.company.update({
        where: { id: existingCompany.id },
        data: {
          group: data.group,
          painTier: data.pain_tier,
          clayTableSegment: segment,
          enrichedAt: new Date(),
        },
      })
      companyId = existingCompany.id
    } else {
      const newCompany = await prisma.company.create({
        data: {
          name: p.company.name ?? p.company.domain,
          domain: companyDomain,
          linkedinUrl: p.company.linkedinUrl ?? null,
          group: data.group,
          painTier: data.pain_tier,
          clayTableSegment: segment,
          enrichmentSource: "clay" as const,
          enrichedAt: new Date(),
        },
      })
      companyId = newCompany.id
    }
  }

  // Step 2: upsert CrmContact
  const persona = classifyPersona(p.jobTitle)

  const personFieldsCommon = {
    jobTitle: p.jobTitle ?? null,
    linkedinUrl: p.linkedinUrl ?? null,
    location: p.location ?? null,
    country: p.country ?? null,
    companyId,
    group: data.group,
    painTier: data.pain_tier,
    persona,
    enrichmentSource: "clay" as const,
    enrichedAt: new Date(),
  }

  const existing = await prisma.crmContact.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, dealOwner: true },
  })

  if (existing) {
    // PRESERVE existing.dealOwner (intentional — re-enrichment must
    // not reassign). firstName/lastName only updated if Clay sent
    // non-null values (they are required non-nullable on CrmContact).
    await prisma.crmContact.update({
      where: { id: existing.id },
      data: {
        ...personFieldsCommon,
        firstName: p.firstName ?? undefined,
        lastName: p.lastName ?? undefined,
      },
    })
    return {
      ok: true,
      action: "updated",
      contactId: existing.id,
      companyId,
    }
  }

  // New contact: random BD assignment.
  const randomBdId = await assignRandomBD()
  let dealOwnerName: string | null = null
  if (randomBdId) {
    const bd = await prisma.employee.findUnique({
      where: { id: randomBdId },
      select: { name: true },
    })
    dealOwnerName = bd?.name ?? null
  }

  const created = await prisma.crmContact.create({
    data: {
      ...personFieldsCommon,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      email,
      dealOwner: dealOwnerName,
    },
  })

  return {
    ok: true,
    action: "created",
    contactId: created.id,
    companyId,
  }
}
