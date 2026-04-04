import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return text ? text.split(" ").length : 0
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const vertical = searchParams.get("vertical")
  const search = searchParams.get("search")
  const skip = parseInt(searchParams.get("skip") || "0", 10)

  const where: Record<string, unknown> = {}

  if (status) {
    where.status = status
  }

  if (vertical) {
    where.vertical = { has: vertical }
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { primaryKeyword: { contains: search, mode: "insensitive" } },
      { metaDescription: { contains: search, mode: "insensitive" } },
    ]
  }

  const articles = await prisma.article.findMany({
    where,
    orderBy: [
      { status: "asc" }, // "published" sorts before other statuses alphabetically
      { createdAt: "desc" },
    ],
    take: 30,
    skip,
  })

  return NextResponse.json({ articles })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    title,
    slug,
    metaDescription,
    content,
    vertical,
    primaryKeyword,
    secondaryKeywords,
    status,
  } = body

  if (!title || !slug || !content) {
    return NextResponse.json(
      { error: "Missing required fields: title, slug, content" },
      { status: 400 }
    )
  }

  const wordCount = countWords(content)

  const article = await prisma.article.create({
    data: {
      title,
      slug,
      metaDescription: metaDescription || null,
      content,
      vertical: vertical || [],
      primaryKeyword: primaryKeyword || null,
      secondaryKeywords: secondaryKeywords || [],
      wordCount,
      status: status || "draft",
      generatedBy: "manual",
    },
  })

  return NextResponse.json({ article }, { status: 201 })
}
