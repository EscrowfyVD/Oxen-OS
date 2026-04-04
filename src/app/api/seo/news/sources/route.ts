import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sources = await prisma.newsSource.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { newsItems: true },
      },
    },
  })

  return NextResponse.json(sources)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, url, rssUrl, category } = body

  if (!name || !url || !category) {
    return NextResponse.json({ error: "name, url, and category are required" }, { status: 400 })
  }

  const source = await prisma.newsSource.create({
    data: {
      name,
      url,
      rssUrl: rssUrl || null,
      category,
    },
  })

  return NextResponse.json(source, { status: 201 })
}
