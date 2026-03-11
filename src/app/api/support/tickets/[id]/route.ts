import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      contact: true,
    },
  })

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

  return NextResponse.json({ ticket })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { subject, status, priority, category, assignedTo, contactId, channel } = body

  const existing = await prisma.supportTicket.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

  // Auto-set resolvedAt when status changes to resolved/closed
  let resolvedAt = existing.resolvedAt
  if ((status === "resolved" || status === "closed") && !existing.resolvedAt) {
    resolvedAt = new Date()
  }
  // Clear resolvedAt if reopened
  if (status && status !== "resolved" && status !== "closed" && existing.resolvedAt) {
    resolvedAt = null
  }

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(subject !== undefined && { subject }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(category !== undefined && { category: category || null }),
      ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
      ...(contactId !== undefined && { contactId: contactId || null }),
      ...(channel !== undefined && { channel }),
      resolvedAt,
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      contact: true,
    },
  })

  return NextResponse.json({ ticket })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const existing = await prisma.supportTicket.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

  await prisma.supportTicket.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
