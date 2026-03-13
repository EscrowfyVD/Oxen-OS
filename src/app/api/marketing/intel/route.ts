import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("marketing")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const relevance = searchParams.get("relevance")
  const search = searchParams.get("search")

  const where: Record<string, unknown> = {}
  if (type && type !== "all") where.type = type
  if (relevance && relevance !== "all") where.relevance = relevance
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ]
  }

  const intel = await prisma.marketingIntel.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ intel })
}

export async function POST(request: Request) {
  const { error: postErr, session } = await requirePageAccess("marketing")
  if (postErr) return postErr

  const body = await request.json()
  const { type, title, source, summary, relevance, tags } = body

  if (!type || !title || !summary) {
    return NextResponse.json({ error: "type, title, and summary are required" }, { status: 400 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const item = await prisma.marketingIntel.create({
    data: {
      type,
      title,
      source: source || null,
      summary,
      relevance: relevance || "medium",
      tags: tags || [],
      createdBy: userId,
    },
  })

  return NextResponse.json({ intel: item }, { status: 201 })
}
