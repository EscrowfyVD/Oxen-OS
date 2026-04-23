import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateSearchParams } from "@/lib/validate"
import { serializeMoney, sumDecimals } from "@/lib/decimal"
import { reportsQuery } from "../_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, reportsQuery)
  if ("error" in vq) return vq.error
  const { type: reportType, entity, dateFrom, dateTo } = vq.data

  const now = new Date()
  const startDate = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), 0, 1)
  const endDate = dateTo ? new Date(dateTo + "T23:59:59Z") : now

  const entityWhere: Record<string, unknown> = {}
  if (entity && entity !== "all") entityWhere.entity = entity

  if (reportType === "pnl") {
    return buildPnLReport(startDate, endDate, entityWhere)
  }

  if (reportType === "cashflow") {
    return buildCashFlowReport(startDate, endDate, entityWhere)
  }

  if (reportType === "entity_comparison") {
    return buildEntityComparison(startDate, endDate)
  }

  return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
}

async function buildPnLReport(startDate: Date, endDate: Date, entityWhere: Record<string, unknown>) {
  const transactions = await prisma.financeTransaction.findMany({
    where: { ...entityWhere, date: { gte: startDate, lte: endDate } },
    select: { type: true, category: true, amount: true, amountEur: true, date: true },
  })

  // Group by month
  const months: Record<string, { revenue: Record<string, number>; expenses: Record<string, number> }> = {}

  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`
    if (!months[key]) months[key] = { revenue: {}, expenses: {} }
    // Sprint 3.2 — serialize Decimal to number at the aggregation boundary.
    const amt = serializeMoney(tx.amountEur ?? tx.amount) ?? 0
    if (tx.type === "revenue") {
      months[key].revenue[tx.category] = (months[key].revenue[tx.category] || 0) + amt
    } else {
      months[key].expenses[tx.category] = (months[key].expenses[tx.category] || 0) + amt
    }
  }

  // Collect all categories
  const revCats = new Set<string>()
  const expCats = new Set<string>()
  for (const m of Object.values(months)) {
    Object.keys(m.revenue).forEach((c) => revCats.add(c))
    Object.keys(m.expenses).forEach((c) => expCats.add(c))
  }

  const monthKeys = Object.keys(months).sort()

  const pnl = monthKeys.map((month) => {
    const m = months[month]
    const totalRevenue = Object.values(m.revenue).reduce((s, v) => s + v, 0)
    const totalExpenses = Object.values(m.expenses).reduce((s, v) => s + v, 0)
    return {
      month,
      revenue: m.revenue,
      totalRevenue,
      expenses: m.expenses,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
    }
  })

  // Totals
  const totalRevenue = pnl.reduce((s, p) => s + p.totalRevenue, 0)
  const totalExpenses = pnl.reduce((s, p) => s + p.totalExpenses, 0)

  return NextResponse.json({
    report: {
      type: "pnl",
      period: { from: startDate, to: endDate },
      revenueCategories: Array.from(revCats),
      expenseCategories: Array.from(expCats),
      months: pnl,
      totals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
      },
    },
  })
}

async function buildCashFlowReport(startDate: Date, endDate: Date, entityWhere: Record<string, unknown>) {
  const transactions = await prisma.financeTransaction.findMany({
    where: { ...entityWhere, date: { gte: startDate, lte: endDate } },
    select: { type: true, amount: true, amountEur: true, date: true, paymentSource: true },
    orderBy: { date: "asc" },
  })

  // Group by month
  const months: Record<string, { inflow: number; outflow: number; bySource: Record<string, number> }> = {}

  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`
    if (!months[key]) months[key] = { inflow: 0, outflow: 0, bySource: {} }
    // Sprint 3.2 — serialize Decimal to number at the aggregation boundary.
    const amt = serializeMoney(tx.amountEur ?? tx.amount) ?? 0
    if (tx.type === "revenue") months[key].inflow += amt
    else months[key].outflow += amt
    const src = tx.paymentSource || "other"
    months[key].bySource[src] = (months[key].bySource[src] || 0) + amt
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { isActive: true, ...(Object.keys(entityWhere).length ? entityWhere : {}) },
  })
  // Sprint 3.2 — aggregate in Decimal precision, then convert once at the boundary.
  const currentCash = serializeMoney(sumDecimals(accounts.map((a) => a.currentBalance))) ?? 0

  const monthKeys = Object.keys(months).sort()
  let runningBalance = currentCash
  // Walk backwards to compute historical balance
  const monthBalances = monthKeys.map((m) => {
    const d = months[m]
    const net = d.inflow - d.outflow
    return { month: m, inflow: d.inflow, outflow: d.outflow, net, bySource: d.bySource }
  })

  return NextResponse.json({
    report: {
      type: "cashflow",
      period: { from: startDate, to: endDate },
      currentCash,
      months: monthBalances,
      totalInflow: monthBalances.reduce((s, m) => s + m.inflow, 0),
      totalOutflow: monthBalances.reduce((s, m) => s + m.outflow, 0),
    },
  })
}

async function buildEntityComparison(startDate: Date, endDate: Date) {
  const entities = ["oxen", "escrowfy", "galaktika", "lapki"]

  const results = await Promise.all(
    entities.map(async (entity) => {
      const [rev, exp] = await Promise.all([
        prisma.financeTransaction.aggregate({
          where: { entity, type: "revenue", date: { gte: startDate, lte: endDate } },
          _sum: { amountEur: true, amount: true },
        }),
        prisma.financeTransaction.aggregate({
          where: { entity, type: "expense", date: { gte: startDate, lte: endDate } },
          _sum: { amountEur: true, amount: true },
        }),
      ])

      // Sprint 3.2 — serialize Decimals at the entity boundary.
      const revenue = serializeMoney(rev._sum.amountEur ?? rev._sum.amount) ?? 0
      const expenses = serializeMoney(exp._sum.amountEur ?? exp._sum.amount) ?? 0

      const accounts = await prisma.bankAccount.findMany({
        where: { entity, isActive: true },
      })
      const cashBalance = serializeMoney(sumDecimals(accounts.map((a) => a.currentBalance))) ?? 0

      return {
        entity,
        revenue,
        expenses,
        netProfit: revenue - expenses,
        margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
        cashBalance,
      }
    })
  )

  return NextResponse.json({
    report: {
      type: "entity_comparison",
      period: { from: startDate, to: endDate },
      entities: results,
    },
  })
}
