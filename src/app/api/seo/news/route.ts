import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const category = searchParams.get("category")
  const minRelevance = searchParams.get("minRelevance")
  const search = searchParams.get("search")
  const skip = parseInt(searchParams.get("skip") || "0")

  const where: Record<string, unknown> = {}

  if (status) where.status = status
  if (minRelevance) where.relevanceScore = { gte: parseInt(minRelevance) }
  if (search) {
    where.title = { contains: search, mode: "insensitive" }
  }
  if (category) {
    where.source = { category }
  }

  const [items, total] = await Promise.all([
    prisma.newsItem.findMany({
      where,
      include: { source: true },
      orderBy: { publishedAt: "desc" },
      take: 50,
      skip,
    }),
    prisma.newsItem.count({ where }),
  ])

  return NextResponse.json({ items, total })
}
