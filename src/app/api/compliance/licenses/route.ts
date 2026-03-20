import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get("entityId")

    const where: Record<string, unknown> = {}
    if (entityId && entityId !== "all") where.entityId = entityId

    const licenses = await prisma.regulatoryLicense.findMany({
      where,
      include: {
        entity: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ licenses })
  } catch (error) {
    console.error("[Compliance Licenses GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch licenses" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { name, code, regulator, entityId, entityName, type, status, grantedDate, expiryDate, renewalDate, conditions, notes, documentUrl } = body

    if (!name || !regulator) {
      return NextResponse.json({ error: "name and regulator are required" }, { status: 400 })
    }

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    const license = await prisma.regulatoryLicense.create({
      data: {
        name,
        code: code || null,
        regulator,
        entityId: entityId || null,
        entityName: entityName || null,
        type: type || null,
        status: status || "active",
        grantedDate: grantedDate ? new Date(grantedDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        renewalDate: renewalDate ? new Date(renewalDate) : null,
        conditions: conditions || null,
        notes: notes || null,
        documentUrl: documentUrl || null,
        createdBy: userId,
      },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    logActivity("license_created", `Created license: ${name} (${regulator})`, userId, entityId || undefined, `/compliance/licenses`)

    return NextResponse.json({ license }, { status: 201 })
  } catch (error) {
    console.error("[Compliance Licenses POST] Error:", error)
    return NextResponse.json({ error: "Failed to create license" }, { status: 500 })
  }
}
