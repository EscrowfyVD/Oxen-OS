import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // Look up org entities to link licenses
    const entities = await prisma.orgEntity.findMany({
      select: { id: true, name: true },
    })

    const findEntity = (name: string) => entities.find((e) => e.name.toLowerCase().includes(name.toLowerCase()))

    const escrowfy = findEntity("escrowfy")
    const lapki = findEntity("lapki")
    const neuralId = findEntity("neural") || findEntity("nid")
    const oxenGroup = findEntity("oxen group") || findEntity("oxen")

    // Seed regulatory licenses
    const licenseData = [
      {
        name: "E-Money Institution License",
        code: "FRN-123456",
        regulator: "FCA",
        entityId: escrowfy?.id || null,
        entityName: "Escrowfy Ltd",
        type: "EMI",
        status: "active",
        grantedDate: new Date("2023-06-15"),
        renewalDate: new Date("2026-06-15"),
        conditions: "Authorised as an Electronic Money Institution under the Electronic Money Regulations 2011. Subject to FCA supervision.",
        notes: "UK Financial Conduct Authority — E-Money Institution authorization for Escrowfy Ltd.",
        createdBy: userId,
      },
      {
        name: "Virtual Currency Service Provider License",
        code: "FVT000234",
        regulator: "Eesti Finantsinspektsioon",
        entityId: lapki?.id || null,
        entityName: "Lapki OÜ",
        type: "VCSP",
        status: "active",
        grantedDate: new Date("2022-11-01"),
        renewalDate: new Date("2027-11-01"),
        conditions: "Licensed to provide virtual currency wallet services and virtual currency exchange services in Estonia.",
        notes: "Estonian Financial Supervisory Authority — Virtual Currency Service Provider license for Lapki OÜ.",
        createdBy: userId,
      },
      {
        name: "Payment Institution (Agent) License",
        code: "CIB-AG-2024-001",
        regulator: "ACPR",
        entityId: neuralId?.id || null,
        entityName: "Neural ID Pay SAS",
        type: "agent",
        status: "active",
        grantedDate: new Date("2024-01-20"),
        renewalDate: new Date("2027-01-20"),
        conditions: "Registered as an agent of a licensed Payment Institution. Authorized to provide payment services under PSD2 framework in France.",
        notes: "Autorité de Contrôle Prudentiel et de Résolution — Payment Institution agent registration for Neural ID Pay SAS.",
        createdBy: userId,
      },
      {
        name: "Holding Company — Multi-jurisdiction Placeholder",
        code: null,
        regulator: "Multiple",
        entityId: oxenGroup?.id || null,
        entityName: "Oxen Group",
        type: "holding",
        status: "active",
        grantedDate: null,
        renewalDate: null,
        conditions: "Parent holding company overseeing regulated entities across UK, Estonia, and France. Not directly regulated but subject to group-level supervisory requirements.",
        notes: "Oxen Group — holding company encompassing Escrowfy Ltd (UK/FCA), Lapki OÜ (Estonia/EFSA), and Neural ID Pay SAS (France/ACPR).",
        createdBy: userId,
      },
    ]

    const created = []
    for (const data of licenseData) {
      // Skip if a license with same regulator + entityName already exists
      const existing = await prisma.regulatoryLicense.findFirst({
        where: {
          regulator: data.regulator,
          entityName: data.entityName,
        },
      })
      if (existing) continue

      const license = await prisma.regulatoryLicense.create({ data })
      created.push(license)
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${created.length} regulatory licenses`,
      licenses: created,
    })
  } catch (error) {
    console.error("[Compliance Seed] Error:", error)
    return NextResponse.json({ error: "Failed to seed compliance data" }, { status: 500 })
  }
}
