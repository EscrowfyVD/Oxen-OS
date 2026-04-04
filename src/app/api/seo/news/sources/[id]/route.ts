import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const existing = await prisma.newsSource.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 })
  }

  const updated = await prisma.newsSource.update({
    where: { id },
    data: body,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Cascade delete: remove all news items for this source first, then the source
  await prisma.newsItem.deleteMany({ where: { sourceId: id } })
  await prisma.newsSource.delete({ where: { id } })

  return NextResponse.json({ deleted: true })
}
