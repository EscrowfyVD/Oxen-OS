import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const type = searchParams.get("type")
  const status = searchParams.get("status")

  const where: Record<string, unknown> = {}
  if (category && category !== "all") where.category = category
  if (type) where.type = type
  if (status) where.status = status

  const researches = await prisma.intelResearch.findMany({
    where,
    include: { results: { select: { id: true }, take: 0 } },
    orderBy: { createdAt: "desc" },
  })

  // Get result counts
  const withCounts = await Promise.all(
    researches.map(async (r) => {
      const resultCount = await prisma.intelResult.count({ where: { researchId: r.id } })
      const unreadCount = await prisma.intelResult.count({ where: { researchId: r.id, read: false } })
      return { ...r, resultCount, unreadCount }
    })
  )

  return NextResponse.json({ researches: withCounts })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { title, category, subcategory, query, type, frequency } = body

  if (!title || !category || !type) {
    return NextResponse.json({ error: "title, category, and type are required" }, { status: 400 })
  }

  const now = new Date()
  let nextRunAt: Date | null = null
  if (type === "recurring" && frequency) {
    const ms: Record<string, number> = {
      daily: 86400000,
      weekly: 604800000,
      biweekly: 1209600000,
      monthly: 2592000000,
    }
    nextRunAt = new Date(now.getTime() + (ms[frequency] || 604800000))
  }

  const research = await prisma.intelResearch.create({
    data: {
      title,
      category,
      subcategory: subcategory || null,
      query: query || null,
      type,
      frequency: type === "recurring" ? frequency : null,
      nextRunAt,
      createdBy: session.user?.email ?? "unknown",
    },
  })

  return NextResponse.json({ research })
}
