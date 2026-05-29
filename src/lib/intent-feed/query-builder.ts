// Build a Prisma `IntentSignalWhereInput` from validated filter params.
//
// Split out of the route handler so unit tests can assert each filter
// branch in isolation (status + group joins to CrmContact through the
// `contact` relation, which is the only non-obvious bit).

import { Prisma, type CrmGroup } from "@prisma/client"

export interface IntentFeedFilters {
  source?: string | string[]
  signalTypeCode?: string
  dateFrom?: string // ISO
  dateTo?: string // ISO
  group?: string
  /** Sprint 3d Option C — single-select P1/P2/P3/Monitor. */
  priorityLevel?: string
  hotOnly?: boolean // applied in-memory post-fetch (relies on proxyScore)
  status?: "actioned" | "unactioned" | "all"
}

export function buildIntentFeedWhere(
  filters: IntentFeedFilters,
): Prisma.IntentSignalWhereInput {
  const where: Prisma.IntentSignalWhereInput = {}

  // Source — single value or multi-select. The webhook writers use
  // free-strings ("trigify", "clay", "api/signals"), no enum.
  if (filters.source) {
    if (Array.isArray(filters.source) && filters.source.length > 0) {
      where.source = { in: filters.source }
    } else if (typeof filters.source === "string") {
      where.source = filters.source
    }
  }

  // Signal type — joined via SignalTypeRegistry.code through the
  // `signalTypeRef` relation, NOT via the denormalized `signalType`
  // string column. The registry code is the canonical key; the legacy
  // string was kept for back-compat by Sprint S1 (see schema comment).
  if (filters.signalTypeCode) {
    where.signalTypeRef = { code: filters.signalTypeCode }
  }

  // Date range — anchored on createdAt (which doubles as occurredAt
  // per the schema comment at IntentSignal.createdAt).
  if (filters.dateFrom || filters.dateTo) {
    const range: Prisma.DateTimeFilter = {}
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom)
    if (filters.dateTo) range.lte = new Date(filters.dateTo)
    where.createdAt = range
  }

  // Group + priorityLevel — both live on CrmContact and target the same
  // `where.contact` relation object. Setting them sequentially via `=`
  // would overwrite each other; merge into a single object so they
  // AND together. Signals with no contact (company-only) are excluded
  // when either filter is active — matches the operator intent
  // ("show me G1 signals at P1").
  if (filters.group || filters.priorityLevel) {
    const contactFilter: Prisma.CrmContactWhereInput = {}
    if (filters.group) contactFilter.group = filters.group as CrmGroup
    if (filters.priorityLevel) contactFilter.priorityLevel = filters.priorityLevel
    where.contact = contactFilter
  }

  // Status — relies on the `metadata.actioned_at` JSON path written
  // by the Mark Actioned endpoint. `unactioned` = path is null OR
  // missing (the JSON path operator returns null for missing keys).
  if (filters.status === "actioned") {
    where.metadata = {
      path: ["actioned_at"],
      not: Prisma.JsonNull,
    }
  } else if (filters.status === "unactioned") {
    where.metadata = {
      path: ["actioned_at"],
      equals: Prisma.JsonNull,
    }
  }
  // "all" or undefined → no status filter

  return where
}
