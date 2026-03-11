import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { sender, content, isInternal } = body

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 })
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } })
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

  // Create the message
  const message = await prisma.supportMessage.create({
    data: {
      ticketId: id,
      sender: sender || session.user?.name || "Agent",
      content: content.trim(),
      isInternal: isInternal || false,
    },
  })

  // Auto-set firstResponseAt if this is the first non-client, non-internal message
  if (!ticket.firstResponseAt && sender !== "client" && !isInternal) {
    await prisma.supportTicket.update({
      where: { id },
      data: { firstResponseAt: new Date() },
    })
  }

  // Auto-move status from open to in_progress on first agent reply
  if (ticket.status === "open" && sender !== "client" && !isInternal) {
    await prisma.supportTicket.update({
      where: { id },
      data: { status: "in_progress" },
    })
  }

  return NextResponse.json({ message }, { status: 201 })
}
