/* ── Finance Module Shared Types ── */

export interface FinanceEntry {
  id: string
  type: string
  category: string
  description: string | null
  amount: number
  currency: string
  date: string
  entity: string
  recurring: boolean
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface FinanceGoal {
  id: string
  metric: string
  target: number
  entity: string
  period: string
  createdBy: string
  createdAt: string
}

export interface FinanceSummary {
  month: string
  revenue: number
  expenses: number
  netProfit: number
  burnRate: number
  monthlyTrend: Array<{
    month: string
    revenue: number
    expense: number
    profit: number
  }>
  expensesByCategory: Array<{
    category: string
    amount: number
  }>
  revenueByCategory: Array<{
    category: string
    amount: number
  }>
  budgetVsActual: Array<{
    category: string
    budget: number
    actual: number
    variance: number
  }>
}

export interface EntryFormData {
  type: string
  category: string
  description: string
  amount: string
  currency: string
  date: string
  entity: string
  recurring: boolean
  notes: string
}

export interface BudgetLine {
  category: string
  amount: number
}
