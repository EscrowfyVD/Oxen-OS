import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWebhookSecret } from "@/lib/webhook-auth"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import {
  classifyPersona,
  extractClayTableSegment,
  assignRandomBD,
} from "@/lib/clay-enrichment"
import {
  clayEnrichmentSchema,
  type ClayEnrichmentPayload,
} from "../_schemas"

/**
 * Clay enrichment webhook (PRD-001 scoring engine, Sprint S0).
 *
 * Receives unified Clay payloads (Company OR People) and upserts the
 * corresponding Oxen records. Idempotent on Company.domain + CrmContact.email.
 *
 * MAPPING NOTES (intentional):
 * - Clay payload uses `primaryIndustry`, Oxen schema uses `industry`
 *   (semantically identical, kept for backward compat with AI prompts —
 *   11 consumer files would need to be migrated otherwise; cf. Sprint S0
 *   decision C1 by Vernon).
 * - Clay payload uses `country` (already aligned with renamed schema field
 *   post-Sprint S0 batch 1; cf. decision C3).
 *
 * Refs: CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 4.1, 4.2.
 */
export async function POST(request: Request) {
  const authFail = requireWebhookSecret(request, {
    envVarName: "CLAY_WEBHOOK_SECRET",
  })
  if (authFail) return authFail

  const v = await validateBody(request, clayEnrichmentSchema, {
    publicErrors: false,
  })
  if ("error" in v) return v.error

  const log = childLoggerFromRequest(request).child({
    webhook: "clay-enrichment",
    scope: v.data.scope,
    group: v.data.group,
    painTier: v.data.pain_tier,
  })

  try {
    if (v.data.scope === "company") {
      return await upsertCompany(v.data)
    }
    return await handlePeopleEnrichment(v.data)
  } catch (err) {
    // pino logger is Sentry-wired (Sprint 2.4b PII-safe filter);
    // serializeError extracts safe fields for structured logs.
    log.error({ err: serializeError(err) }, "clay-enrichment failed")
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "internal error",
      },
      { status: 500 },
    )
  }
}

/**
 * scope="company" — upsert a Company row keyed by domain (lowercase).
 *
 * Fields populated:
 * - name, description, industry (mapped from primaryIndustry), companySize,
 *   companyType, location, country, domain, linkedinUrl, clayTableSegment,
 *   group, painTier, enrichmentSource="clay", enrichedAt=now
 */
async function upsertCompany(data: ClayEnrichmentPayload) {
  // refine guarantees company is present when scope==="company"
  const c = data.company!
  const segment = extractClayTableSegment(data.source_table)
  const domain = c.domain.toLowerCase()

  const fields = {
    name: c.name,
    description: c.description ?? null,
    // ⚠️ Clay payload uses `primaryIndustry`, Oxen schema uses `industry`
    // (intentional mapping — see file header).
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
    return NextResponse.json({
      success: true,
      action: "updated",
      companyId: existing.id,
    })
  }

  const created = await prisma.company.create({ data: fields })
  return NextResponse.json({
    success: true,
    action: "created",
    companyId: created.id,
  })
}

/**
 * scope="people" — upsert Company (if domain provided) + upsert CrmContact
 * keyed by email (lowercase).
 *
 * Step 1: minimal Company upsert (Clay = source of vérité on
 *         group/painTier/clayTableSegment, but does NOT overwrite the full
 *         Company record — that's done in scope="company" payloads).
 * Step 2: CrmContact upsert by email. Existing contacts: PRESERVE existing
 *         dealOwner. New contacts: assignRandomBD() (50/50 Andy/Paul Louis).
 *         Persona auto-classified via classifyPersona(jobTitle).
 */
async function handlePeopleEnrichment(data: ClayEnrichmentPayload) {
  // refine guarantees person is present when scope==="people"
  const p = data.person!
  const segment = extractClayTableSegment(data.source_table)
  const email = p.email.toLowerCase()

  // ─── Step 1: upsert Company (if domain provided) ───────────────────
  let companyId: string | null = null
  if (p.company?.domain) {
    const companyDomain = p.company.domain.toLowerCase()
    const existingCompany = await prisma.company.findUnique({
      where: { domain: companyDomain },
      select: { id: true },
    })

    if (existingCompany) {
      // Clay = source of vérité on these 4 fields only — don't overwrite
      // a fully-enriched Company with a minimal People-side payload.
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

  // ─── Step 2: upsert CrmContact by email ─────────────────────────────
  const persona = classifyPersona(p.jobTitle)

  const personFieldsCommon = {
    firstName: p.firstName ?? null,
    lastName: p.lastName ?? null,
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
    // PRESERVE existing.dealOwner — Clay re-enrichment must not reassign.
    await prisma.crmContact.update({
      where: { id: existing.id },
      data: {
        ...personFieldsCommon,
        // CrmContact has firstName/lastName as required (non-nullable
        // String) — only overwrite if Clay sent a non-null value.
        firstName: p.firstName ?? undefined,
        lastName: p.lastName ?? undefined,
      },
    })
    return NextResponse.json({
      success: true,
      action: "updated",
      contactId: existing.id,
      companyId,
    })
  }

  // New contact: assign random BD (Andy or Paul Louis, 50/50).
  // Returns null if env unset or BD lookup fails — leave dealOwner
  // unassigned in that case (admin can triage later).
  const randomBdId = await assignRandomBD()
  // CrmContact.dealOwner is a String name (cf. PRD-001 dette technique:
  // not yet refactored to FK). Resolve BD ID → name via Employee lookup
  // for forward compat with future FK refactor.
  let dealOwnerName: string | null = null
  if (randomBdId) {
    const bd = await prisma.employee.findUnique({
      where: { id: randomBdId },
      select: { name: true },
    })
    dealOwnerName = bd?.name ?? null
  }

  // CrmContact requires firstName + lastName as String (non-nullable).
  // Fallback to empty string when Clay omits them — caller should ensure
  // these are populated before downstream sequence routing.
  const created = await prisma.crmContact.create({
    data: {
      ...personFieldsCommon,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      email,
      dealOwner: dealOwnerName,
    },
  })

  return NextResponse.json({
    success: true,
    action: "created",
    contactId: created.id,
    companyId,
  })
}
