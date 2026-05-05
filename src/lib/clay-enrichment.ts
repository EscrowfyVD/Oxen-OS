// Helpers for Clay enrichment pipeline (PRD-001 Sprint S0).
// Pure functions + DB-bound upsert helpers.
//
// Single source of truth for Clay → Oxen upsert logic. Both the HTTP
// webhook (/api/webhooks/clay-enrichment) and the CSV import endpoint
// (/api/crm/contacts/import-clay) call upsertCompanyFromClay() and
// upsertPersonFromClay() — guaranteeing identical idempotency, mapping,
// and side effects regardless of the entry path.
//
// Refs: CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 4.2, 5, 10 (D1).

import { prisma } from "@/lib/prisma"
import type { ClayEnrichmentPayload } from "@/app/api/webhooks/_schemas"

/**
 * Decision-Maker keywords (D1, Vernon 2026-05-05).
 * Lowercase substrings — first match wins.
 */
const DM_KEYWORDS = [
  "ceo",
  "founder",
  "owner",
  "managing director",
  "chief",
  "president",
  "partner",
  "director",
] as const

/**
 * Classify a job title as DM (Decision Maker) or OP (Operations).
 *
 * Returns null if jobTitle is null/undefined/empty — caller should
 * decide whether to default to OP, leave null, or trigger a manual
 * review.
 */
export function classifyPersona(
  jobTitle?: string | null,
): "DM" | "OP" | null {
  if (!jobTitle || jobTitle.trim() === "") return null
  const lowered = jobTitle.toLowerCase()
  if (DM_KEYWORDS.some((kw) => lowered.includes(kw))) return "DM"
  return "OP"
}

/**
 * Extract the segment (filter description) from a Clay table source name.
 *
 * Convention: `vDC_{group}_Tier {tier}_{scope}_{filter}`
 * Example   : `vDC_G1_Tier 1_Company_Active Business Loss`
 *           → "Active Business Loss"
 *
 * Returns null if the table name doesn't match the expected pattern,
 * or if the segment portion is empty/whitespace-only.
 */
export function extractClayTableSegment(sourceTable: string): string | null {
  const match = sourceTable.match(/_(?:Company|People)_(.+)$/)
  if (!match) return null
  const segment = match[1].trim()
  return segment.length > 0 ? segment : null
}

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
// Source-table parser (used by CSV import wizard auto-detection)
// ──────────────────────────────────────────────────────────────────────

const VALID_GROUPS = ["G1", "G2", "G3", "G4", "G5", "G6", "G7A", "G7B"] as const
const VALID_TIERS = ["T1", "T2", "T3"] as const

type Group = (typeof VALID_GROUPS)[number]
type Tier = (typeof VALID_TIERS)[number]

export interface ParsedClayTableName {
  scope: "company" | "people" | null
  group: Group | null
  painTier: Tier | null
  segment: string | null
}

/**
 * Parse a Clay source-table name into its constituent parts.
 *
 * Convention: `vDC_{group}_Tier {tierNum}_{scope}_{segment}`
 *   group   = G1..G7B
 *   tierNum = 1..3 → T1..T3
 *   scope   = "Company" | "People"
 *   segment = free-text filter description
 *
 * Returns nullable fields independently — caller decides if a partial
 * parse is acceptable (e.g. "Custom (manual entry)" UI mode where user
 * provides scope/group/tier separately).
 */
export function parseClayTableName(sourceTable: string): ParsedClayTableName {
  const result: ParsedClayTableName = {
    scope: null,
    group: null,
    painTier: null,
    segment: null,
  }

  // Group : `_{Gx}_`
  const groupMatch = sourceTable.match(/_([Gg]\d[AaBb]?)_/)
  if (groupMatch) {
    const candidate = groupMatch[1].toUpperCase() as Group
    if ((VALID_GROUPS as readonly string[]).includes(candidate)) {
      result.group = candidate
    }
  }

  // Tier : `Tier {n}` → Tn
  const tierMatch = sourceTable.match(/Tier\s+([1-3])/i)
  if (tierMatch) {
    const candidate = `T${tierMatch[1]}` as Tier
    if ((VALID_TIERS as readonly string[]).includes(candidate)) {
      result.painTier = candidate
    }
  }

  // Scope : `_{Company|People}_`
  const scopeMatch = sourceTable.match(/_(Company|People)_/i)
  if (scopeMatch) {
    result.scope =
      scopeMatch[1].toLowerCase() === "company" ? "company" : "people"
  }

  // Segment : reuse extractClayTableSegment for consistency
  result.segment = extractClayTableSegment(sourceTable)

  return result
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
