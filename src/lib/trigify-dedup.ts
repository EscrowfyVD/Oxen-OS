// Day-level idempotence helper for the Trigify webhook
// (Sprint Trigify Phase 2A).
//
// Trigify's "Last week" Time Frame rescans 7 days every run. With the
// "Linkedin oxen" workflow firing every 12h on a 24h look-back window,
// any signal observed in that window gets re-posted on the next run.
// Without dedup, every engagement would create 2 IntentSignal rows per
// day (and trigger 2 BD Telegram alerts for the hot signal codes).
//
// Dedup window: UTC calendar day, anchored on the signal's createdAt
// (which the webhook anchors on payload.signal_date — see route.ts).
// Match key: contactId + signalTypeId + (optionally signal_detail).
//
// Why day-level and not minute-level: Trigify rescans the same event
// up to 7 days later with the same payload. Dedup needs a window
// wider than the rescan frequency (12h) and narrower than a typical
// "different engagement worth tracking" cadence (a week). 24h hits
// that sweet spot and matches the existing Vernon spec.

import { prisma } from "@/lib/prisma"
import type { IntentSignal } from "@prisma/client"

export interface FindExistingSignalArgs {
  contactId: string
  signalTypeId: string
  signalDate: Date
  signalDetail?: string | null
}

/**
 * Returns the first matching IntentSignal in the UTC day surrounding
 * `signalDate`, or null. When `signalDetail` is provided, the match is
 * narrowed to rows whose metadata.signal_detail equals that value —
 * letting two distinct actions (e.g. "Liked post" vs "Commented on
 * post") within the same day coexist when the workflow surfaces the
 * distinction.
 */
export async function findExistingSignal(
  args: FindExistingSignalArgs,
): Promise<IntentSignal | null> {
  const dayStart = new Date(args.signalDate)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const where: Parameters<typeof prisma.intentSignal.findFirst>[0] = {
    where: {
      contactId: args.contactId,
      signalTypeId: args.signalTypeId,
      createdAt: { gte: dayStart, lt: dayEnd },
      ...(args.signalDetail
        ? {
            metadata: {
              path: ["signal_detail"],
              equals: args.signalDetail,
            },
          }
        : {}),
    },
  }

  return prisma.intentSignal.findFirst(where)
}
