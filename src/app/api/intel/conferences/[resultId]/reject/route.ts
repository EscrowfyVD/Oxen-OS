import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request, { params }: { params: Promise<{ resultId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { resultId } = await params
  const body = await request.json()
  const { reason } = body

  const result = await prisma.intelResult.findUnique({ where: { id: resultId } })
  if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 })

  const meta = (result.metadata as Record<string, unknown>) || {}

  await prisma.intelResult.update({
    where: { id: resultId },
    data: {
      metadata: { ...meta, rejected: true, rejectionReason: reason || null },
    },
  })

  return NextResponse.json({ success: true })
}
