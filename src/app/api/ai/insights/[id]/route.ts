import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { dismissed, actionTaken, linkedTaskId } = body

  const insight = await prisma.aIInsight.update({
    where: { id },
    data: {
      ...(dismissed !== undefined && { dismissed }),
      ...(actionTaken !== undefined && { actionTaken }),
      ...(linkedTaskId !== undefined && { linkedTaskId }),
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true, company: { select: { id: true, name: true } } } } },
  })

  return NextResponse.json({ insight })
}
