import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const severity = searchParams.get("severity")
    const status = searchParams.get("status")
    const entityId = searchParams.get("entityId")

    const where: Record<string, unknown> = {}
    if (type && type !== "all") where.type = type
    if (severity && severity !== "all") where.severity = severity
    if (status && status !== "all") where.status = status
    if (entityId && entityId !== "all") where.entityId = entityId

    const incidents = await prisma.complianceIncident.findMany({
      where,
      include: {
        entity: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ incidents })
  } catch (error) {
    console.error("[Compliance Incidents GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch incidents" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { title, type, severity, status, description, rootCause, remediation, entityId, reportedBy, assignedTo, reportedToRegulator, regulatorRef, reportedAt, financialImpact, currency, tags } = body

    if (!title || !type) {
      return NextResponse.json({ error: "title and type are required" }, { status: 400 })
    }

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // Auto-generate code INC-001
    const lastIncident = await prisma.complianceIncident.findFirst({
      where: { code: { startsWith: "INC-" } },
      orderBy: { code: "desc" },
    })
    let nextNum = 1
    if (lastIncident) {
      const match = lastIncident.code.match(/INC-(\d+)/)
      if (match) nextNum = parseInt(match[1]) + 1
    }
    const code = `INC-${String(nextNum).padStart(3, "0")}`

    const incident = await prisma.complianceIncident.create({
      data: {
        title,
        code,
        type,
        severity: severity || "medium",
        status: status || "open",
        description: description || null,
        rootCause: rootCause || null,
        remediation: remediation || null,
        entityId: entityId || null,
        reportedBy: reportedBy || userId,
        assignedTo: assignedTo || null,
        reportedToRegulator: reportedToRegulator || false,
        regulatorRef: regulatorRef || null,
        reportedAt: reportedAt ? new Date(reportedAt) : null,
        financialImpact: financialImpact ?? null,
        currency: currency || "EUR",
        tags: tags || [],
        createdBy: userId,
      },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    logActivity("incident_created", `Created incident ${code}: ${title} (${type}, ${severity || "medium"})`, userId, entityId || undefined, `/compliance/incidents`)

    // If type is "sar", also log SAR-specific activity
    if (type === "sar") {
      logActivity("sar_filed", `SAR filed: ${code} - ${title}`, userId, entityId || undefined, `/compliance/incidents`)
    }

    return NextResponse.json({ incident }, { status: 201 })
  } catch (error) {
    console.error("[Compliance Incidents POST] Error:", error)
    return NextResponse.json({ error: "Failed to create incident" }, { status: 500 })
  }
}
