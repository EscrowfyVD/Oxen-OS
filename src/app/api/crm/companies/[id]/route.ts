import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { serializeMoney, sumDecimals } from "@/lib/decimal"
import { updateCompanySchema } from "../../_schemas"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  const { id } = await params

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          lifecycleStage: true,
          contactType: true,
          relationshipStrength: true,
          lastInteraction: true,
        },
        orderBy: { createdAt: "desc" },
      },
      deals: {
        select: {
          id: true,
          dealName: true,
          stage: true,
          dealValue: true,
          weightedValue: true,
          winProbability: true,
          dealOwner: true,
          expectedCloseDate: true,
          stageChangedAt: true,
          daysInCurrentStage: true,
          closedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  // Compute aggregates (Sprint 3.2: sum in Decimal precision, serialize at the boundary).
  const activeDeals = company.deals.filter(
    (d) => d.stage !== "closed_won" && d.stage !== "closed_lost"
  )
  const wonDeals = company.deals.filter((d) => d.stage === "closed_won")
  const totalDealValue = serializeMoney(sumDecimals(company.deals.map((d) => d.dealValue))) ?? 0
  const totalWeightedValue = serializeMoney(sumDecimals(activeDeals.map((d) => d.weightedValue))) ?? 0
  const wonRevenue = serializeMoney(sumDecimals(wonDeals.map((d) => d.dealValue))) ?? 0

  // Sprint 3.2 — serialize Decimal fields on the company + nested deals for JSON.
  const serializedCompany = {
    ...company,
    totalRevenue: serializeMoney(company.totalRevenue) ?? 0,
    deals: company.deals.map((d) => ({
      ...d,
      dealValue: serializeMoney(d.dealValue),
      weightedValue: serializeMoney(d.weightedValue),
    })),
  }

  return NextResponse.json({
    company: serializedCompany,
    aggregates: {
      totalContacts: company.contacts.length,
      activeDealsCount: activeDeals.length,
      totalDeals: company.deals.length,
      totalDealValue,
      totalWeightedValue,
      wonDeals: wonDeals.length,
      wonRevenue,
    },
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: pageErr, session } = await requirePageAccess("crm")
  if (pageErr) return pageErr

  const { id } = await params

  const existing = await prisma.company.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  const v = await validateBody(request, updateCompanySchema)
  if ("error" in v) return v.error
  const body = v.data as Record<string, unknown> & { website?: string | null; domain?: string | null }
  const userId = session.user?.email ?? "unknown"

  // If website is changing, re-extract domain
  let domain = existing.domain
  if (body.website !== undefined && body.website !== existing.website) {
    if (body.website) {
      try {
        let url = body.website.trim()
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`
        const parsed = new URL(url)
        domain = parsed.hostname.replace(/^www\./, "")
      } catch {
        domain = null
      }
    } else {
      domain = null
    }
    body.domain = domain
  }

  const company = await prisma.company.update({
    where: { id },
    data: body,
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      entityType: "company",
      entityId: id,
      action: "updated",
      performedBy: userId,
    },
  })

  // Sprint 3.2 — serialize totalRevenue (Decimal) for JSON.
  return NextResponse.json({
    company: { ...company, totalRevenue: serializeMoney(company.totalRevenue) ?? 0 },
  })
}
