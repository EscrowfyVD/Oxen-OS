import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateSearchParams } from "@/lib/validate"
import { summaryQuery } from "../_schemas"

export async function GET(request: Request) {
  const { error } = await requirePageAccess("finance")
  if (error) return error

  const { searchParams } = new URL(request.url)
  const vq = validateSearchParams(searchParams, summaryQuery)
  if ("error" in vq) return vq.error
  const { month, entity } = vq.data

  const now = new Date()
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [year, mon] = targetMonth.split("-").map(Number)

  const monthStart = new Date(year, mon - 1, 1)
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999)

  const baseWhere: Record<string, unknown> = {}
  if (entity && entity !== "all") baseWhere.entity = entity

  // Current month revenue
  const monthlyRevenue = await prisma.financeEntry.aggregate({
    where: { ...baseWhere, type: "revenue", date: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
  })

  // Current month expenses
  const monthlyExpenses = await prisma.financeEntry.aggregate({
    where: { ...baseWhere, type: "expense", date: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
  })

  // Last 12 months revenue & expense by month
  const twelveMonthsAgo = new Date(year, mon - 13, 1)
  const allEntries = await prisma.financeEntry.findMany({
    where: {
      ...baseWhere,
      type: { in: ["revenue", "expense"] },
      date: { gte: twelveMonthsAgo, lte: monthEnd },
    },
    select: { type: true, amount: true, date: true },
  })

  const monthlyTotals: Record<string, { revenue: number; expense: number }> = {}
  for (const e of allEntries) {
    const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`
    if (!monthlyTotals[key]) monthlyTotals[key] = { revenue: 0, expense: 0 }
    if (e.type === "revenue") monthlyTotals[key].revenue += e.amount
    else monthlyTotals[key].expense += e.amount
  }

  const monthlyTrend = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ month: m, revenue: v.revenue, expense: v.expense, profit: v.revenue - v.expense }))

  // Burn rate: average expense over last 3 months
  const threeMonthsAgo = new Date(year, mon - 4, 1)
  const recentExpenses = await prisma.financeEntry.aggregate({
    where: { ...baseWhere, type: "expense", date: { gte: threeMonthsAgo, lte: monthEnd } },
    _sum: { amount: true },
  })
  const burnRate = (recentExpenses._sum.amount || 0) / 3

  // Expense breakdown by category (current month)
  const expensesByCategory = await prisma.financeEntry.groupBy({
    by: ["category"],
    where: { ...baseWhere, type: "expense", date: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  })

  // Revenue breakdown by category (current month)
  const revenueByCategory = await prisma.financeEntry.groupBy({
    by: ["category"],
    where: { ...baseWhere, type: "revenue", date: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  })

  // Budget entries for current month
  const budgets = await prisma.financeEntry.findMany({
    where: { ...baseWhere, type: "budget", date: { gte: monthStart, lte: monthEnd } },
    select: { category: true, amount: true },
  })

  // Build P&L: budget vs actual by category
  const budgetMap: Record<string, number> = {}
  for (const b of budgets) {
    budgetMap[b.category] = (budgetMap[b.category] || 0) + b.amount
  }

  const expenseMap: Record<string, number> = {}
  for (const e of expensesByCategory) {
    expenseMap[e.category] = e._sum.amount || 0
  }

  const revenueMap: Record<string, number> = {}
  for (const r of revenueByCategory) {
    revenueMap[r.category] = r._sum.amount || 0
  }

  // All categories that appear in either budget or actual
  const allExpenseCategories = new Set([...Object.keys(budgetMap), ...Object.keys(expenseMap)])
  const budgetVsActual = Array.from(allExpenseCategories).map((cat) => ({
    category: cat,
    budget: budgetMap[cat] || 0,
    actual: expenseMap[cat] || 0,
    variance: (budgetMap[cat] || 0) - (expenseMap[cat] || 0),
  }))

  const summary = {
    month: targetMonth,
    revenue: monthlyRevenue._sum.amount || 0,
    expenses: monthlyExpenses._sum.amount || 0,
    netProfit: (monthlyRevenue._sum.amount || 0) - (monthlyExpenses._sum.amount || 0),
    burnRate,
    monthlyTrend,
    expensesByCategory: expensesByCategory.map((e) => ({
      category: e.category,
      amount: e._sum.amount || 0,
    })),
    revenueByCategory: revenueByCategory.map((r) => ({
      category: r.category,
      amount: r._sum.amount || 0,
    })),
    budgetVsActual,
  }

  return NextResponse.json({ summary })
}
