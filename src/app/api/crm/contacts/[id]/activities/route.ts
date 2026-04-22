import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { createActivitySchema, listActivitiesQuery } from "../../../_schemas"

// GET /api/crm/contacts/[id]/activities — paginated list
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, listActivitiesQuery)
  if ("error" in vq) return vq.error
  const { page, limit } = vq.data
  const skip = (page - 1) * limit

  try {
    // Verify contact exists
    const contact = await prisma.crmContact.findUnique({ where: { id }, select: { id: true } })
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: { contactId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.activity.count({ where: { contactId: id } }),
    ])

    return NextResponse.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error("[CRM Activities GET]", err)
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 })
  }
}

// POST /api/crm/contacts/[id]/activities — log new activity
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const { id } = await params

  try {
    // Verify contact exists
    const contact = await prisma.crmContact.findUnique({ where: { id }, select: { id: true, totalInteractions: true } })
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const v = await validateBody(request, createActivitySchema)
    if ("error" in v) return v.error
    const { type, description, dealId, metadata, isPrivate } = v.data

    const userId = session.user?.email ?? "unknown"

    // Create activity and update contact in a transaction
    const [activity] = await prisma.$transaction([
      prisma.activity.create({
        data: {
          type,
          description: description ?? null,
          contactId: id,
          dealId: dealId ?? null,
          metadata: metadata ?? null,
          performedBy: userId,
          isPrivate: isPrivate ?? false,
        },
      }),
      prisma.crmContact.update({
        where: { id },
        data: {
          lastInteraction: new Date(),
          totalInteractions: contact.totalInteractions + 1,
        },
      }),
    ])

    return NextResponse.json({ activity }, { status: 201 })
  } catch (err) {
    console.error("[CRM Activities POST]", err)
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 })
  }
}
