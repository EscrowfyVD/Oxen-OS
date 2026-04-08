import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

// GET /api/crm/outreach/alerts — list alerts, unresolved first, sorted by severity then date
export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const resolvedParam = searchParams.get("resolved")

    const where: Record<string, unknown> = {}
    if (resolvedParam === "false") {
      where.resolved = false
    } else if (resolvedParam === "true") {
      where.resolved = true
    }

    const alerts = await prisma.outreachAlert.findMany({
      where,
      orderBy: [
        { resolved: "asc" },   // unresolved first
        { severity: "desc" },   // critical > warning > info
        { createdAt: "desc" },  // newest first
      ],
    })

    return NextResponse.json({ alerts })
  } catch (err) {
    console.error("[Outreach Alerts GET]", err)
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 })
  }
}
