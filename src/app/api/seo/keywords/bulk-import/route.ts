import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { keywords } = body

  if (!Array.isArray(keywords) || keywords.length === 0) {
    return NextResponse.json({ error: "keywords array is required" }, { status: 400 })
  }

  let imported = 0
  for (const kw of keywords) {
    if (!kw.keyword || !kw.vertical) continue

    await prisma.keyword.upsert({
      where: { keyword: kw.keyword },
      update: {
        vertical: kw.vertical,
        searchVolume: kw.searchVolume ?? undefined,
        difficulty: kw.difficulty ?? undefined,
        targetPosition: kw.targetPosition ?? undefined,
      },
      create: {
        keyword: kw.keyword,
        vertical: kw.vertical,
        searchVolume: kw.searchVolume ?? null,
        difficulty: kw.difficulty ?? null,
        targetPosition: kw.targetPosition ?? 10,
      },
    })
    imported++
  }

  return NextResponse.json({ imported })
}
