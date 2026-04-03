import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'q' must be at least 2 characters" },
      { status: 400 }
    )
  }

  const [contacts, companies, deals] = await Promise.all([
    prisma.crmContact.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        lifecycleStage: true,
        company: { select: { id: true, name: true } },
      },
      take: 20,
    }),
    prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { domain: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        domain: true,
        industry: true,
        geoZone: true,
        contactsCount: true,
        activeDealsCount: true,
      },
      take: 20,
    }),
    prisma.deal.findMany({
      where: {
        dealName: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        dealName: true,
        stage: true,
        dealValue: true,
        dealOwner: true,
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      take: 20,
    }),
  ])

  return NextResponse.json({
    results: {
      contacts,
      companies,
      deals,
    },
    total: contacts.length + companies.length + deals.length,
  })
}
