import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "30")
  const category = searchParams.get("category")

  const where: Record<string, unknown> = {}
  if (category && category !== "all") where.research = { category }

  const results = await prisma.intelResult.findMany({
    where,
    include: { research: { select: { title: true, category: true, subcategory: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  })

  // Sort: critical/high first, then by date
  const sorted = results.sort((a, b) => {
    const relOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const ra = relOrder[a.relevance] ?? 2
    const rb = relOrder[b.relevance] ?? 2
    if (ra !== rb) return ra - rb
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return NextResponse.json({ results: sorted })
}
