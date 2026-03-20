import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const policy = await prisma.policy.findUnique({
      where: { id },
      include: {
        entity: { select: { id: true, name: true } },
        versions: { orderBy: { version: "desc" } },
      },
    })

    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 })

    return NextResponse.json({ policy })
  } catch (error) {
    console.error("[Compliance Policy GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch policy" }, { status: 500 })
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
    const body = await request.json()
    const { title, category, status, priority, description, content, entityId, ownerId, reviewerId, effectiveDate, expiryDate, reviewDate, tags } = body

    const existing = await prisma.policy.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Policy not found" }, { status: 404 })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    // If status changes to "approved", set approvedAt and approvedBy
    const approvalData: Record<string, unknown> = {}
    if (status === "approved" && existing.status !== "approved") {
      approvalData.approvedAt = new Date()
      approvalData.approvedBy = userId
    }

    const policy = await prisma.policy.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(category !== undefined && { category }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(description !== undefined && { description: description || null }),
        ...(content !== undefined && { content: content || null }),
        ...(entityId !== undefined && { entityId: entityId || null }),
        ...(ownerId !== undefined && { ownerId: ownerId || null }),
        ...(reviewerId !== undefined && { reviewerId: reviewerId || null }),
        ...(effectiveDate !== undefined && { effectiveDate: effectiveDate ? new Date(effectiveDate) : null }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
        ...(reviewDate !== undefined && { reviewDate: reviewDate ? new Date(reviewDate) : null }),
        ...(tags !== undefined && { tags }),
        ...approvalData,
      },
      include: {
        entity: { select: { id: true, name: true } },
        versions: { orderBy: { version: "desc" } },
      },
    })

    logActivity("policy_updated", `Updated policy ${existing.code}: ${policy.title}`, userId, existing.entityId || undefined, `/compliance/policies`)

    return NextResponse.json({ policy })
  } catch (error) {
    console.error("[Compliance Policy PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update policy" }, { status: 500 })
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

    const existing = await prisma.policy.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Policy not found" }, { status: 404 })

    await prisma.policy.delete({ where: { id } })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"
    logActivity("policy_deleted", `Deleted policy ${existing.code}: ${existing.title}`, userId, existing.entityId || undefined)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Compliance Policy DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete policy" }, { status: 500 })
  }
}
