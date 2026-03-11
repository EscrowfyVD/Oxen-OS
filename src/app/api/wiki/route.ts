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
  const tree = searchParams.get("tree")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { archived: false }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ]
  }

  if (category) {
    where.category = category
  }

  if (tree === "true") {
    const pages = await prisma.wikiPage.findMany({
      where: { archived: false },
      select: {
        id: true,
        title: true,
        slug: true,
        icon: true,
        category: true,
        parentId: true,
        pinned: true,
        order: true,
        updatedAt: true,
        updatedBy: true,
        viewCount: true,
      },
      orderBy: [{ pinned: "desc" }, { order: "asc" }, { updatedAt: "desc" }],
    })
    return NextResponse.json({ pages })
  }

  const pages = await prisma.wikiPage.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      icon: true,
      category: true,
      parentId: true,
      pinned: true,
      archived: true,
      order: true,
      viewCount: true,
      createdBy: true,
      updatedBy: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    ...(limit ? { take: parseInt(limit, 10) } : {}),
  })

  const total = await prisma.wikiPage.count({ where: { archived: false } })

  return NextResponse.json({ pages, total })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, content, category, icon, parentId, pinned } = body

  if (!title) {
    return NextResponse.json(
      { error: "Missing required field: title" },
      { status: 400 }
    )
  }

  let slug = generateSlug(title)

  const existing = await prisma.wikiPage.findUnique({ where: { slug } })
  if (existing) {
    slug = `${slug}-${Date.now()}`
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const page = await prisma.wikiPage.create({
    data: {
      title,
      slug,
      content: content ?? { type: "doc", content: [{ type: "paragraph" }] },
      category: category ?? null,
      icon: icon ?? null,
      parentId: parentId ?? null,
      pinned: pinned ?? false,
      createdBy: userId,
      updatedBy: userId,
    },
  })

  return NextResponse.json({ page }, { status: 201 })
}
