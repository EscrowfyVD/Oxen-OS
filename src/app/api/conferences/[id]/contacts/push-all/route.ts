import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const userId = session.user?.email ?? "unknown"

    const conference = await prisma.conference.findUnique({
      where: { id },
      select: { name: true },
    })
    if (!conference) {
      return NextResponse.json({ error: "Conference not found" }, { status: 404 })
    }

    const unpushed = await prisma.conferenceContact.findMany({
      where: { conferenceId: id, addedToCrm: false },
    })

    if (unpushed.length === 0) {
      return NextResponse.json({ message: "No unpushed contacts", pushed: 0 })
    }

    const results = []

    for (const confContact of unpushed) {
      const notesText = `Met at ${conference.name}.${confContact.notes ? ` ${confContact.notes}` : ""}`

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

      await prisma.conferenceContact.update({
        where: { id: confContact.id },
        data: {
          addedToCrm: true,
          contactId: crmContact.id,
        },
      })

      await prisma.interaction.create({
        data: {
          contactId: crmContact.id,
          type: "conference",
          content: `Met at ${conference.name}`,
          createdBy: userId,
        },
      })

      results.push(crmContact)
    }

    return NextResponse.json({ pushed: results.length, contacts: results }, { status: 201 })
  } catch (error) {
    console.error("Failed to bulk push contacts to CRM:", error)
    return NextResponse.json({ error: "Failed to bulk push contacts" }, { status: 500 })
  }
}
