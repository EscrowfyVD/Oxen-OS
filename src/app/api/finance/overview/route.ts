import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month")
  const entity = searchParams.get("entity")

  const now = new Date()
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [year, mon] = targetMonth.split("-").map(Number)

  const monthStart = new Date(year, mon - 1, 1)
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999)

  const entityWhere: Record<string, unknown> = {}
  if (entity && entity !== "all") entityWhere.entity = entity

  // Current month aggregates from new FinanceTransaction model
  const [monthRevenue, monthExpenses] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: { ...entityWhere, type: "revenue", date: { gte: monthStart, lte: monthEnd } },
      _sum: { amountEur: true, amount: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { ...entityWhere, type: "expense", date: { gte: monthStart, lte: monthEnd } },
      _sum: { amountEur: true, amount: true },
    }),
  ])

  const revenue = monthRevenue._sum.amountEur ?? monthRevenue._sum.amount ?? 0
  const expenses = monthExpenses._sum.amountEur ?? monthExpenses._sum.amount ?? 0
  const netProfit = revenue - expenses

  // Last 12 months trend
  const twelveMonthsAgo = new Date(year, mon - 13, 1)
  const allTx = await prisma.financeTransaction.findMany({
    where: {
      ...entityWhere,
      type: { in: ["revenue", "expense"] },
      date: { gte: twelveMonthsAgo, lte: monthEnd },
    },
    select: { type: true, amount: true, amountEur: true, date: true },
  })

  const monthlyTotals: Record<string, { revenue: number; expense: number }> = {}
  for (const t of allTx) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`
    if (!monthlyTotals[key]) monthlyTotals[key] = { revenue: 0, expense: 0 }
    const amt = t.amountEur ?? t.amount
    if (t.type === "revenue") monthlyTotals[key].revenue += amt
    else monthlyTotals[key].expense += amt
  }

  const monthlyTrend = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ month: m, revenue: v.revenue, expense: v.expense, profit: v.revenue - v.expense }))

  // Burn rate (3-month average)
  const threeMonthsAgo = new Date(year, mon - 4, 1)
  const recentExp = await prisma.financeTransaction.aggregate({
    where: { ...entityWhere, type: "expense", date: { gte: threeMonthsAgo, lte: monthEnd } },
    _sum: { amountEur: true, amount: true },
  })
  const burnRate = (recentExp._sum.amountEur ?? recentExp._sum.amount ?? 0) / 3

  // Category breakdowns
  const [expensesByCat, revenueByCat] = await Promise.all([
    prisma.financeTransaction.groupBy({
      by: ["category"],
      where: { ...entityWhere, type: "expense", date: { gte: monthStart, lte: monthEnd } },
      _sum: { amountEur: true, amount: true },
      orderBy: { _sum: { amountEur: "desc" } },
    }),
    prisma.financeTransaction.groupBy({
      by: ["category"],
      where: { ...entityWhere, type: "revenue", date: { gte: monthStart, lte: monthEnd } },
      _sum: { amountEur: true, amount: true },
      orderBy: { _sum: { amountEur: "desc" } },
    }),
  ])

  // Budget vs actual
  const budgetWhere: Record<string, unknown> = { month: targetMonth }
  if (entity && entity !== "all") budgetWhere.entityId = entity
  const budgets = await prisma.financeBudget.findMany({ where: budgetWhere })
  const budgetMap: Record<string, number> = {}
  for (const b of budgets) budgetMap[b.category] = (budgetMap[b.category] || 0) + b.amount

  const expenseMap: Record<string, number> = {}
  for (const e of expensesByCat) expenseMap[e.category] = e._sum.amountEur ?? e._sum.amount ?? 0

  const allCats = new Set([...Object.keys(budgetMap), ...Object.keys(expenseMap)])
  const budgetVsActual = Array.from(allCats).map((cat) => ({
    category: cat,
    budget: budgetMap[cat] || 0,
    actual: expenseMap[cat] || 0,
    variance: (budgetMap[cat] || 0) - (expenseMap[cat] || 0),
  }))

  // Bank accounts summary
  const accounts = await prisma.bankAccount.findMany({
    where: { isActive: true, ...(entity && entity !== "all" ? { entity } : {}) },
  })
  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0)

  return NextResponse.json({
    summary: {
      month: targetMonth,
      revenue,
      expenses,
      netProfit,
      burnRate,
      monthlyTrend,
      expensesByCategory: expensesByCat.map((e) => ({
        category: e.category,
        amount: e._sum.amountEur ?? e._sum.amount ?? 0,
      })),
      revenueByCategory: revenueByCat.map((r) => ({
        category: r.category,
        amount: r._sum.amountEur ?? r._sum.amount ?? 0,
      })),
      budgetVsActual,
      totalAccounts: accounts.length,
      totalBalance,
    },
  })
}
