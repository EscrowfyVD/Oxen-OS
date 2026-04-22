import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"
import { validateBody } from "@/lib/validate"
import { updateTrainingSchema } from "../../_schemas"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const training = await prisma.training.findUnique({
      where: { id },
      include: {
        entity: { select: { id: true, name: true } },
        completions: {
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true, entityId: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!training) return NextResponse.json({ error: "Training not found" }, { status: 404 })

    return NextResponse.json({ training })
  } catch (error) {
    console.error("[Compliance Training GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch training" }, { status: 500 })
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
    const v = await validateBody(request, updateTrainingSchema)
    if ("error" in v) return v.error
    const { title, category, description, provider, durationHours, frequency, mandatory, entityId, dueDate, status } = v.data

    const existing = await prisma.training.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Training not found" }, { status: 404 })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"

    const training = await prisma.training.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description: description || null }),
        ...(provider !== undefined && { provider: provider || null }),
        ...(durationHours !== undefined && { durationHours }),
        ...(frequency !== undefined && { frequency: frequency || null }),
        ...(mandatory !== undefined && { mandatory }),
        ...(entityId !== undefined && { entityId: entityId || null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(status !== undefined && { status }),
      },
      include: {
        entity: { select: { id: true, name: true } },
        completions: {
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true },
            },
          },
        },
      },
    })

    logActivity("training_updated", `Updated training ${existing.code}: ${training.title}`, userId, existing.entityId || undefined, `/compliance/training`)

    return NextResponse.json({ training })
  } catch (error) {
    console.error("[Compliance Training PATCH] Error:", error)
    return NextResponse.json({ error: "Failed to update training" }, { status: 500 })
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

    const existing = await prisma.training.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Training not found" }, { status: 404 })

    await prisma.training.delete({ where: { id } })

    const userId = session.user?.id ?? session.user?.email ?? "unknown"
    logActivity("training_deleted", `Deleted training ${existing.code}: ${existing.title}`, userId, existing.entityId || undefined)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Compliance Training DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete training" }, { status: 500 })
  }
}
