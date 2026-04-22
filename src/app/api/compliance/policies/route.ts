import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createPolicySchema, listPoliciesQuery } from "../_schemas"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const vq = validateSearchParams(searchParams, listPoliciesQuery)
    if ("error" in vq) return vq.error
    const { category, status, entityId, search } = vq.data

    const where: Record<string, unknown> = {}
    if (category && category !== "all") where.category = category
    if (status && status !== "all") where.status = status
    if (entityId && entityId !== "all") where.entityId = entityId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const policies = await prisma.policy.findMany({
      where,
      include: {
        entity: { select: { id: true, name: true } },
        _count: { select: { versions: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ policies })
  } catch (error) {
    console.error("[Compliance Policies GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const v = await validateBody(request, createPolicySchema)
    if ("error" in v) return v.error
    const { title, category, status, priority, description, content, entityId, ownerId, reviewerId, effectiveDate, expiryDate, reviewDate, tags } = v.data

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // Auto-generate code like POL-001
    const lastPolicy = await prisma.policy.findFirst({
      where: { code: { startsWith: "POL-" } },
      orderBy: { code: "desc" },
    })
    let nextNum = 1
    if (lastPolicy) {
      const match = lastPolicy.code.match(/POL-(\d+)/)
      if (match) nextNum = parseInt(match[1]) + 1
    }
    const code = `POL-${String(nextNum).padStart(3, "0")}`

    const policy = await prisma.policy.create({
      data: {
        title,
        code,
        category,
        status: status || "draft",
        priority: priority || "medium",
        description: description || null,
        content: content || null,
        entityId: entityId || null,
        ownerId: ownerId || null,
        reviewerId: reviewerId || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        tags: tags || [],
        createdBy: userId,
      },
      include: {
        entity: { select: { id: true, name: true } },
      },
    })

    logActivity("policy_created", `Created policy ${code}: ${title}`, userId, entityId || undefined, `/compliance/policies`)

    return NextResponse.json({ policy }, { status: 201 })
  } catch (error) {
    console.error("[Compliance Policies POST] Error:", error)
    return NextResponse.json({ error: "Failed to create policy" }, { status: 500 })
  }
}
