/**
 * Telegram BD broadcast on P-level promotion (Sprint 3d B3).
 *
 * Recon D3 — this runs CALLER-SIDE (recompute-runner, recalculate
 * route, recalculate-all route), NOT inside persistScore. Three reasons:
 *
 *   1. persistScore returns {previousLevel, newLevel, promoted} (D7)
 *      — the handoff is the whole point of that contract.
 *   2. Fire-and-forget alerts MUST NOT roll back ScoreHistory. A
 *      Telegram outage shouldn't poison the score persistence.
 *   3. Keeps persistScore unit tests pure (no Telegram mocks).
 *
 * Gating logic (Sprint 3d recon Finding 10):
 *   - Promotion only — `nextRank > prevRank` (treats null prev as Monitor).
 *   - Destination must be P1 or P2 — P3 promotions are intentionally
 *     silent in V1 (otherwise the daily cron would spam BDs whenever a
 *     new signal nudges a contact from Monitor to P3).
 *   - Demotion / same-level / → Excluded → no alert (ScoreHistory row
 *     is the audit trail).
 *
 * Errors are swallowed per-recipient — one BD with a stale chat_id
 * doesn't block the other two.
 *
 * Refs:
 *   - src/lib/trigify-alerts.ts (pattern source)
 *   - src/lib/telegram.ts:93-114 (notifyEmployee)
 *   - PRD-004 §7
 */

import { notifyEmployee } from "@/lib/telegram"
import { formatPromotionAlert } from "./format-promotion-alert"
import { logger } from "@/lib/logger"

const log = logger.child({ component: "alert-on-promotion" })

// Mirrors persist-score.ts:64-74 — keep both in sync.
const LEVEL_RANK: Record<string, number> = {
  Excluded: -1,
  Monitor: 0,
  P3: 1,
  P2: 2,
  P1: 3,
}

const ALERTABLE_DESTINATIONS = new Set(["P1", "P2"])

export interface PromotionAlertContact {
  id: string
  firstName?: string | null
  lastName?: string | null
  /** Pulled from the related Company.name when available. */
  companyName?: string | null
  /** Canonical jurisdiction (Company.country preferred, contact.country fallback). */
  jurisdiction?: string | null
}

export interface PromotionScoreContext {
  score: number
  signalCount: number
  /** Optional — up to 3 signal codes for the alert body. */
  topSignals?: string[]
}

export interface PromotionAlertResult {
  alerted: boolean
  recipients: number
  failures: number
  reason?: string
}

function parseBdEmails(): string[] {
  return (process.env.CRM_BD_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Pure gating predicate — exported for test brevity.
 * Returns true iff this transition warrants a Telegram broadcast.
 */
export function shouldAlertOnPromotion(
  previousLevel: string | null,
  newLevel: string,
): boolean {
  if (newLevel === "Excluded") return false
  if (!ALERTABLE_DESTINATIONS.has(newLevel)) return false
  const prevRank = LEVEL_RANK[previousLevel ?? "Monitor"] ?? 0
  const nextRank = LEVEL_RANK[newLevel] ?? 0
  return nextRank > prevRank
}

export async function alertBDsOnPromotion(
  contact: PromotionAlertContact,
  previousLevel: string | null,
  newLevel: string,
  scoreContext: PromotionScoreContext,
): Promise<PromotionAlertResult> {
  if (!shouldAlertOnPromotion(previousLevel, newLevel)) {
    return {
      alerted: false,
      recipients: 0,
      failures: 0,
      reason: "no_promotion_gate",
    }
  }

  const bdEmails = parseBdEmails()
  if (bdEmails.length === 0) {
    log.warn("CRM_BD_EMAILS empty — promotion alert skipped")
    return {
      alerted: false,
      recipients: 0,
      failures: 0,
      reason: "no_bd_emails",
    }
  }

  const personName =
    `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown"
  const message = formatPromotionAlert({
    personName,
    companyName: contact.companyName ?? "Unknown",
    jurisdiction: contact.jurisdiction ?? "—",
    previousLevel,
    newLevel,
    score: scoreContext.score,
    signalCount: scoreContext.signalCount,
    contactId: contact.id,
    topSignals: scoreContext.topSignals,
  })

  const results = await Promise.all(
    bdEmails.map(async (email) => {
      try {
        const ok = await notifyEmployee(email, message)
        if (!ok) {
          log.warn({ email }, "promotion alert delivery returned false")
        }
        return ok
      } catch (err) {
        log.error({ email, err: String(err) }, "promotion alert threw")
        return false
      }
    }),
  )

  const successes = results.filter(Boolean).length
  return {
    alerted: successes > 0,
    recipients: bdEmails.length,
    failures: bdEmails.length - successes,
  }
}
