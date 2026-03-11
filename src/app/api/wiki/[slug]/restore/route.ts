import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug } = await params
  const body = await request.json()
  const { versionId } = body

  if (!versionId) {
    return NextResponse.json({ error: "Missing versionId" }, { status: 400 })
  }

  const page = await prisma.wikiPage.findUnique({ where: { slug } })
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const version = await prisma.wikiVersion.findUnique({ where: { id: versionId } })
  if (!version || version.pageId !== page.id) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  // Save current content as a new version before restoring
  await prisma.wikiVersion.create({
    data: {
      pageId: page.id,
      content: page.content as Prisma.InputJsonValue,
      editedBy: userId,
    },
  })

  // Restore the old content
  const updated = await prisma.wikiPage.update({
    where: { slug },
    data: {
      content: version.content as Prisma.InputJsonValue,
      updatedBy: userId,
    },
  })

  return NextResponse.json({ page: updated })
}
