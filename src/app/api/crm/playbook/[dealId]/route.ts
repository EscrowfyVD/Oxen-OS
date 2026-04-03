import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { error: pageErr } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const { dealId } = await params

  const steps = await prisma.playbookStep.findMany({
    where: { dealId },
    orderBy: [{ stage: "asc" }, { order: "asc" }],
  })

  return NextResponse.json({ steps })
}
