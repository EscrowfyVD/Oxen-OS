import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      interactions: {
        orderBy: { createdAt: "desc" },
      },
      metrics: {
        orderBy: { month: "desc" },
      },
      deals: {
        orderBy: { createdAt: "desc" },
      },
      aiInsights: {
        where: { dismissed: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      meetingBriefs: {
        orderBy: { meetingDate: "desc" },
        take: 10,
      },
      companyIntel: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      emails: {
        orderBy: { date: "desc" },
        take: 20,
      },
      agent: {
        select: { id: true, name: true, company: true, type: true },
      },
      signals: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      outreachSequences: {
        orderBy: { updatedAt: "desc" },
        take: 5,
      },
    },
  })

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  return NextResponse.json({ contact })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const {
    name, email, phone, company, sector, status, source,
    value, currency, notes, assignedTo, telegram, whatsapp,
    website, country, healthStatus, monthlyGtv, monthlyRevenue,
    takeRate, segment, projectedVolume,
    clientType, vertical, leadSource, outreachStatus, agentId,
  } = body

  const existing = await prisma.contact.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(company !== undefined && { company: company || null }),
      ...(sector !== undefined && { sector: sector || null }),
      ...(status !== undefined && { status }),
      ...(source !== undefined && { source: source || null }),
      ...(value !== undefined && { value: value ? parseFloat(value) : null }),
      ...(currency !== undefined && { currency }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
      ...(telegram !== undefined && { telegram: telegram || null }),
      ...(whatsapp !== undefined && { whatsapp: whatsapp || null }),
      ...(website !== undefined && { website: website || null }),
      ...(country !== undefined && { country: country || null }),
      ...(healthStatus !== undefined && { healthStatus }),
      ...(monthlyGtv !== undefined && { monthlyGtv: monthlyGtv !== null ? parseFloat(monthlyGtv) : null }),
      ...(monthlyRevenue !== undefined && { monthlyRevenue: monthlyRevenue !== null ? parseFloat(monthlyRevenue) : null }),
      ...(takeRate !== undefined && { takeRate: takeRate !== null ? parseFloat(takeRate) : null }),
      ...(segment !== undefined && { segment: segment || null }),
      ...(projectedVolume !== undefined && { projectedVolume: projectedVolume !== null ? parseFloat(projectedVolume) : null }),
      ...(clientType !== undefined && { clientType: clientType || null }),
      ...(vertical !== undefined && { vertical: vertical || null }),
      ...(leadSource !== undefined && { leadSource: leadSource || null }),
      ...(outreachStatus !== undefined && { outreachStatus: outreachStatus || null }),
      ...(agentId !== undefined && { agentId: agentId || null }),
    },
  })

  return NextResponse.json({ contact })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.contact.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  await prisma.contact.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
