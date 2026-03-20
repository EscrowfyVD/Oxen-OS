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
    const crmContact = await prisma.contact.create({
      data: {
        name: confContact.name,
        email: confContact.email,
        phone: confContact.phone,
        company: confContact.company,
        telegram: confContact.telegram,
        website: confContact.linkedin,
        status: "lead",
        source: "Conference",
        notes: notesText,
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
    await prisma.interaction.create({
      data: {
        contactId: crmContact.id,
        type: "conference",
        content: `Met at ${conference?.name ?? "conference"}`,
        createdBy: userId,
      },
    })

    return NextResponse.json({ contact: crmContact }, { status: 201 })
  } catch (error) {
    console.error("Failed to push contact to CRM:", error)
    return NextResponse.json({ error: "Failed to push contact to CRM" }, { status: 500 })
  }
}
