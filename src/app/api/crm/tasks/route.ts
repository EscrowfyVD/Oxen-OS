import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const assignee = searchParams.get("assignee")
  const status = searchParams.get("status")
  const type = searchParams.get("type")
  const contactId = searchParams.get("contactId")
  const dealId = searchParams.get("dealId")

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

  const body = await request.json()
  const { title, type, priority, dueDate, assignee, contactId, dealId, outcomeNote } = body

  if (!title || !type || !dueDate || !assignee) {
    return NextResponse.json(
      { error: "Missing required fields: title, type, dueDate, assignee" },
      { status: 400 }
    )
  }

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
