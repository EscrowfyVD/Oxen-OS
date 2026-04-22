import { z } from "zod"

/**
 * Schemas de validation Zod pour le module Finance.
 *
 * Convention :
 * - Un schema par opération (pas par modèle Prisma)
 * - Les montants sont en `number` (aligné sur `Float` DB actuel — Sprint 3 passera à Decimal)
 * - Les dates acceptent ISO 8601 datetime OU "YYYY-MM-DD" (date-only)
 * - Enums restreints aux valeurs connues pour durcir en amont
 * - Les schemas d'update utilisent `.partial()` (standard PATCH)
 */

// ─────────────────────────────────────────────────────────────
// Primitives communes
// ─────────────────────────────────────────────────────────────

const moneyAmount = z
  .number()
  .finite()
  .refine((n) => Math.abs(n) < 1e12, "Amount out of realistic range")

const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be a 3-letter ISO currency code (e.g. EUR, USD)")

/** ISO 8601 datetime OR "YYYY-MM-DD" — large enough for the mixed usage in routes. */
const isoDate = z.union([
  z.string().datetime({ offset: true }),
  z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/),
])

/** "YYYY-MM" format for budget month grouping. */
const monthYYYYMM = z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM")

const entryType = z.enum(["revenue", "expense", "budget"])
const txType = z.enum(["revenue", "expense"])
const txStatus = z.enum(["confirmed", "pending", "reconciled"])
const accountType = z.enum(["operating", "savings", "escrow", "card"])
const recurringPeriod = z.enum(["monthly", "quarterly", "yearly"])
const sortDir = z.enum(["asc", "desc"])
const reportType = z.enum(["pnl", "cashflow", "entity_comparison"])

// ─────────────────────────────────────────────────────────────
// FinanceEntry (POST /finance, PATCH /finance/[id])
// ─────────────────────────────────────────────────────────────

export const createFinanceEntrySchema = z.object({
  type: entryType,
  category: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  amount: moneyAmount,
  currency: currencyCode.default("EUR"),
  date: isoDate,
  entity: z.string().min(1).max(50).default("oxen"),
  recurring: z.boolean().optional(),
  notes: z.string().max(5000).nullish(),
})

export const updateFinanceEntrySchema = createFinanceEntrySchema.partial()

export const listFinanceEntriesQuery = z.object({
  type: z.string().optional(),
  category: z.string().optional(),
  entity: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.string().max(50).optional(),
  sortDir: sortDir.optional(),
})

// ─────────────────────────────────────────────────────────────
// BankAccount (POST /finance/accounts, PATCH /finance/accounts/[id])
// ─────────────────────────────────────────────────────────────

export const createBankAccountSchema = z.object({
  name: z.string().min(1).max(200),
  bankName: z.string().min(1).max(200),
  currency: currencyCode.default("EUR"),
  iban: z.string().max(50).nullish(),
  accountType: accountType.default("operating"),
  entity: z.string().min(1).max(50).default("oxen"),
  currentBalance: moneyAmount.optional(),
  notes: z.string().max(2000).nullish(),
})

export const updateBankAccountSchema = createBankAccountSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })

export const listBankAccountsQuery = z.object({
  entity: z.string().optional(),
  active: z.string().optional(),
})

// ─────────────────────────────────────────────────────────────
// FinanceTransaction (POST /finance/transactions, PATCH /finance/transactions/[id])
// ─────────────────────────────────────────────────────────────

export const createFinanceTransactionSchema = z.object({
  type: txType,
  category: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  amount: moneyAmount,
  currency: currencyCode.default("EUR"),
  exchangeRate: z.number().positive().finite().optional(),
  date: isoDate,
  entity: z.string().min(1).max(50).default("oxen"),
  recurring: z.boolean().optional(),
  recurringPeriod: recurringPeriod.nullish(),
  paymentSource: z.string().max(50).nullish(),
  bankAccountName: z.string().max(200).nullish(),
  reference: z.string().max(200).nullish(),
  status: txStatus.default("confirmed"),
  reimbursable: z.boolean().optional(),
  reimbursedTo: z.string().max(200).nullish(),
  contactId: z.string().max(50).nullish(),
  notes: z.string().max(5000).nullish(),
})

export const updateFinanceTransactionSchema = createFinanceTransactionSchema
  .partial()
  .extend({
    attachmentUrl: z.string().url().nullish(),
    attachmentName: z.string().max(200).nullish(),
    reimbursedDate: isoDate.nullish(),
  })

export const listFinanceTransactionsQuery = z.object({
  type: z.string().optional(),
  category: z.string().optional(),
  entity: z.string().optional(),
  status: z.string().optional(),
  paymentSource: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.string().max(50).optional(),
  sortDir: sortDir.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
})

// ─────────────────────────────────────────────────────────────
// FinanceBudget (POST /finance/budgets)
// ─────────────────────────────────────────────────────────────

export const upsertBudgetsSchema = z.object({
  month: monthYYYYMM,
  entityId: z.string().max(50).optional(),
  items: z
    .array(
      z.object({
        category: z.string().min(1).max(100),
        amount: moneyAmount,
        notes: z.string().max(2000).optional(),
      })
    )
    .min(0),
})

export const budgetsQuery = z.object({
  month: monthYYYYMM,
  entity: z.string().max(50).optional(),
})

// ─────────────────────────────────────────────────────────────
// FinanceEntry "budget" type via /finance/budget (legacy)
// ─────────────────────────────────────────────────────────────

export const replaceBudgetsSchema = z.object({
  month: monthYYYYMM,
  entity: z.string().max(50).optional(),
  items: z
    .array(
      z.object({
        category: z.string().min(1).max(100),
        amount: moneyAmount,
      })
    )
    .min(0),
})

export const budgetQuery = z.object({
  month: monthYYYYMM,
  entity: z.string().max(50).optional(),
})

// ─────────────────────────────────────────────────────────────
// FinanceGoal (POST /finance/goals)
// ─────────────────────────────────────────────────────────────

export const createFinanceGoalSchema = z.object({
  metric: z.string().min(1).max(100),
  target: moneyAmount,
  entity: z.string().max(50).optional(),
  period: z.string().min(1).max(50),
})

export const listGoalsQuery = z.object({
  period: z.string().max(50).optional(),
  entity: z.string().max(50).optional(),
})

// ─────────────────────────────────────────────────────────────
// Bulk imports
// ─────────────────────────────────────────────────────────────

/**
 * /finance/bulk — CSV/Excel import: rows are loosely typed strings,
 * the route parses/validates each row. We only validate the envelope here.
 */
export const bulkFinanceEntriesEnvelope = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1).max(10000),
})

/** /finance/transactions/bulk — typed array of partial transactions. */
export const bulkTransactionsEnvelope = z.object({
  entries: z
    .array(
      z.object({
        type: z.string().min(1),
        category: z.string().min(1),
        description: z.string().optional(),
        amount: z.union([z.number(), z.string()]),
        currency: z.string().optional(),
        date: z.string().min(1),
        entity: z.string().optional(),
        paymentSource: z.string().optional(),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .min(1)
    .max(10000),
})

// ─────────────────────────────────────────────────────────────
// Summaries / reports (GET query params)
// ─────────────────────────────────────────────────────────────

export const summaryQuery = z.object({
  month: monthYYYYMM.optional(),
  entity: z.string().max(50).optional(),
})

export const overviewQuery = z.object({
  month: monthYYYYMM.optional(),
  entity: z.string().max(50).optional(),
})

export const reportsQuery = z.object({
  type: reportType.default("pnl"),
  entity: z.string().max(50).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const exportTransactionsQuery = z.object({
  entity: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})
