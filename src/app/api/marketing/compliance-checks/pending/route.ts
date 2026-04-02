import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET() {
  const { error } = await requirePageAccess("compliance")
  if (error) {
    // Also allow marketing access
    const mkt = await requirePageAccess("marketing")
    if (mkt.error) return mkt.error
  }

  try {
    const checks = await prisma.contentComplianceCheck.findMany({
      where: {
        status: { in: ["needs_changes", "rejected"] },
        reviewedBy: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        contentIdea: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json({ checks })
  } catch (err) {
    console.error("Failed to fetch pending checks:", err)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
