import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug } = await params

  const page = await prisma.wikiPage.findUnique({
    where: { slug },
    select: { id: true },
  })

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const versions = await prisma.wikiVersion.findMany({
    where: { pageId: page.id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ versions })
}
