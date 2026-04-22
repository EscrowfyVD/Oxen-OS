import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { validateBody } from "@/lib/validate"
import { updateLicenseSchema } from "../../_schemas"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const license = await prisma.regulatoryLicense.findUnique({
      where: { id },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    if (!license) return NextResponse.json({ error: "License not found" }, { status: 404 })

    return NextResponse.json({ license })
  } catch (error) {
    console.error("[Compliance License GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch license" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const v = await validateBody(request, updateLicenseSchema)
    if ("error" in v) return v.error
    const { name, code, regulator, entityId, entityName, type, status, grantedDate, expiryDate, renewalDate, conditions, notes, documentUrl } = v.data

    const existing = await prisma.regulatoryLicense.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "License not found" }, { status: 404 })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    const license = await prisma.regulatoryLicense.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code || null }),
        ...(regulator !== undefined && { regulator }),
        ...(entityId !== undefined && { entityId: entityId || null }),
        ...(entityName !== undefined && { entityName: entityName || null }),
        ...(type !== undefined && { type: type || null }),
        ...(status !== undefined && { status }),
        ...(grantedDate !== undefined && { grantedDate: grantedDate ? new Date(grantedDate) : null }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
        ...(renewalDate !== undefined && { renewalDate: renewalDate ? new Date(renewalDate) : null }),
        ...(conditions !== undefined && { conditions: conditions || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(documentUrl !== undefined && { documentUrl: documentUrl || null }),
      },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    logActivity("license_updated", `Updated license: ${license.name} (${license.regulator})`, userId, existing.entityId || undefined, `/compliance/licenses`)

    return NextResponse.json({ license })
  } catch (error) {
    console.error("[Compliance License PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update license" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const existing = await prisma.regulatoryLicense.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "License not found" }, { status: 404 })

    await prisma.regulatoryLicense.delete({ where: { id } })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"
    logActivity("license_deleted", `Deleted license: ${existing.name} (${existing.regulator})`, userId, existing.entityId || undefined)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Compliance License DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete license" }, { status: 500 })
  }
}
