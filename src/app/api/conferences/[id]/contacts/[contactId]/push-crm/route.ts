import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, contactId } = await params
    const userId = session.user?.email ?? "unknown"

    const confContact = await prisma.conferenceContact.findFirst({
      where: { id: contactId, conferenceId: id },
    })
    if (!confContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    if (confContact.addedToCrm) {
      return NextResponse.json({ error: "Contact already pushed to CRM" }, { status: 409 })
    }

    const conference = await prisma.conference.findUnique({
      where: { id },
      select: { name: true },
    })

    const notesText = `Met at ${conference?.name ?? "conference"}.${confContact.notes ? ` ${confContact.notes}` : ""}`

    // Create CRM Contact
    const nameParts = (confContact.name || "").trim().split(/\s+/)
    const firstName = nameParts[0] || ""
    const lastName = nameParts.slice(1).join(" ") || ""

    // Look up or create a Company record from the conference contact's company name
    let companyId: string | undefined
    if (confContact.company) {
      const company = await prisma.company.upsert({
        where: { domain: confContact.company.toLowerCase().replace(/\s+/g, "-") },
        update: {},
        create: {
          name: confContact.company,
          domain: confContact.company.toLowerCase().replace(/\s+/g, "-"),
        },
        select: { id: true },
      })
      companyId = company.id
    }

    const crmContact = await prisma.crmContact.create({
      data: {
        firstName,
        lastName,
        email: confContact.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@unknown.com`,
        phone: confContact.phone,
        companyId: companyId ?? null,
        telegram: confContact.telegram,
        website: confContact.linkedin,
        lifecycleStage: "new_lead",
        acquisitionSource: "Conference",
        acquisitionSourceDetail: conference?.name ?? "conference",
        pinnedNote: notesText,
        createdBy: userId,
      },
    })

    // Update ConferenceContact
    await prisma.conferenceContact.update({
      where: { id: contactId },
      data: {
        addedToCrm: true,
        contactId: crmContact.id,
      },
    })

    // Create Interaction
    await prisma.activity.create({
      data: {
        contactId: crmContact.id,
        type: "conference",
        description: `Met at ${conference?.name ?? "conference"}`,
        performedBy: userId,
      },
    })

    return NextResponse.json({ contact: crmContact }, { status: 201 })
  } catch (error) {
    console.error("Failed to push contact to CRM:", error)
    return NextResponse.json({ error: "Failed to push contact to CRM" }, { status: 500 })
  }
}
