// POST /api/scoring/recalculate — admin single-account recompute.
//
// Sprint 3c B5. Use case : an admin wants to manually re-trigger
// scoring on one account after editing painTierOverride / excludedFrom
// / etc. The cron will eventually catch up, but immediate feedback
// is useful for the UI ("score recomputed — refresh the row").
//
// Auth via requireAdmin (Employee.isAdmin === true). Body :
// { accountId: string }. Response : { accountId, before, after,
// durationMs }.

import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { validateBody } from "@/lib/validate"
import { childLoggerFromRequest, serializeError } from "@/lib/logger"
import { getActiveScoringConfig } from "@/lib/scoring/config-loader"
import { persistScore } from "@/lib/scoring/persist-score"
import { alertBDsOnPromotion } from "@/lib/scoring/alert-on-promotion"

const bodySchema = z.object({
  accountId: z.string().min(1).max(100),
})

export async function POST(request: Request) {
  const log = childLoggerFromRequest(request).child({
    route: "scoring/recalculate",
  })

  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const v = await validateBody(request, bodySchema)
  if ("error" in v) return v.error
  const { accountId } = v.data

  // Snapshot the "before" state for the UI to show a delta. Sprint 3d
  // B3 — also pulls the person + company fields needed for the
  // promotion alert without a second findUnique.
  const before = await prisma.crmContact.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      priorityScore: true,
      priorityLevel: true,
      icpScore: true,
      intentScore: true,
      signalCount: true,
      painTier: true,
      lastScoredAt: true,
      firstName: true,
      lastName: true,
      country: true,
      company: { select: { name: true, country: true } },
    },
  })
  if (!before) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  const start = Date.now()
  try {
    const config = await getActiveScoringConfig()
    const result = await persistScore(accountId, "contact", config)
    const durationMs = Date.now() - start

    // Sprint 3d D3 — fire-and-forget BD alert on promotion. Wrapped in
    // try/catch defensively; alertBDsOnPromotion already swallows
    // per-recipient errors, but a synchronous throw here must not flip
    // the 200 success into a 500.
    if (result.promoted) {
      try {
        await alertBDsOnPromotion(
          {
            id: before.id,
            firstName: before.firstName,
            lastName: before.lastName,
            companyName: before.company?.name ?? null,
            jurisdiction: before.company?.country ?? before.country ?? null,
          },
          result.previousLevel,
          result.newLevel,
          {
            score: result.priorityScore,
            signalCount: result.signalCount,
          },
        )
      } catch (alertErr) {
        log.error(
          { err: serializeError(alertErr), accountId },
          "promotion alert dispatch threw — score persisted regardless",
        )
      }
    }

    log.info(
      {
        accountId,
        adminEmail: auth.employee?.email,
        previousLevel: result.previousLevel,
        newLevel: result.newLevel,
        promoted: result.promoted,
        durationMs,
      },
      "single-account recompute completed",
    )

    return NextResponse.json({
      accountId,
      before,
      after: {
        priorityScore: result.priorityScore,
        priorityLevel: result.newLevel,
        icpScore: result.icpScore,
        intentScore: result.intentScore,
        signalCount: result.signalCount,
        painTier: result.painTier,
        promoted: result.promoted,
        excluded: result.excluded,
        actions: result.actions,
      },
      durationMs,
    })
  } catch (err) {
    log.error(
      { err: serializeError(err), accountId },
      "single-account recompute failed",
    )
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "internal error" },
      { status: 500 },
    )
  }
}
