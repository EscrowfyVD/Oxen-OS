import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("marketing")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const platform = searchParams.get("platform")

  const where: Record<string, unknown> = {}
  if (status && status !== "all") where.status = status
  if (platform && platform !== "all") where.platform = platform

  try {
    const checks = await prisma.contentComplianceCheck.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        contentIdea: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ checks })
  } catch (err) {
    console.error("Failed to fetch compliance checks:", err)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
