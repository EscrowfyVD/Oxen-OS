import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const brief = await prisma.meetingBrief.findUnique({
    where: { id },
    include: { contact: { select: { id: true, name: true, company: true } } },
  })

  if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 })

  // Mark as viewed
  if (brief.status === "generated") {
    await prisma.meetingBrief.update({
      where: { id },
      data: { status: "viewed" },
    })
  }

  return NextResponse.json({ brief })
}
