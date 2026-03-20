import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "30")
  const category = searchParams.get("category")
  const filter = searchParams.get("filter") // "critical", "high", "actionable", "starred", "unread"
  const sort = searchParams.get("sort") || "relevance" // "newest", "relevance", "sentiment"

  const where: Record<string, unknown> = { dismissed: false }
  if (category && category !== "all") where.research = { category }

  // Apply filter
  if (filter === "critical") where.relevance = "critical"
  else if (filter === "high") where.relevance = { in: ["critical", "high"] }
  else if (filter === "actionable") where.actionable = true
  else if (filter === "starred") where.starred = true
  else if (filter === "unread") where.read = false

  const results = await prisma.intelResult.findMany({
    where,
    include: { research: { select: { title: true, category: true, subcategory: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  })

  // Sort based on preference
  const sorted = results.sort((a, b) => {
    if (sort === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    if (sort === "sentiment") {
      const sentOrder: Record<string, number> = { negative: 0, neutral: 1, positive: 2 }
      const sa = sentOrder[a.sentiment || "neutral"] ?? 1
      const sb = sentOrder[b.sentiment || "neutral"] ?? 1
      if (sa !== sb) return sa - sb
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    // Default: relevance
    const relOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const ra = relOrder[a.relevance] ?? 2
    const rb = relOrder[b.relevance] ?? 2
    if (ra !== rb) return ra - rb
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return NextResponse.json({ results: sorted })
}
