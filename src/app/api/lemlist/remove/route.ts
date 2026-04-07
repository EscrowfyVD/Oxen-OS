import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

const LEMLIST_API_KEY = process.env.LEMLIST_API_KEY ?? ""
const LEMLIST_BASE_URL = "https://api.lemlist.com/api"

interface RemoveBody {
  contactId: string
  campaignId?: string
}

function getLemlistAuthHeader(): string {
  return `Basic ${Buffer.from(":" + LEMLIST_API_KEY).toString("base64")}`
}

// DELETE /api/lemlist/remove — remove contact from Lemlist campaign (or all)
export async function DELETE(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  if (!LEMLIST_API_KEY) {
    return NextResponse.json(
      { error: "Lemlist API key not configured" },
      { status: 500 },
    )
  }

  try {
    const body: RemoveBody = await request.json()
    const { contactId, campaignId } = body

    if (!contactId) {
      return NextResponse.json(
        { error: "Missing required field: contactId" },
        { status: 400 },
      )
    }

    // Fetch contact email
    const contact = await prisma.crmContact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        email: true,
        totalInteractions: true,
      },
    })

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 },
      )
    }

    const encodedEmail = encodeURIComponent(contact.email)

    // Call Lemlist API: specific campaign or all campaigns
    const lemlistUrl = campaignId
      ? `${LEMLIST_BASE_URL}/campaigns/${campaignId}/leads/${encodedEmail}`
      : `${LEMLIST_BASE_URL}/leads/${encodedEmail}`

    const lemlistResponse = await fetch(lemlistUrl, {
      method: "DELETE",
      headers: {
        Authorization: getLemlistAuthHeader(),
      },
    })

    if (!lemlistResponse.ok) {
      const errText = await lemlistResponse.text()
      console.error(
        `[Lemlist Remove] API error: ${lemlistResponse.status} ${errText}`,
      )
      return NextResponse.json(
        { error: `Lemlist API error: ${lemlistResponse.status}` },
        { status: 500 },
      )
    }

    // Log activity on the contact
    const userId = session.user?.email ?? "unknown"
    const description = campaignId
      ? "Removed from Lemlist sequence"
      : "Removed from all Lemlist sequences"

    await prisma.$transaction([
      prisma.activity.create({
        data: {
          type: "clay_sequence_event",
          description,
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Lemlist Remove] Error:", err)
    return NextResponse.json(
      { error: "Failed to remove contact from Lemlist" },
      { status: 500 },
    )
  }
}
