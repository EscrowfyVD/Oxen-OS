import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const vertical = searchParams.get("vertical")

  const where = vertical ? { vertical } : {}

  const prompts = await prisma.geoTestPrompt.findMany({
    where,
    include: {
      results: {
        orderBy: { testedAt: "desc" },
        take: 4,
      },
    },
    orderBy: { vertical: "asc" },
  })

  return NextResponse.json(prompts)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { prompt, vertical } = body

  if (!prompt || !vertical) {
    return NextResponse.json({ error: "prompt and vertical are required" }, { status: 400 })
  }

  const created = await prisma.geoTestPrompt.create({
    data: { prompt, vertical },
  })

  return NextResponse.json(created, { status: 201 })
}
