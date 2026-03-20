import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const researchId = searchParams.get("researchId")
  const category = searchParams.get("category")
  const relevance = searchParams.get("relevance")
  const sentiment = searchParams.get("sentiment")
  const starred = searchParams.get("starred")
  const read = searchParams.get("read")
  const limit = parseInt(searchParams.get("limit") || "50")

  const where: Record<string, unknown> = { dismissed: false }
  if (researchId) where.researchId = researchId
  if (category) where.research = { category }
  if (relevance) where.relevance = relevance
  if (sentiment) where.sentiment = sentiment
  if (starred === "true") where.starred = true
  if (read === "true") where.read = true
  if (read === "false") where.read = false

  const results = await prisma.intelResult.findMany({
    where,
    include: { research: { select: { title: true, category: true, subcategory: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return NextResponse.json({ results })
}
