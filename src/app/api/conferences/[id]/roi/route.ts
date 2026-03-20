import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params

    const conference = await prisma.conference.findUnique({
      where: { id },
      include: {
        collectedContacts: {
          select: {
            id: true,
            addedToCrm: true,
            contactId: true,
          },
        },
      },
    })

    if (!conference) {
      return NextResponse.json({ error: "Conference not found" }, { status: 404 })
    }

    // Calculate total cost
    const totalCost =
      (conference.ticketCost ?? 0) +
      (conference.hotelCost ?? 0) +
      (conference.flightCost ?? 0) +
      (conference.mealsCost ?? 0) +
      (conference.otherCost ?? 0)

    const contactsCollected = conference.collectedContacts.length
    const crmLeads = conference.collectedContacts.filter((c) => c.addedToCrm).length

    // Get linked CRM contact IDs
    const linkedContactIds = conference.collectedContacts
      .filter((c) => c.contactId)
      .map((c) => c.contactId as string)

    // Find deals for those contacts
    let dealsCount = 0
    let pipelineValue = 0
    let wonRevenue = 0

    if (linkedContactIds.length > 0) {
      const deals = await prisma.deal.findMany({
        where: { contactId: { in: linkedContactIds } },
        select: {
          id: true,
          stage: true,
          expectedRevenue: true,
        },
      })

      dealsCount = deals.length
      pipelineValue = deals.reduce((sum, d) => sum + (d.expectedRevenue ?? 0), 0)
      wonRevenue = deals
        .filter((d) => d.stage === "won" || d.stage === "closed_won")
        .reduce((sum, d) => sum + (d.expectedRevenue ?? 0), 0)
    }

    const roi = totalCost > 0 ? ((wonRevenue - totalCost) / totalCost) * 100 : 0

    return NextResponse.json({
      totalCost,
      currency: conference.currency,
      contactsCollected,
      crmLeads,
      dealsCreated: dealsCount,
      pipelineValue,
      wonRevenue,
      roi: Math.round(roi * 100) / 100,
    })
  } catch (error) {
    console.error("Failed to calculate ROI:", error)
    return NextResponse.json({ error: "Failed to calculate ROI" }, { status: 500 })
  }
}
