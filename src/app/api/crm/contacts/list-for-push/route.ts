import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateSearchParams } from "@/lib/validate"
import { listContactsForPushQuery } from "../../_schemas"

/**
 * GET /api/crm/contacts/list-for-push (Sprint S0.6 Lemlist hardening).
 *
 * Returns ALL CrmContact rows matching the filter set (no pagination),
 * up to a hard cap of 5000. Drives the "Push to Lemlist (all)" flow
 * in PushToLemlistModal — replaces the previous footgun where the
 * modal pushed only the 50-row current page despite a UI label
 * claiming "Push all 597".
 *
 * Query params: same filter surface as GET /api/crm/contacts (group,
 * painTier, persona, dealOwner, geoZone, lifecycleStage, outreachGroup,
 * vertical, contactType, lemlistCampaign, q) — no `page` / `limit`.
 *
 * Server-side pre-filtering:
 *   - `email IS NULL` rows excluded (push needs an address).
 *   - `doNotContact = true` rows excluded (compliance — never push
 *     someone who opted out, even if the operator selected them).
 *
 * Cap behavior:
 *   - If the filtered count exceeds 5000, returns 400 with a hint
 *     to narrow the filter. Prevents accidental bulk-push of
 *     thousands of contacts on a too-broad filter (e.g. group=G1
 *     alone matches all 597 today, but if a future Phase scales to
 *     20k+, the cap protects).
 *
 * Auth: session via `requirePageAccess("crm")` (UI calls only —
 * server-to-server bulk push should use a different scoped endpoint).
 *
 * Response shape (minimal — keeps the wire payload small for 5k rows) :
 *   {
 *     contacts: [
 *       { id, email, doNotContact, persona, fullName, companyName }
 *     ],
 *     total: <int>
 *   }
 */

const SOFT_CAP = 5000

export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, listContactsForPushQuery)
  if ("error" in vq) return vq.error
  const {
    lifecycleStage,
    vertical,
    geoZone,
    dealOwner,
    contactType,
    outreachGroup,
    group,
    painTier,
    persona,
    country,
    lemlistCampaign,
    q,
  } = vq.data

  // Build where clause — mirrors GET /api/crm/contacts logic so the
  // filter semantics stay aligned across the two endpoints.
  const where: Record<string, unknown> = {
    // Pre-filter compliance / sanity at the SQL layer so the cap math
    // counts only push-eligible rows. Prevents the 5k cap from being
    // tripped by 5k doNotContact rows that would all be skipped
    // anyway.
    AND: [
      { email: { not: null } },
      { doNotContact: false },
    ],
  }

  if (lifecycleStage && lifecycleStage !== "all") {
    where.lifecycleStage = lifecycleStage
  }
  if (vertical && vertical !== "all") {
    where.vertical = { has: vertical }
  }
  if (geoZone && geoZone !== "all") {
    where.geoZone = geoZone
  }
  if (dealOwner && dealOwner !== "all") {
    where.dealOwner = dealOwner
  }
  if (contactType && contactType !== "all") {
    where.contactType = contactType
  }
  if (outreachGroup && outreachGroup !== "all") {
    where.outreachGroup = outreachGroup
  }
  if (group) {
    where.group = group
  }
  if (painTier) {
    where.painTier = painTier
  }
  if (persona) {
    where.persona = persona
  }
  // Jurisdiction filter (Sprint Quick Wins Cleanup) — same semantics
  // as GET /api/crm/contacts: filters on Company.country relation.
  if (country && country !== "all") {
    where.company = { country }
  }
  if (lemlistCampaign && lemlistCampaign !== "all") {
    if (lemlistCampaign === "not_enrolled") {
      where.lemlistCampaignId = null
    } else if (lemlistCampaign === "completed") {
      where.lemlistStatus = "completed"
    } else {
      where.lemlistCampaignName = lemlistCampaign
    }
  }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
    ]
  }

  try {
    // Cheap COUNT first — short-circuit the cap before fetching 5k rows.
    const total = await prisma.crmContact.count({ where })
    if (total > SOFT_CAP) {
      return NextResponse.json(
        {
          error: "Filter too broad",
          details: {
            total,
            cap: SOFT_CAP,
            hint: "Narrow the filter (e.g. add a Group / Pain Tier / Persona constraint) so fewer than 5000 contacts match.",
          },
        },
        { status: 400 },
      )
    }

    const contacts = await prisma.crmContact.findMany({
      where,
      select: {
        id: true,
        email: true,
        doNotContact: true,
        persona: true,
        firstName: true,
        lastName: true,
        company: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: SOFT_CAP, // defensive — count guards above, but limit is cheap
    })

    return NextResponse.json({
      contacts: contacts.map((c) => ({
        id: c.id,
        email: c.email,
        doNotContact: c.doNotContact,
        persona: c.persona,
        fullName: `${c.firstName} ${c.lastName}`.trim(),
        companyName: c.company?.name ?? null,
      })),
      total,
    })
  } catch (err) {
    console.error("[CRM Contacts list-for-push GET]", err)
    return NextResponse.json(
      { error: "Failed to fetch contacts for push" },
      { status: 500 },
    )
  }
}
