import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { updateDealSchema } from "../../_schemas"

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

  const v = await validateBody(request, updateDealSchema)
  if ("error" in v) return v.error
  const body = v.data as Record<string, unknown>
  const userId = session.user?.email ?? "unknown"

  // Zod already coerced dealValue to number|null and validated other fields.
  // Recalculate weightedValue if either dealValue or winProbability changed.
  const newDealValue = body.dealValue !== undefined
    ? (body.dealValue as number | null)
    : existing.dealValue
  const newWinProbability = body.winProbability !== undefined
    ? (body.winProbability as number)
    : existing.winProbability

  if (body.dealValue !== undefined || body.winProbability !== undefined) {
    body.weightedValue =
      newDealValue != null && newWinProbability != null
        ? newDealValue * newWinProbability
        : null
  }

  if (body.expectedCloseDate !== undefined && body.expectedCloseDate != null) {
    body.expectedCloseDate = new Date(body.expectedCloseDate as string)
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
