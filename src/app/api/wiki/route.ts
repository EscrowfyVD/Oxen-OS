import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")
  const category = searchParams.get("category")
  const limit = searchParams.get("limit")

  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ]
  }

  if (category) {
    where.category = category
  }

  const pages = await prisma.wikiPage.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    ...(limit ? { take: parseInt(limit, 10) } : {}),
  })

  return NextResponse.json({ pages })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, content, category } = body

  if (!title || !content) {
    return NextResponse.json(
      { error: "Missing required fields: title, content" },
      { status: 400 }
    )
  }

  let slug = generateSlug(title)

  // Ensure slug uniqueness
  const existing = await prisma.wikiPage.findUnique({ where: { slug } })
  if (existing) {
    slug = `${slug}-${Date.now()}`
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const page = await prisma.wikiPage.create({
    data: {
      title,
      slug,
      content,
      category: category ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
  })

  return NextResponse.json({ page }, { status: 201 })
}
