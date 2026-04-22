import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createRiskSchema, listRisksQuery } from "../_schemas"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const vq = validateSearchParams(searchParams, listRisksQuery)
    if ("error" in vq) return vq.error
    const { category, status, minScore, entityId } = vq.data

    const where: Record<string, unknown> = {}
    if (category && category !== "all") where.category = category
    if (status && status !== "all") where.status = status
    if (entityId && entityId !== "all") where.entityId = entityId
    if (minScore) where.riskScore = { gte: minScore }

    const risks = await prisma.risk.findMany({
      where,
      include: {
        entity: { select: { id: true, name: true } },
      },
      orderBy: { riskScore: "desc" },
    })

    return NextResponse.json({ risks })
  } catch (error) {
    console.error("[Compliance Risks GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch risks" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const v = await validateBody(request, createRiskSchema)
    if ("error" in v) return v.error
    const { title, category, description, likelihood, impact, status, mitigation, residualLikelihood, residualImpact, ownerId, entityId, reviewDate } = v.data

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // Auto-generate code RISK-001
    const lastRisk = await prisma.risk.findFirst({
      where: { code: { startsWith: "RISK-" } },
      orderBy: { code: "desc" },
    })
    let nextNum = 1
    if (lastRisk) {
      const match = lastRisk.code.match(/RISK-(\d+)/)
      if (match) nextNum = parseInt(match[1]) + 1
    }
    const code = `RISK-${String(nextNum).padStart(3, "0")}`

    const lh = likelihood ?? 3
    const imp = impact ?? 3
    const riskScore = lh * imp

    const resLh = residualLikelihood ?? null
    const resImp = residualImpact ?? null
    const residualScore = resLh && resImp ? resLh * resImp : null

    const risk = await prisma.risk.create({
      data: {
        title,
        code,
        category,
        description: description || null,
        likelihood: lh,
        impact: imp,
        riskScore,
        status: status || "open",
        mitigation: mitigation || null,
        residualLikelihood: resLh,
        residualImpact: resImp,
        residualScore,
        ownerId: ownerId || null,
        entityId: entityId || null,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        createdBy: userId,
      },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    logActivity("risk_created", `Created risk ${code}: ${title} (score: ${riskScore})`, userId, entityId || undefined, `/compliance/risks`)

    return NextResponse.json({ risk }, { status: 201 })
  } catch (error) {
    console.error("[Compliance Risks POST] Error:", error)
    return NextResponse.json({ error: "Failed to create risk" }, { status: 500 })
  }
}
