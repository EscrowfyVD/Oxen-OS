import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { validateSearchParams } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import {
  buildIntentFeedWhere,
  type IntentFeedFilters,
} from "@/lib/intent-feed/query-builder"
import { formatSignal } from "@/lib/intent-feed/format-signal"
import { intentFeedFiltersSchema } from "./_schemas"

/**
 * GET /api/intent-feed — Intent Feed UI consumption endpoint.
 *
 * Returns IntentSignal rows enriched with contact/company info,
 * proxy score, and hot-flag — shaped for the /crm/intent-feed page
 * cards. Auth via CRM page access (session-only; no bearer token
 * needed since this is a UI-internal route).
 *
 * Sort + hot_only behavior:
 *   - sort=date_desc → DB-side ORDER BY createdAt DESC, then paginate
 *     via Prisma skip/take. Cheap.
 *   - sort=proxy_score_desc → fetch ALL matching rows (hard cap 500
 *     enforced by Prisma `take`), sort in-memory by proxyScore, then
 *     slice for pagination. V1 stand-in until Phase 3 priorityScore
 *     lands as a real DB column.
 *   - hot_only=true → applied AFTER format (proxyScore is the gate),
 *     in-memory. With low volume (V1: < 500 signals total), this is
 *     fine. Total count reflects the post-filter set, so hasMore is
 *     truthful for the UI.
 */
export async function GET(request: Request) {
  const log = childLoggerFromRequest(request).child({ route: "intent-feed" })

  const { error: authErr } = await requirePageAccess("crm")
  if (authErr) return authErr

  const { searchParams } = new URL(request.url)
  const v = validateSearchParams(searchParams, intentFeedFiltersSchema)
  if ("error" in v) return v.error
  const filters = v.data

  const where = buildIntentFeedWhere({
    source: filters.source,
    signalTypeCode: filters.signal_type_code,
    dateFrom: filters.date_from,
    dateTo: filters.date_to,
    group: filters.group,
    status: filters.status,
  } satisfies IntentFeedFilters)

  try {
    // For proxy-score sort or hot_only filter, we need the full
    // matching set in memory. Hard cap at 500 to keep memory bounded
    // until Phase 3 moves the math DB-side.
    const isInMemoryPath = filters.sort === "proxy_score_desc" || filters.hot_only
    const take = isInMemoryPath ? 500 : filters.limit
    const skip = isInMemoryPath ? 0 : filters.offset

    const rows = await prisma.intentSignal.findMany({
      where,
      include: {
        contact: {
          include: {
            company: {
              select: { id: true, name: true, country: true },
            },
          },
        },
        company: {
          select: { id: true, name: true, country: true },
        },
        signalTypeRef: {
          select: {
            id: true,
            code: true,
            label: true,
            category: true,
            defaultPoints: true,
            decayDays: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    })

    let formatted = rows.map((r) => formatSignal(r))

    // In-memory ops — order matters: filter first (cheaper), then sort.
    if (filters.hot_only) {
      formatted = formatted.filter((s) => s.isHot)
    }
    if (filters.sort === "proxy_score_desc") {
      formatted.sort((a, b) => b.proxyScore - a.proxyScore)
    }

    const total = isInMemoryPath
      ? formatted.length
      : await prisma.intentSignal.count({ where })

    const page = isInMemoryPath
      ? formatted.slice(filters.offset, filters.offset + filters.limit)
      : formatted

    return NextResponse.json({
      signals: page,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total,
        hasMore: filters.offset + page.length < total,
      },
      filters_applied: {
        source: filters.source ?? null,
        signal_type_code: filters.signal_type_code ?? null,
        date_from: filters.date_from ?? null,
        date_to: filters.date_to ?? null,
        group: filters.group ?? null,
        hot_only: filters.hot_only,
        status: filters.status ?? "all",
        sort: filters.sort,
      },
    })
  } catch (err) {
    log.error({ err: serializeError(err) }, "intent-feed fetch failed")
    return NextResponse.json(
      { error: "Failed to fetch intent feed" },
      { status: 500 },
    )
  }
}
