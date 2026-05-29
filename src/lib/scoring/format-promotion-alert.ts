/**
 * Render the Telegram HTML alert body for a P-level promotion.
 *
 * Pure helper — Sprint 3d B3. Splitting the render off from the
 * dispatch lets the alert module fan out without re-doing escaping
 * per recipient, and lets tests assert the exact rendered string
 * given fixed input (deterministic).
 *
 * Style mirrors `src/lib/trigify-alerts.ts:63-72` (HTML parse mode,
 * <b>Label</b>: value lines, escaped on all interpolated strings,
 * unescaped URL pass-through, blank-line separators, closing
 * "Recommendation: contact within 2h." that matches the existing
 * hot-signal alert language).
 *
 * Refs:
 *   - Sprint 3d recon Finding 11 (format proposal)
 *   - PRD-004 §7 (BD alert triggers)
 */

import { escHtml } from "@/lib/telegram"

export interface PromotionAlertArgs {
  personName: string
  companyName: string
  /** Canonical English jurisdiction string (e.g. "Cyprus", "Singapore"). */
  jurisdiction: string
  /** null when the contact has never been scored before. */
  previousLevel: string | null
  newLevel: string
  score: number
  signalCount: number
  contactId: string
  /** Up to 3 signal codes; optional. */
  topSignals?: string[]
}

/**
 * Lead emoji varies by destination level — visual priority cue for
 * the BD scanning Telegram on their phone.
 *   🚀 P1 — act now
 *   ⬆  P2 — schedule today
 *   📈 anything else (P3 in particular — though current spec gates
 *       alerts at P1/P2 only)
 */
function emojiFor(level: string): string {
  if (level === "P1") return "🚀"
  if (level === "P2") return "⬆"
  return "📈"
}

export function formatPromotionAlert(args: PromotionAlertArgs): string {
  const prev = args.previousLevel ?? "Monitor"
  const topLine =
    args.topSignals && args.topSignals.length > 0
      ? `\n<b>Top signals</b>: ${args.topSignals.map(escHtml).join(", ")}`
      : ""

  return [
    `${emojiFor(args.newLevel)} <b>PROMOTION — ${escHtml(args.personName)}</b>`,
    `<b>Company</b>: ${escHtml(args.companyName)} (${escHtml(args.jurisdiction)})`,
    `<b>Level</b>: ${escHtml(prev)} → <b>${escHtml(args.newLevel)}</b>`,
    `<b>Score</b>: ${args.score} · <b>Signals</b>: ${args.signalCount}${topLine}`,
    `<b>Open</b>: https://os.oxen.finance/crm/contact/${args.contactId}`,
    ``,
    `Recommendation: contact within 2h.`,
  ].join("\n")
}
