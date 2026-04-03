import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { status } = body as { status?: string }

  if (!status || !["accepted", "dismissed", "sent"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be accepted, dismissed, or sent." },
      { status: 400 },
    )
  }

  const existing = await prisma.aIFollowUp.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Follow-up not found" }, { status: 404 })
  }

  const followup = await prisma.aIFollowUp.update({
    where: { id },
    data: { status },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: { select: { name: true } },
        },
      },
      deal: {
        select: {
          id: true,
          dealName: true,
          stage: true,
          dealValue: true,
          dealOwner: true,
        },
      },
    },
  })

  return NextResponse.json({ followup })
}
