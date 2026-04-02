import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePageAccess("marketing")
  if (error) return error

  try {
    const { id } = await params
    const check = await prisma.contentComplianceCheck.findUnique({
      where: { id },
      include: {
        contentIdea: { select: { id: true, title: true, platform: true, status: true } },
      },
    })

    if (!check) {
      return NextResponse.json({ error: "Check not found" }, { status: 404 })
    }

    return NextResponse.json({ check })
  } catch (err) {
    console.error("Failed to fetch compliance check:", err)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePageAccess("marketing")
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const { status, reviewNotes } = body

    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (reviewNotes !== undefined) data.reviewNotes = reviewNotes
    data.reviewedBy = session?.user?.name || session?.user?.email || "unknown"
    data.reviewedAt = new Date()

    const check = await prisma.contentComplianceCheck.update({
      where: { id },
      data,
    })

    return NextResponse.json({ check })
  } catch (err) {
    console.error("Failed to update compliance check:", err)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
