import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"

/**
 * GET /api/signal-types — Active SignalTypeRegistry entries for filter
 * dropdowns (currently the Intent Feed UI; future: Sentinel signal
 * creation forms). Returns only `isActive=true` rows so deprecated
 * placeholders (e.g. `trigify_intent_signal` post-Phase 2A) don't
 * pollute the dropdown.
 *
 * Sorted by code ASC for stable rendering — labels can change without
 * shuffling the dropdown order across deploys.
 */
export async function GET(request: Request) {
  const log = childLoggerFromRequest(request).child({ route: "signal-types" })

  const { error: authErr } = await requirePageAccess("crm")
  if (authErr) return authErr

  try {
    const rows = await prisma.signalTypeRegistry.findMany({
      where: { isActive: true },
      select: {
        code: true,
        label: true,
        category: true,
        defaultPoints: true,
      },
      orderBy: { code: "asc" },
    })

    return NextResponse.json({ signal_types: rows })
  } catch (err) {
    log.error({ err: serializeError(err) }, "signal-types fetch failed")
    return NextResponse.json(
      { error: "Failed to fetch signal types" },
      { status: 500 },
    )
  }
}
