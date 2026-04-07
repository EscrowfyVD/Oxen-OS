import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

const LEMLIST_API_KEY = process.env.LEMLIST_API_KEY ?? ""
const LEMLIST_BASE_URL = "https://api.lemlist.com/api"

interface EnrollBody {
  contactId: string
  campaignId: string
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

  try {
    const body: EnrollBody = await request.json()
    const { contactId, campaignId } = body

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
