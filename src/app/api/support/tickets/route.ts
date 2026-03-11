import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const category = searchParams.get("category")
  const channel = searchParams.get("channel")
  const assignedTo = searchParams.get("assignedTo")
  const search = searchParams.get("search")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")

  const where: Record<string, unknown> = {}
  if (status && status !== "all") where.status = status
  if (priority && priority !== "all") where.priority = priority
  if (category && category !== "all") where.category = category
  if (channel && channel !== "all") where.channel = channel
  if (assignedTo && assignedTo !== "all") where.assignedTo = assignedTo
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
    ]
  }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo && { lte: new Date(dateTo + "T23:59:59Z") }),
    }
  }

  const tickets = await prisma.supportTicket.findMany({
    where,
    include: {
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ tickets })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { subject, clientName, clientEmail, channel, category, priority, assignedTo, contactId, initialMessage } = body

  if (!subject || !clientName || !channel) {
    return NextResponse.json({ error: "subject, clientName, and channel are required" }, { status: 400 })
  }

  const userId = session.user?.id ?? session.user?.email ?? "unknown"

  const ticket = await prisma.supportTicket.create({
    data: {
      subject,
      clientName,
      clientEmail: clientEmail || null,
      channel,
      category: category || null,
      priority: priority || "medium",
      assignedTo: assignedTo || null,
      contactId: contactId || null,
      createdBy: userId,
      ...(initialMessage && {
        messages: {
          create: {
            sender: "client",
            content: initialMessage,
            isInternal: false,
          },
        },
      }),
    },
    include: { messages: true },
  })

  return NextResponse.json({ ticket }, { status: 201 })
}
