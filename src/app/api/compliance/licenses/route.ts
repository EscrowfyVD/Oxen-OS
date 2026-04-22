import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createLicenseSchema, listLicensesQuery } from "../_schemas"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const vq = validateSearchParams(searchParams, listLicensesQuery)
    if ("error" in vq) return vq.error
    const { entityId } = vq.data

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

    const v = await validateBody(request, createLicenseSchema)
    if ("error" in v) return v.error
    const { name, code, regulator, entityId, entityName, type, status, grantedDate, expiryDate, renewalDate, conditions, notes, documentUrl } = v.data

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
