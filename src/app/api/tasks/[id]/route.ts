import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { title, description, tag, priority, assignee, deadline, column, order, supportTicketId, contactId } = body

  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(tag !== undefined && { tag }),
      ...(priority !== undefined && { priority }),
      ...(assignee !== undefined && { assignee }),
      ...(deadline !== undefined && {
        deadline: deadline ? new Date(deadline) : null,
      }),
      ...(column !== undefined && { column }),
      ...(order !== undefined && { order }),
      ...(supportTicketId !== undefined && { supportTicketId: supportTicketId || null }),
      ...(contactId !== undefined && { contactId: contactId || null }),
    },
  })

  // Log when task moves to done
  if (column === "done" && existing.column !== "done") {
    const userId = session.user?.email ?? "unknown"
    logActivity("task_completed", `Task completed — ${task.title}`, userId, id, `/tasks`)
  }

  return NextResponse.json({ task })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  await prisma.task.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
