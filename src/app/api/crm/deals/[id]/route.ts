import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          companyId: true,
          lifecycleStage: true,
          contactType: true,
          geoZone: true,
          relationshipStrength: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
          domain: true,
          industry: true,
          hqCountry: true,
          geoZone: true,
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      tasks: {
        where: { status: { not: "cancelled" } },
        orderBy: { dueDate: "asc" },
      },
    },
  })

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  return NextResponse.json({ deal })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const { id } = await params

  const existing = await prisma.deal.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  const body = await request.json()
  const userId = session.user?.email ?? "unknown"

  // If dealValue or winProbability changes, recalculate weightedValue
  const newDealValue = body.dealValue !== undefined
    ? (body.dealValue != null ? parseFloat(body.dealValue) : null)
    : existing.dealValue
  const newWinProbability = body.winProbability !== undefined
    ? body.winProbability
    : existing.winProbability

  if (body.dealValue !== undefined || body.winProbability !== undefined) {
    body.weightedValue =
      newDealValue != null && newWinProbability != null
        ? newDealValue * newWinProbability
        : null
  }

  // Parse numeric fields
  if (body.dealValue !== undefined && body.dealValue != null) {
    body.dealValue = parseFloat(body.dealValue)
  }
  if (body.expectedCloseDate !== undefined && body.expectedCloseDate != null) {
    body.expectedCloseDate = new Date(body.expectedCloseDate)
  }

  const deal = await prisma.deal.update({
    where: { id },
    data: body,
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      company: {
        select: { id: true, name: true },
      },
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      entityType: "deal",
      entityId: id,
      action: "updated",
      performedBy: userId,
    },
  })

  return NextResponse.json({ deal })
}
