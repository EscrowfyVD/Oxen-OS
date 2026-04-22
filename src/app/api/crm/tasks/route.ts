import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createTaskSchema, listTasksQuery } from "../_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, listTasksQuery)
  if ("error" in vq) return vq.error
  const { assignee, status, type, contactId, dealId } = vq.data

  const where: Record<string, unknown> = {}
  if (assignee) where.assignee = assignee
  if (status) where.status = status
  if (type) where.type = type
  if (contactId) where.contactId = contactId
  if (dealId) where.dealId = dealId

  const tasks = await prisma.crmTask.findMany({
    where,
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      deal: {
        select: { id: true, dealName: true, stage: true },
      },
    },
    orderBy: { dueDate: "asc" },
  })

  return NextResponse.json({ tasks })
}

export async function POST(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const v = await validateBody(request, createTaskSchema)
  if ("error" in v) return v.error
  const { title, type, priority, dueDate, assignee, contactId, dealId, outcomeNote } = v.data

  const task = await prisma.crmTask.create({
    data: {
      title,
      type,
      priority: priority ?? "medium",
      dueDate: new Date(dueDate),
      assignee,
      contactId: contactId ?? null,
      dealId: dealId ?? null,
      outcomeNote: outcomeNote ?? null,
      createdBy: session.user?.email ?? "unknown",
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

  return NextResponse.json({ task }, { status: 201 })
}
