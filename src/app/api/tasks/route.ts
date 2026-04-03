import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tag = searchParams.get("tag")
  const assignee = searchParams.get("assignee")
  const view = searchParams.get("view") // "all" | "my" | "support"

  const where: Record<string, unknown> = {}

  if (tag && tag !== "all") {
    where.tag = tag
  }

  if (assignee) {
    where.assignee = assignee
  }

  if (view === "support") {
    where.tag = "support"
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      supportTicket: { select: { id: true, subject: true, clientName: true, status: true } },
      contact: { select: { id: true, firstName: true, lastName: true, company: { select: { id: true, name: true } } } },
    },
    orderBy: [{ column: "asc" }, { order: "asc" }],
  })

  return NextResponse.json({ tasks })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, tag, priority, assignee, deadline, column, supportTicketId, contactId } = body

  if (!title || !tag) {
    return NextResponse.json(
      { error: "Missing required fields: title, tag" },
      { status: 400 }
    )
  }

  const userId = session.user?.email ?? "unknown"

  const task = await prisma.task.create({
    data: {
      title,
      description: description ?? null,
      tag,
      priority: priority ?? "medium",
      assignee: assignee ?? null,
      deadline: deadline ? new Date(deadline) : null,
      column: column ?? "todo",
      supportTicketId: supportTicketId ?? null,
      contactId: contactId ?? null,
      createdBy: userId,
    },
  })

  logActivity("task_created", `Task created — ${title}`, userId, task.id, `/tasks`)

  return NextResponse.json({ task }, { status: 201 })
}
