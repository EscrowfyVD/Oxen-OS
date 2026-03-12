import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const briefs = await prisma.meetingBrief.findMany({
    include: { contact: { select: { id: true, name: true, company: true } } },
    orderBy: { meetingDate: "desc" },
    take: 20,
  })

  return NextResponse.json({ briefs })
}
