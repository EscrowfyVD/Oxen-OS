import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { logActivity } from "@/lib/activity"

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
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 20 },
      children: {
        where: { archived: false },
        select: {
          id: true,
          title: true,
          slug: true,
          icon: true,
          category: true,
          updatedAt: true,
          updatedBy: true,
        },
        orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
      },
      parent: {
        select: {
          id: true, title: true, slug: true, icon: true,
          parent: { select: { id: true, title: true, slug: true, icon: true } },
        },
      },
    },
  })

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  // Increment view count
  const userId = session.user?.id ?? session.user?.email ?? "unknown"
  await prisma.wikiPage.update({
    where: { slug },
    data: {
      viewCount: { increment: 1 },
      lastViewedBy: userId,
    },
  })

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
  const { title, content, category, icon, pinned, parentId, order, archived } = body

  const existing = await prisma.wikiPage.findUnique({ where: { slug } })
  if (!existing) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  // Create version snapshot if content changed (throttle: max 1 per minute)
  if (content !== undefined) {
    const lastVersion = await prisma.wikiVersion.findFirst({
      where: { pageId: existing.id },
      orderBy: { createdAt: "desc" },
    })

    const shouldCreateVersion =
      !lastVersion ||
      Date.now() - new Date(lastVersion.createdAt).getTime() > 60000

    if (shouldCreateVersion) {
      await prisma.wikiVersion.create({
        data: {
          pageId: existing.id,
          content: existing.content as Prisma.InputJsonValue,
          editedBy: userId,
        },
      })
    }
  }

  const page = await prisma.wikiPage.update({
    where: { slug },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(category !== undefined && { category }),
      ...(icon !== undefined && { icon }),
      ...(pinned !== undefined && { pinned }),
      ...(parentId !== undefined && { parentId }),
      ...(order !== undefined && { order }),
      ...(archived !== undefined && { archived }),
      updatedBy: userId,
    },
  })

  if (content !== undefined) {
    logActivity("wiki_updated", `Wiki page updated — ${page.title}`, userId, page.id, `/wiki/${slug}`)
  }

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

  // Soft delete: archive instead of hard delete
  await prisma.wikiPage.update({
    where: { slug },
    data: { archived: true },
  })

  return NextResponse.json({ success: true })
}
