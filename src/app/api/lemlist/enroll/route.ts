import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { childLoggerFromRequest } from "@/lib/logger"

const LEMLIST_API_KEY = process.env.LEMLIST_API_KEY ?? ""
const LEMLIST_BASE_URL = "https://api.lemlist.com/api"

interface EnrollBody {
  contactId: string
  campaignId: string
  // Sprint S0.6 — operator override for the persona/campaign cross-
  // field check. Set to true when the operator knows the mismatch is
  // intentional (e.g. last-ditch outreach to an OP because no DM is
  // available for that company, or specific campaign that targets
  // both personas). Each override is logged at warn level for audit.
  forcePersonaMismatch?: boolean
}

/**
 * Sprint S0.6 — guards against silently enrolling a contact in a
 * campaign whose name implies a different persona than the contact
 * carries. Examples:
 *   - persona=OP, campaign="G1_Tier 1_Decision-Maker"   → 400
 *   - persona=DM, campaign="G5_Tier 2_Operational [v1]" → 400
 *   - persona=DM, campaign="G1_Tier 1_Decision-Maker"   → ok
 *   - persona=null/undefined                              → ok (skip)
 *   - campaign not in local OutreachCampaign cache         → ok (skip,
 *     defensive — don't block enroll on a missing local row, just
 *     log a warn)
 *
 * Returns null when the enroll should proceed, or a NextResponse 400
 * when the mismatch is detected and the override is NOT set.
 */
async function checkPersonaCampaignMatch(
  contact: { persona: string | null },
  campaignId: string,
  forceOverride: boolean,
  log: ReturnType<typeof childLoggerFromRequest>,
): Promise<NextResponse | null> {
  // Pull campaign name from the local OutreachCampaign cache (synced
  // from Lemlist by /api/lemlist/sync). Avoids a per-enroll Lemlist
  // API roundtrip just for the validation.
  const campaign = await prisma.outreachCampaign.findUnique({
    where: { lemlistCampaignId: campaignId },
    select: { name: true },
  })
  if (!campaign) {
    log.warn(
      { campaignId },
      "lemlist enroll: persona check skipped — campaign not in local cache (run /api/lemlist/sync to refresh)",
    )
    return null
  }

  // No persona on the contact → no mismatch possible.
  if (contact.persona !== "DM" && contact.persona !== "OP") return null

  // The campaign-name patterns mirror the naming convention Andy uses
  // on Lemlist (verified Sprint S0 audit): `G{N}_Tier {N}_{Persona}`,
  // optional `[vN]` suffix. We're tolerant on case and the suffix.
  const isDecisionMakerCampaign = /Decision-?Maker/i.test(campaign.name)
  const isOperationalCampaign = /Operational/i.test(campaign.name)

  let mismatch: { contactPersona: "DM" | "OP"; expected: string } | null = null
  if (contact.persona === "OP" && isDecisionMakerCampaign) {
    mismatch = { contactPersona: "OP", expected: "Decision-Maker campaign expects DM contacts" }
  } else if (contact.persona === "DM" && isOperationalCampaign) {
    mismatch = { contactPersona: "DM", expected: "Operational campaign expects OP contacts" }
  }

  if (!mismatch) return null

  if (forceOverride) {
    log.warn(
      {
        campaignId,
        campaignName: campaign.name,
        contactPersona: mismatch.contactPersona,
        forcePersonaMismatch: true,
      },
      "lemlist enroll: persona/campaign mismatch overridden by operator",
    )
    return null
  }

  return NextResponse.json(
    {
      error: "Persona mismatch",
      details: {
        contactPersona: mismatch.contactPersona,
        campaignName: campaign.name,
        explanation: mismatch.expected,
        hint: "Use forcePersonaMismatch=true in the request body to override (logged for audit).",
      },
    },
    { status: 400 },
  )
}

interface LemlistLeadResponse {
  _id: string
  [key: string]: unknown
}

function getLemlistAuthHeader(): string {
  return `Basic ${Buffer.from(":" + LEMLIST_API_KEY).toString("base64")}`
}

// POST /api/lemlist/enroll — push contact to a Lemlist campaign
export async function POST(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  if (!LEMLIST_API_KEY) {
    return NextResponse.json(
      { error: "Lemlist API key not configured" },
      { status: 500 },
    )
  }

  const log = childLoggerFromRequest(request).child({ route: "lemlist/enroll" })

  try {
    const body: EnrollBody = await request.json()
    const { contactId, campaignId, forcePersonaMismatch } = body

    if (!contactId || !campaignId) {
      return NextResponse.json(
        { error: "Missing required fields: contactId and campaignId" },
        { status: 400 },
      )
    }

    // Fetch contact with company relation
    const contact = await prisma.crmContact.findUnique({
      where: { id: contactId },
      include: {
        company: { select: { name: true } },
      },
    })

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 },
      )
    }

    if (contact.doNotContact) {
      return NextResponse.json(
        { error: "Contact is marked Do Not Contact" },
        { status: 400 },
      )
    }

    // Sprint S0.6 — cross-field persona vs campaign-name guard.
    // Returns null if OK or if forcePersonaMismatch=true override; a
    // 400 NextResponse if mismatch detected without override.
    const personaCheck = await checkPersonaCampaignMatch(
      contact,
      campaignId,
      forcePersonaMismatch === true,
      log,
    )
    if (personaCheck) return personaCheck

    // Push lead to Lemlist campaign
    const lemlistResponse = await fetch(
      `${LEMLIST_BASE_URL}/campaigns/${campaignId}/leads/${encodeURIComponent(contact.email)}`,
      {
        method: "POST",
        headers: {
          Authorization: getLemlistAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: contact.firstName,
          lastName: contact.lastName,
          companyName: contact.company?.name ?? "",
          icebreaker: contact.pinnedNote ?? "",
        }),
      },
    )

    if (!lemlistResponse.ok) {
      const errText = await lemlistResponse.text()
      console.error(
        `[Lemlist Enroll] API error: ${lemlistResponse.status} ${errText}`,
      )
      return NextResponse.json(
        { error: `Lemlist API error: ${lemlistResponse.status}` },
        { status: 500 },
      )
    }

    const leadData: LemlistLeadResponse = await lemlistResponse.json()

    // Fetch campaign name for the activity log
    let campaignName = campaignId
    try {
      const campaignResponse = await fetch(
        `${LEMLIST_BASE_URL}/campaigns/${campaignId}`,
        {
          method: "GET",
          headers: {
            Authorization: getLemlistAuthHeader(),
          },
        },
      )
      if (campaignResponse.ok) {
        const campaignData = await campaignResponse.json()
        campaignName = campaignData.name ?? campaignId
      }
    } catch {
      // Non-critical: fall back to campaignId
    }

    // Log activity on the contact
    const userId = session.user?.email ?? "unknown"

    // Fetch campaign step count
    let totalSteps: number | null = null
    try {
      const seqRes = await fetch(
        `${LEMLIST_BASE_URL}/campaigns/${campaignId}`,
        { headers: { Authorization: getLemlistAuthHeader() } },
      )
      if (seqRes.ok) {
        const seqData = await seqRes.json()
        if (Array.isArray(seqData.sequence)) totalSteps = seqData.sequence.length
      }
    } catch { /* non-critical */ }

    await prisma.$transaction([
      prisma.activity.create({
        data: {
          type: "clay_sequence_event",
          description: `Enrolled in Lemlist sequence: ${campaignName}`,
          contactId: contact.id,
          performedBy: userId,
        },
      }),
      prisma.crmContact.update({
        where: { id: contact.id },
        data: {
          lastInteraction: new Date(),
          totalInteractions: contact.totalInteractions + 1,
          lemlistCampaignId: campaignId,
          lemlistCampaignName: campaignName,
          lemlistStatus: "active",
          lemlistStep: 0,
          lemlistTotalSteps: totalSteps,
          lemlistEnrolledAt: new Date(),
        },
      }),
    ])

    return NextResponse.json({ ok: true, leadId: leadData._id })
  } catch (err) {
    console.error("[Lemlist Enroll] Error:", err)
    return NextResponse.json(
      { error: "Failed to enroll contact in Lemlist campaign" },
      { status: 500 },
    )
  }
}
