import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const deals = await prisma.deal.findMany({
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          company: true,
          sector: true,
          segment: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ deals })
}

export async function POST(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const body = await request.json()
  const {
    name, contactId, stage, expectedVolume, takeRate,
    expectedRevenue, probability, closeDate, assignedTo, notes,
  } = body

  if (!name || !contactId) {
    return NextResponse.json(
      { error: "Missing required fields: name and contactId" },
      { status: 400 }
    )
  }

  // Verify contact exists
  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  const userId = session.user?.email ?? "unknown"

  const deal = await prisma.deal.create({
    data: {
      name,
      contactId,
      stage: stage ?? "discovery",
      expectedVolume: expectedVolume ? parseFloat(expectedVolume) : null,
      takeRate: takeRate ? parseFloat(takeRate) : null,
      expectedRevenue: expectedRevenue ? parseFloat(expectedRevenue) : null,
      probability: probability ? parseFloat(probability) : 50,
      closeDate: closeDate ? new Date(closeDate) : null,
      assignedTo: assignedTo ?? null,
      notes: notes ?? null,
      createdBy: userId,
    },
    include: {
      contact: {
        select: { id: true, name: true, company: true },
      },
    },
  })

  return NextResponse.json({ deal }, { status: 201 })
}
