import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

const MAX_EXPORT = 5000

const CSV_COLUMNS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "jobTitle",
  "vertical",
  "subVertical",
  "outreachGroup",
  "geoZone",
  "dealOwner",
  "lifecycleStage",
  "acquisitionSource",
  "lastInteraction",
  "notes",
] as const

function escapeCsvValue(value: string | null | undefined): string {
  if (value == null) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// GET /api/crm/contacts/export — export contacts as CSV
export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)

    const lifecycleStage = searchParams.get("lifecycleStage")
    const vertical = searchParams.get("vertical")
    const geoZone = searchParams.get("geoZone")
    const dealOwner = searchParams.get("dealOwner")
    const outreachGroup = searchParams.get("outreachGroup")
    const q = searchParams.get("q")

    const where: Record<string, unknown> = {}

    if (lifecycleStage && lifecycleStage !== "all") {
      where.lifecycleStage = lifecycleStage
    }
    if (vertical && vertical !== "all") {
      where.vertical = { has: vertical }
    }
    if (geoZone && geoZone !== "all") {
      where.geoZone = geoZone
    }
    if (dealOwner && dealOwner !== "all") {
      where.dealOwner = dealOwner
    }
    if (outreachGroup && outreachGroup !== "all") {
      where.outreachGroup = outreachGroup
    }
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ]
    }

    const contacts = await prisma.crmContact.findMany({
      where,
      include: {
        company: { select: { name: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT,
    })

    // Build CSV
    const headerRow = CSV_COLUMNS.join(",")

    const dataRows = contacts.map((contact) => {
      const latestActivityDate = contact.activities[0]?.createdAt
        ? contact.activities[0].createdAt.toISOString().split("T")[0]
        : ""

      const values = [
        escapeCsvValue(contact.firstName),
        escapeCsvValue(contact.lastName),
        escapeCsvValue(contact.email),
        escapeCsvValue(contact.phone),
        escapeCsvValue(contact.company?.name),
        escapeCsvValue(contact.jobTitle),
        escapeCsvValue(contact.vertical?.join("; ")),
        escapeCsvValue(contact.subVertical?.join("; ")),
        escapeCsvValue(contact.outreachGroup),
        escapeCsvValue(contact.geoZone),
        escapeCsvValue(contact.dealOwner),
        escapeCsvValue(contact.lifecycleStage),
        escapeCsvValue(contact.acquisitionSource),
        escapeCsvValue(latestActivityDate),
        escapeCsvValue(contact.pinnedNote),
      ]

      return values.join(",")
    })

    const csv = [headerRow, ...dataRows].join("\n")

    const today = new Date().toISOString().split("T")[0]

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="crm-contacts-export-${today}.csv"`,
      },
    })
  } catch (err) {
    console.error("[CRM Contacts Export]", err)
    return NextResponse.json({ error: "Failed to export contacts" }, { status: 500 })
  }
}
