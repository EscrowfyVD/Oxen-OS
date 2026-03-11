import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = searchParams.get("limit")
  const upcoming = searchParams.get("upcoming")

  const where: Record<string, unknown> = {}

  if (upcoming === "true") {
    where.startTime = { gte: new Date() }
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: { callNote: { select: { id: true, title: true } } },
    ...(limit ? { take: parseInt(limit, 10) } : {}),
  })

  return NextResponse.json({ events })
}
