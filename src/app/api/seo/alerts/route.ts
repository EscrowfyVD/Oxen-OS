import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const resolvedParam = searchParams.get("resolved")
  const severity = searchParams.get("severity")
  const type = searchParams.get("type")

  const where: Record<string, unknown> = {}

  if (resolvedParam !== null) {
    where.resolved = resolvedParam === "true"
  }
  if (severity) {
    where.severity = severity
  }
  if (type) {
    where.type = type
  }

  const alerts = await prisma.seoAlert.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  // Sort: unresolved first, then by severity, then by createdAt desc
  alerts.sort((a, b) => {
    // Unresolved first
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
    // Then by severity
    const sevA = SEVERITY_ORDER[a.severity] ?? 3
    const sevB = SEVERITY_ORDER[b.severity] ?? 3
    if (sevA !== sevB) return sevA - sevB
    // Then by createdAt desc
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  return NextResponse.json(alerts)
}
