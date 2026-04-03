import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const { stepId } = await params
  const body = await request.json()
  const { isCompleted } = body

  if (typeof isCompleted !== "boolean") {
    return NextResponse.json(
      { error: "Missing required field: isCompleted (boolean)" },
      { status: 400 }
    )
  }

  const userId = session.user?.email ?? "unknown"

  const step = await prisma.playbookStep.update({
    where: { id: stepId },
    data: {
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      completedBy: isCompleted ? userId : null,
    },
  })

  return NextResponse.json({ step })
}
