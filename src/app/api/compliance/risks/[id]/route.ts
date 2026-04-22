import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { validateBody } from "@/lib/validate"
import { updateRiskSchema } from "../../_schemas"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const risk = await prisma.risk.findUnique({
      where: { id },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    if (!risk) return NextResponse.json({ error: "Risk not found" }, { status: 404 })

    return NextResponse.json({ risk })
  } catch (error) {
    console.error("[Compliance Risk GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch risk" }, { status: 500 })
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
    const v = await validateBody(request, updateRiskSchema)
    if ("error" in v) return v.error
    const { title, category, description, likelihood, impact, status, mitigation, residualLikelihood, residualImpact, ownerId, entityId, reviewDate } = v.data

    const existing = await prisma.risk.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Risk not found" }, { status: 404 })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // Recalculate scores if likelihood or impact changed
    const newLikelihood = likelihood !== undefined ? likelihood : existing.likelihood
    const newImpact = impact !== undefined ? impact : existing.impact
    const riskScore = newLikelihood * newImpact

    const newResLikelihood = residualLikelihood !== undefined ? residualLikelihood : existing.residualLikelihood
    const newResImpact = residualImpact !== undefined ? residualImpact : existing.residualImpact
    const residualScore = newResLikelihood && newResImpact ? newResLikelihood * newResImpact : existing.residualScore

    const risk = await prisma.risk.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description: description || null }),
        ...(likelihood !== undefined && { likelihood }),
        ...(impact !== undefined && { impact }),
        riskScore,
        ...(status !== undefined && { status }),
        ...(mitigation !== undefined && { mitigation: mitigation || null }),
        ...(residualLikelihood !== undefined && { residualLikelihood }),
        ...(residualImpact !== undefined && { residualImpact }),
        residualScore,
        ...(ownerId !== undefined && { ownerId: ownerId || null }),
        ...(entityId !== undefined && { entityId: entityId || null }),
        ...(reviewDate !== undefined && { reviewDate: reviewDate ? new Date(reviewDate) : null }),
        lastAssessedAt: new Date(),
      },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    logActivity("risk_updated", `Updated risk ${existing.code}: ${risk.title}`, userId, existing.entityId || undefined, `/compliance/risks`)

    return NextResponse.json({ risk })
  } catch (error) {
    console.error("[Compliance Risk PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update risk" }, { status: 500 })
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

    const existing = await prisma.risk.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Risk not found" }, { status: 404 })

    await prisma.risk.delete({ where: { id } })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"
    logActivity("risk_deleted", `Deleted risk ${existing.code}: ${existing.title}`, userId, existing.entityId || undefined)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Compliance Risk DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete risk" }, { status: 500 })
  }
}
