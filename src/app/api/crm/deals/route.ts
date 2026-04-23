import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { STAGE_PROBABILITY, getOwnerForGeo } from "@/lib/crm-config"
import { validateBody, validateSearchParams } from "@/lib/validate"
import { serializeMoney } from "@/lib/decimal"
import { createDealSchema, listDealsQuery } from "../_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, listDealsQuery)
  if ("error" in vq) return vq.error
  const { stage, dealOwner, vertical, companyId, contactId, search } = vq.data
  const sortBy = vq.data.sortBy || "createdAt"
  const sortDir = vq.data.sortDir || "desc"

  const where: Record<string, unknown> = {}

  if (stage && stage !== "all") {
    where.stage = stage
  }
  if (dealOwner && dealOwner !== "all") {
    where.dealOwner = dealOwner
  }
  if (vertical && vertical !== "all") {
    where.vertical = { has: vertical }
  }
  if (companyId) {
    where.companyId = companyId
  }
  if (contactId) {
    where.contactId = contactId
  }
  if (search) {
    where.OR = [
      { dealName: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ]
  }

  const deals = await prisma.deal.findMany({
    where,
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          companyId: true,
          outreachGroup: true,
        },
      },
      company: {
        select: { id: true, name: true, domain: true },
      },
    },
    orderBy: { [sortBy]: sortDir },
  })

  // Sprint 3.2 — serialize Decimal fields for JSON (frontend reducers expect number).
  return NextResponse.json({
    deals: deals.map((d) => ({
      ...d,
      dealValue: serializeMoney(d.dealValue),
      weightedValue: serializeMoney(d.weightedValue),
    })),
  })
}

export async function POST(request: Request) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const v = await validateBody(request, createDealSchema)
  if ("error" in v) return v.error
  const {
    dealName, contactId, companyId, stage: rawStage,
    dealValue, dealOwner, acquisitionSource, acquisitionSourceDetail,
    vertical, expectedCloseDate, kycStatus,
    introducerId, conferenceName, notes,
  } = v.data

  // Verify contact exists
  const contact = await prisma.crmContact.findUnique({ where: { id: contactId } })
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  const userId = session.user?.email ?? "unknown"
  const stage = rawStage ?? "new_lead"

  // Auto-set winProbability from stage
  const winProbability = STAGE_PROBABILITY[stage] ?? 0.05

  // Compute weightedValue — Zod already coerced dealValue to number (or null)
  const numericValue = dealValue ?? null
  const weightedValue = numericValue != null ? numericValue * winProbability : null

  // Auto-assign owner from geoZone if not provided
  const owner = dealOwner ?? getOwnerForGeo(contact.geoZone)

  const deal = await prisma.deal.create({
    data: {
      dealName,
      contactId,
      companyId: companyId ?? contact.companyId ?? null,
      stage,
      dealValue: numericValue,
      dealOwner: owner,
      acquisitionSource: acquisitionSource ?? contact.acquisitionSource ?? null,
      acquisitionSourceDetail: acquisitionSourceDetail ?? contact.acquisitionSourceDetail ?? null,
      vertical: vertical ?? contact.vertical ?? [],
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      winProbability,
      weightedValue,
      kycStatus: kycStatus ?? "not_started",
      introducerId: introducerId ?? null,
      conferenceName: conferenceName ?? null,
      notes: notes ?? null,
      createdBy: userId,
      stageChangedAt: new Date(),
    },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      company: {
        select: { id: true, name: true },
      },
    },
  })

  // Update company active deals count
  if (deal.companyId) {
    const activeCount = await prisma.deal.count({
      where: {
        companyId: deal.companyId,
        stage: { notIn: ["closed_won", "closed_lost"] },
      },
    })
    await prisma.company.update({
      where: { id: deal.companyId },
      data: { activeDealsCount: activeCount },
    })
  }

  // Create activity
  await prisma.activity.create({
    data: {
      type: "stage_change",
      description: `Deal created: "${dealName}" at stage ${stage}`,
      contactId,
      dealId: deal.id,
      performedBy: userId,
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      entityType: "deal",
      entityId: deal.id,
      action: "created",
      performedBy: userId,
    },
  })

  // Sprint 3.2 — serialize Decimal fields on the returned deal.
  return NextResponse.json(
    {
      deal: {
        ...deal,
        dealValue: serializeMoney(deal.dealValue),
        weightedValue: serializeMoney(deal.weightedValue),
      },
    },
    { status: 201 },
  )
}
