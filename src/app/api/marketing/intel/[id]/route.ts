import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("marketing")
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { type, title, source, summary, relevance, tags } = body

  const existing = await prisma.marketingIntel.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Intel not found" }, { status: 404 })

  const item = await prisma.marketingIntel.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      ...(title !== undefined && { title }),
      ...(source !== undefined && { source: source || null }),
      ...(summary !== undefined && { summary }),
      ...(relevance !== undefined && { relevance }),
      ...(tags !== undefined && { tags }),
    },
  })

  return NextResponse.json({ intel: item })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: delErr } = await requirePageAccess("marketing")
  if (delErr) return delErr

  const { id } = await params

  const existing = await prisma.marketingIntel.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Intel not found" }, { status: 404 })

  await prisma.marketingIntel.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
