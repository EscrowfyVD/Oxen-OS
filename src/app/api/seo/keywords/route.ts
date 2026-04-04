import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const vertical = searchParams.get("vertical")
  const minPosition = searchParams.get("minPosition")
  const maxPosition = searchParams.get("maxPosition")
  const search = searchParams.get("search")
  const isTracked = searchParams.get("isTracked")

  const where: Record<string, unknown> = {}

  if (vertical) where.vertical = vertical
  if (isTracked !== null && isTracked !== undefined && isTracked !== "") {
    where.isTracked = isTracked === "true"
  }
  if (search) {
    where.keyword = { contains: search, mode: "insensitive" }
  }
  if (minPosition || maxPosition) {
    where.currentPosition = {}
    if (minPosition) (where.currentPosition as Record<string, number>).gte = parseInt(minPosition)
    if (maxPosition) (where.currentPosition as Record<string, number>).lte = parseInt(maxPosition)
  }

  const [keywords, total] = await Promise.all([
    prisma.keyword.findMany({
      where,
      orderBy: { currentPosition: { sort: "asc", nulls: "last" } },
    }),
    prisma.keyword.count({ where }),
  ])

  return NextResponse.json({ keywords, total })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { keyword, vertical, searchVolume, difficulty, targetPosition } = body

  if (!keyword || !vertical) {
    return NextResponse.json({ error: "keyword and vertical are required" }, { status: 400 })
  }

  const created = await prisma.keyword.create({
    data: {
      keyword,
      vertical,
      searchVolume: searchVolume ?? null,
      difficulty: difficulty ?? null,
      targetPosition: targetPosition ?? 10,
    },
  })

  return NextResponse.json(created, { status: 201 })
}
