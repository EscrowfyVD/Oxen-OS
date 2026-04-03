/* ── Finance Module Shared Types ── */

/* Legacy entry type (kept for backward compat) */
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

/* New transaction type */
export interface FinanceTransaction {
  id: string
  type: string
  category: string
  description: string | null
  amount: number
  currency: string
  exchangeRate: number | null
  amountEur: number | null
  date: string
  entity: string
  recurring: boolean
  recurringPeriod: string | null
  paymentSource: string | null
  bankAccountName: string | null
  reference: string | null
  status: string
  reimbursable: boolean
  reimbursedTo: string | null
  reimbursedDate: string | null
  contactId: string | null
  contact?: { id: string; name: string; company: string | null } | null
  attachmentUrl: string | null
  attachmentName: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface FinanceBudget {
  id: string
  category: string
  amount: number
  month: string
  entityId: string
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface BankAccount {
  id: string
  name: string
  bankName: string
  currency: string
  iban: string | null
  accountType: string
  entity: string
  currentBalance: number
  lastUpdated: string
  isActive: boolean
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
  totalAccounts: number
  totalBalance: number
}

export interface TransactionFormData {
  type: string
  category: string
  description: string
  amount: string
  currency: string
  exchangeRate: string
  date: string
  entity: string
  recurring: boolean
  recurringPeriod: string
  paymentSource: string
  bankAccountName: string
  reference: string
  status: string
  reimbursable: boolean
  reimbursedTo: string
  contactId: string
  notes: string
}

export interface BudgetLine {
  category: string
  amount: number
}

/* Legacy entry form (kept for old EntryModal) */
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
