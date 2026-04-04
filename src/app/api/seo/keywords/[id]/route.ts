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

  const existing = await prisma.keyword.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Keyword not found" }, { status: 404 })
  }

  // Handle position change logic
  if (body.currentPosition !== undefined && existing.currentPosition !== null) {
    const oldPos = existing.currentPosition
    const newPos = body.currentPosition

    // Auto-set previousPosition and lastChecked
    body.previousPosition = oldPos
    body.lastChecked = new Date()

    // Calculate trend
    if (newPos < oldPos) {
      body.trend = "up"
    } else if (newPos > oldPos) {
      body.trend = "down"
    } else {
      body.trend = "stable"
    }

    const drop = newPos - oldPos

    // Position dropped off page 1 (was 1-10, now 11+)
    if (oldPos >= 1 && oldPos <= 10 && newPos > 10) {
      await prisma.seoAlert.create({
        data: {
          type: "keyword_critical",
          severity: "critical",
          title: `Keyword "${existing.keyword}" dropped off page 1`,
          detail: `Position changed from ${oldPos} to ${newPos} (dropped ${drop} positions)`,
          keywordId: id,
        },
      })
    }
    // Position dropped 5+
    else if (drop >= 5) {
      await prisma.seoAlert.create({
        data: {
          type: "keyword_warning",
          severity: "warning",
          title: `Keyword "${existing.keyword}" dropped ${drop} positions`,
          detail: `Position changed from ${oldPos} to ${newPos}`,
          keywordId: id,
        },
      })
    }
    // Position dropped 3+
    else if (drop >= 3) {
      await prisma.seoAlert.create({
        data: {
          type: "keyword_watch",
          severity: "info",
          title: `Keyword "${existing.keyword}" dropped ${drop} positions`,
          detail: `Position changed from ${oldPos} to ${newPos}`,
          keywordId: id,
        },
      })
    }
  }

  const updated = await prisma.keyword.update({
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

  await prisma.keyword.delete({ where: { id } })

  return NextResponse.json({ deleted: true })
}
