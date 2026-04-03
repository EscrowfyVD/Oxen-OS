import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") || "pending"
  const assignee = searchParams.get("assignee")

  const where: Record<string, unknown> = { status }
  if (assignee) {
    where.assignee = assignee
  }

  const followups = await prisma.aIFollowUp.findMany({
    where,
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
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ followups })
}
