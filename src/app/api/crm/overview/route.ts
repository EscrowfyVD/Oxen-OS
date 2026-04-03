import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  // Total active customers (lifecycleStage = "customer")
  const activeCustomers = await prisma.crmContact.count({
    where: { lifecycleStage: "customer" },
  })

  // Total contacts
  const totalContacts = await prisma.crmContact.count()

  // Pipeline value (deals not in won/lost stages)
  const pipelineAgg = await prisma.deal.aggregate({
    where: { stage: { notIn: ["closed_won", "closed_lost"] } },
    _sum: { dealValue: true, weightedValue: true },
  })
  const pipelineValue = pipelineAgg._sum.dealValue ?? 0
  const pipelineWeightedValue = pipelineAgg._sum.weightedValue ?? 0

  // Total deal value for won deals (monthly revenue proxy)
  const wonDealsAgg = await prisma.deal.aggregate({
    where: { stage: "closed_won" },
    _sum: { dealValue: true },
  })
  const monthlyRevenue = wonDealsAgg._sum.dealValue ?? 0

  // Revenue run rate (monthly * 12)
  const revenueRunRate = monthlyRevenue * 12

  // Top customers by deal value (won deals with contact info)
  const topDeals = await prisma.deal.findMany({
    where: { stage: "closed_won", dealValue: { not: null } },
    orderBy: { dealValue: "desc" },
    take: 10,
    select: {
      id: true,
      dealName: true,
      dealValue: true,
      dealOwner: true,
      vertical: true,
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          relationshipStrength: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const topCustomers = topDeals.map((d) => ({
    id: d.contact.id,
    name: `${d.contact.firstName} ${d.contact.lastName}`,
    company: d.company?.name ?? null,
    dealValue: d.dealValue,
    dealOwner: d.dealOwner,
    vertical: d.vertical,
    relationshipStrength: d.contact.relationshipStrength,
  }))

  // Concentration percentages
  const totalTopValue = topCustomers.reduce((s, c) => s + (c.dealValue ?? 0), 0)
  const top1 = topCustomers[0]?.dealValue ?? 0
  const top2to5 = topCustomers.slice(1, 5).reduce((s, c) => s + (c.dealValue ?? 0), 0)
  const top6to10 = topCustomers.slice(5, 10).reduce((s, c) => s + (c.dealValue ?? 0), 0)
  const restValue = monthlyRevenue - top1 - top2to5 - top6to10

  const concentration = {
    top1Pct: monthlyRevenue > 0 ? Math.round((top1 / monthlyRevenue) * 100) : 0,
    top2to5Pct: monthlyRevenue > 0 ? Math.round((top2to5 / monthlyRevenue) * 100) : 0,
    top6to10Pct: monthlyRevenue > 0 ? Math.round((top6to10 / monthlyRevenue) * 100) : 0,
    restPct: monthlyRevenue > 0 ? Math.round((restValue / monthlyRevenue) * 100) : 0,
  }

  // Alerts: at-risk deals
  const atRiskDeals = await prisma.deal.findMany({
    where: {
      stage: { notIn: ["closed_won", "closed_lost"] },
      aiDealHealth: { in: ["needs_attention", "at_risk"] },
    },
    select: {
      id: true,
      dealName: true,
      dealValue: true,
      aiDealHealth: true,
      dealOwner: true,
      stage: true,
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          relationshipStrength: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 10,
    orderBy: { dealValue: "desc" },
  })

  const alerts = atRiskDeals.map((d) => ({
    id: d.id,
    dealName: d.dealName,
    contactName: `${d.contact.firstName} ${d.contact.lastName}`,
    company: d.company?.name ?? null,
    aiDealHealth: d.aiDealHealth,
    dealValue: d.dealValue,
    stage: d.stage,
    dealOwner: d.dealOwner,
  }))

  // Relationship strength distribution for customers
  const relationshipCounts = await prisma.crmContact.groupBy({
    by: ["relationshipStrength"],
    where: { lifecycleStage: "customer" },
    _count: { _all: true },
  })

  return NextResponse.json({
    overview: {
      monthlyRevenue,
      revenueRunRate,
      activeCustomers,
      totalContacts,
      pipelineValue,
      pipelineWeightedValue,
      concentration,
      topCustomers,
      alerts,
      healthDistribution: relationshipCounts.map((h) => ({
        status: h.relationshipStrength,
        count: h._count._all,
      })),
    },
  })
}
