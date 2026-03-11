import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

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
    include: { versions: { orderBy: { createdAt: "desc" }, take: 5 } },
  })

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  return NextResponse.json({ page })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug } = await params
  const body = await request.json()
  const { title, content, category } = body

  const existing = await prisma.wikiPage.findUnique({ where: { slug } })
  if (!existing) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  // Create a version snapshot of the current content before updating
  await prisma.wikiVersion.create({
    data: {
      pageId: existing.id,
      content: existing.content as Prisma.InputJsonValue,
      editedBy: userId,
    },
  })

  const page = await prisma.wikiPage.update({
    where: { slug },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(category !== undefined && { category }),
      updatedBy: userId,
    },
  })

  return NextResponse.json({ page })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug } = await params

  const existing = await prisma.wikiPage.findUnique({ where: { slug } })
  if (!existing) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  await prisma.wikiPage.delete({ where: { slug } })

  return NextResponse.json({ success: true })
}
