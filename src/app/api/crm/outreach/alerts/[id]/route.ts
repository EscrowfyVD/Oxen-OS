import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// PATCH /api/crm/outreach/alerts/[id] — resolve an alert
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params

  try {
    const existing = await prisma.outreachAlert.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 })
    }

    if (existing.resolved) {
      return NextResponse.json({ error: "Alert is already resolved" }, { status: 400 })
    }

    const userEmail = session?.user?.email ?? "unknown"

    const updated = await prisma.outreachAlert.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: userEmail,
      },
    })

    return NextResponse.json({ alert: updated })
  } catch (err) {
    console.error("[Outreach Alert PATCH]", err)
    return NextResponse.json({ error: "Failed to resolve alert" }, { status: 500 })
  }
}
