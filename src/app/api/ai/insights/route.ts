import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const severity = searchParams.get("severity")
  const showDismissed = searchParams.get("showDismissed") === "true"

  const where: Record<string, unknown> = {}
  if (type && type !== "all") where.type = type
  if (severity && severity !== "all") where.severity = severity
  if (!showDismissed) where.dismissed = false

  const insights = await prisma.aIInsight.findMany({
    where,
    include: { contact: { select: { id: true, name: true, company: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json({ insights })
}
