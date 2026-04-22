import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { updateTaskSchema } from "../../_schemas"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const { id } = await params
  const v = await validateBody(request, updateTaskSchema)
  if ("error" in v) return v.error
  const { title, type, priority, dueDate, assignee, status, outcomeNote, contactId, dealId } = v.data

  const existing = await prisma.crmTask.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  const isCompleting = status === "completed" && existing.status !== "completed"

  const task = await prisma.crmTask.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(type !== undefined && { type }),
      ...(priority !== undefined && { priority }),
      ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
      ...(assignee !== undefined && { assignee }),
      ...(status !== undefined && { status }),
      ...(outcomeNote !== undefined && { outcomeNote }),
      ...(contactId !== undefined && { contactId: contactId || null }),
      ...(dealId !== undefined && { dealId: dealId || null }),
      ...(isCompleting && { completedAt: new Date() }),
    },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      deal: {
        select: { id: true, dealName: true, stage: true },
      },
    },
  })

  // Create an activity log entry when completing a task
  if (isCompleting) {
    try {
      await prisma.activity.create({
        data: {
          type: "task_completed",
          description: `Task completed: ${task.title}${outcomeNote ? ` — ${outcomeNote}` : ""}`,
          contactId: task.contactId,
          dealId: task.dealId,
          performedBy: session.user?.email ?? "unknown",
          metadata: {
            taskId: task.id,
            taskType: task.type,
            outcomeNote: task.outcomeNote,
          },
        },
      })
    } catch (e) {
      console.error("Failed to create task completion activity:", e)
    }
  }

  return NextResponse.json({ task })
}
