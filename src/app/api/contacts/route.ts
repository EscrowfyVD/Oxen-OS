import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const sector = searchParams.get("sector")
  const assignee = searchParams.get("assignee")
  const search = searchParams.get("search")
  const sortBy = searchParams.get("sortBy") || "createdAt"
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc"

  const where: Record<string, unknown> = {}

  if (status && status !== "all") {
    where.status = status
  }
  if (sector && sector !== "all") {
    where.sector = sector
  }
  if (assignee && assignee !== "all") {
    where.assignedTo = assignee
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ]
  }

  const contacts = await prisma.contact.findMany({
    where,
    include: {
      interactions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      agent: {
        select: { id: true, name: true, company: true, type: true },
      },
    },
    orderBy: { [sortBy]: sortDir },
  })

  return NextResponse.json({ contacts })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    name, email, phone, company, sector, status, source,
    value, currency, notes, assignedTo, telegram, whatsapp,
    website, country, healthStatus, monthlyGtv, monthlyRevenue,
    takeRate, segment, projectedVolume,
    clientType, vertical, leadSource, outreachStatus, agentId,
  } = body

  if (!name) {
    return NextResponse.json(
      { error: "Missing required field: name" },
      { status: 400 }
    )
  }

  const userId = session.user?.email ?? "unknown"

  const contact = await prisma.contact.create({
    data: {
      name,
      email: email ?? null,
      phone: phone ?? null,
      company: company ?? null,
      sector: sector ?? null,
      status: status ?? "lead",
      source: source ?? null,
      value: value ? parseFloat(value) : null,
      currency: currency ?? "EUR",
      notes: notes ?? null,
      assignedTo: assignedTo ?? null,
      telegram: telegram ?? null,
      whatsapp: whatsapp ?? null,
      website: website ?? null,
      country: country ?? null,
      healthStatus: healthStatus ?? "healthy",
      monthlyGtv: monthlyGtv ? parseFloat(monthlyGtv) : null,
      monthlyRevenue: monthlyRevenue ? parseFloat(monthlyRevenue) : null,
      takeRate: takeRate ? parseFloat(takeRate) : null,
      segment: segment ?? null,
      projectedVolume: projectedVolume ? parseFloat(projectedVolume) : null,
      clientType: clientType ?? null,
      vertical: vertical ?? null,
      leadSource: leadSource ?? null,
      outreachStatus: outreachStatus ?? "new",
      agentId: agentId ?? null,
      createdBy: userId,
    },
  })

  return NextResponse.json({ contact }, { status: 201 })
}
