import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { validateBody } from "@/lib/validate"
import { updateIncidentSchema } from "../../_schemas"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const incident = await prisma.complianceIncident.findUnique({
      where: { id },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 })

    return NextResponse.json({ incident })
  } catch (error) {
    console.error("[Compliance Incident GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch incident" }, { status: 500 })
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
    const v = await validateBody(request, updateIncidentSchema)
    if ("error" in v) return v.error
    const { title, type, severity, status, description, rootCause, remediation, entityId, assignedTo, reportedToRegulator, regulatorRef, reportedAt, financialImpact, currency, tags } = v.data

    const existing = await prisma.complianceIncident.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Incident not found" }, { status: 404 })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // If status changes to "resolved", set resolvedAt
    const resolvedData: Record<string, unknown> = {}
    if (status === "resolved" && existing.status !== "resolved") {
      resolvedData.resolvedAt = new Date()
    }
    // Clear resolvedAt if reopened
    if (status && status !== "resolved" && status !== "closed" && existing.resolvedAt) {
      resolvedData.resolvedAt = null
    }

    const incident = await prisma.complianceIncident.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(type !== undefined && { type }),
        ...(severity !== undefined && { severity }),
        ...(status !== undefined && { status }),
        ...(description !== undefined && { description: description || null }),
        ...(rootCause !== undefined && { rootCause: rootCause || null }),
        ...(remediation !== undefined && { remediation: remediation || null }),
        ...(entityId !== undefined && { entityId: entityId || null }),
        ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
        ...(reportedToRegulator !== undefined && { reportedToRegulator }),
        ...(regulatorRef !== undefined && { regulatorRef: regulatorRef || null }),
        ...(reportedAt !== undefined && { reportedAt: reportedAt ? new Date(reportedAt) : null }),
        ...(financialImpact !== undefined && { financialImpact }),
        ...(currency !== undefined && { currency }),
        ...(tags !== undefined && { tags }),
        ...resolvedData,
      },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    logActivity("incident_updated", `Updated incident ${existing.code}: ${incident.title}`, userId, existing.entityId || undefined, `/compliance/incidents`)

    return NextResponse.json({ incident })
  } catch (error) {
    console.error("[Compliance Incident PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update incident" }, { status: 500 })
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

    const existing = await prisma.complianceIncident.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Incident not found" }, { status: 404 })

    await prisma.complianceIncident.delete({ where: { id } })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"
    logActivity("incident_deleted", `Deleted incident ${existing.code}: ${existing.title}`, userId, existing.entityId || undefined)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Compliance Incident DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete incident" }, { status: 500 })
  }
}
