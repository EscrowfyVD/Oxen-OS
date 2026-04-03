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
          acquisitionSourceDetail: conference.name,
          pinnedNote: notesText,
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

      await prisma.activity.create({
        data: {
          contactId: crmContact.id,
          type: "conference",
          description: `Met at ${conference.name}`,
          performedBy: userId,
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
