/* ── Finance Module Design Tokens & Constants ── */

export const CARD_BG = "#0F1118"
export const CARD_BORDER = "rgba(255,255,255,0.06)"
export const TEXT_PRIMARY = "#F0F0F2"
export const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
export const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
export const ROSE_GOLD = "#C08B88"
export const GREEN = "#34D399"
export const AMBER = "#FBBF24"
export const INDIGO = "#818CF8"
export const RED = "#F87171"
export const CYAN = "#22D3EE"
export const TEAL = "#2DD4BF"

/* ── Entity list ── */
export const ENTITIES = [
  { id: "oxen", label: "Oxen" },
  { id: "escrowfy", label: "Escrowfy" },
  { id: "galaktika", label: "Galaktika" },
  { id: "lapki", label: "Lapki" },
]

/* ── Type colors ── */
export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  revenue: { bg: "rgba(52,211,153,0.12)", text: GREEN },
  expense: { bg: "rgba(192,139,136,0.12)", text: ROSE_GOLD },
  budget:  { bg: "rgba(129,140,248,0.12)", text: INDIGO },
}

/* ── Revenue categories ── */
export const REVENUE_CATEGORIES = [
  { id: "client_fees", label: "Client Fees" },
  { id: "exchange_spread", label: "Exchange Spread" },
  { id: "card_interchange", label: "Card Interchange" },
  { id: "other_revenue", label: "Other Revenue" },
]

/* ── Expense / Budget categories ── */
export const EXPENSE_CATEGORIES = [
  { id: "salaries", label: "Salaries" },
  { id: "office", label: "Office" },
  { id: "tech_infra", label: "Tech Infrastructure" },
  { id: "legal", label: "Legal" },
  { id: "compliance", label: "Compliance" },
  { id: "marketing", label: "Marketing" },
  { id: "travel", label: "Travel" },
  { id: "licenses", label: "Licenses" },
  { id: "contractors", label: "Contractors" },
  { id: "banking_fees", label: "Banking Fees" },
  { id: "insurance", label: "Insurance" },
  { id: "other_expense", label: "Other Expense" },
]

/* ── Payment sources ── */
export const PAYMENT_SOURCES = [
  { id: "bank_transfer", label: "Bank Transfer" },
  { id: "card", label: "Card" },
  { id: "crypto", label: "Crypto" },
  { id: "cash", label: "Cash" },
]

/* ── Account types ── */
export const ACCOUNT_TYPES = [
  { id: "operating", label: "Operating" },
  { id: "savings", label: "Savings" },
  { id: "escrow", label: "Escrow" },
  { id: "card", label: "Card" },
]

/* ── Transaction statuses ── */
export const TX_STATUSES = [
  { id: "confirmed", label: "Confirmed" },
  { id: "pending", label: "Pending" },
  { id: "reconciled", label: "Reconciled" },
]

/* ── All categories lookup ── */
export const ALL_CATEGORIES: Record<string, string> = {}
for (const c of REVENUE_CATEGORIES) ALL_CATEGORIES[c.id] = c.label
for (const c of EXPENSE_CATEGORIES) ALL_CATEGORIES[c.id] = c.label

export function getCategoryLabel(id: string): string {
  return ALL_CATEGORIES[id] || id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getCategoriesForType(type: string) {
  if (type === "revenue") return REVENUE_CATEGORIES
  return EXPENSE_CATEGORIES
}

/* ── Chart colors ── */
export const CHART_COLORS = {
  revenue: GREEN,
  expense: ROSE_GOLD,
  budget: INDIGO,
  grid: "rgba(255,255,255,0.04)",
  axis: TEXT_TERTIARY,
}

/* ── Donut palette ── */
export const DONUT_COLORS = [
  ROSE_GOLD, INDIGO, AMBER, GREEN, CYAN, TEAL, RED, "#A78BFA", "#F472B6", "#FB923C",
]

/* ── Format currency ── */
export function fmt(val: number, prefix = "\u20AC"): string {
  const abs = Math.abs(val)
  const sign = val < 0 ? "-" : ""
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${prefix}${abs.toFixed(0)}`
}

export function fmtFull(val: number, prefix = "\u20AC"): string {
  const sign = val < 0 ? "-" : ""
  return `${sign}${prefix}${Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/* ── Shared label style ── */
export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 6,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
}

/* ── Month helpers ── */
export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function getMonthOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    options.push({ value: val, label })
  }
  return options
}

export function getPrevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
