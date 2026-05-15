// Telegram alert dispatcher for hot Trigify signals
// (Sprint Trigify Phase 2A).
//
// On selected high-intent signal codes (see IMMEDIATE_ALERT_SIGNAL_CODES
// in src/lib/trigify-signal-mapping.ts), the Trigify webhook broadcasts
// a formatted message to every BD email listed in CRM_BD_EMAILS.
//
// Design choices:
//   - Broadcast to ALL BDs rather than route to a single owner. Phase
//     2A skips Company.assignedBdId; ownership routing is V2.
//   - Failures are swallowed (logged only). The webhook returns 200
//     regardless of alert success so Trigify does not retry on
//     Telegram-side outages.
//   - HTML escape via escHtml() on all variable interpolations to
//     protect against Telegram parse errors when names/titles contain
//     `<`, `>`, or `&`.

import { notifyEmployee, escHtml } from "@/lib/telegram"
import { shouldAlertImmediately } from "@/lib/trigify-signal-mapping"
import type { TrigifyWebhookPayload } from "@/app/api/webhooks/_schemas"

export interface AlertContactContext {
  id: string
  firstName: string
  lastName: string
  companyName?: string | null
}

function parseBdEmails(): string[] {
  return (process.env.CRM_BD_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function buildAlertMessage(
  signalCode: string,
  payload: TrigifyWebhookPayload,
  contact: AlertContactContext,
): string {
  const personName = escHtml(
    payload.person_name ??
      payload.name ??
      (`${contact.firstName} ${contact.lastName}`.trim() || "Unknown"),
  )
  const companyName = escHtml(
    payload.company_name ??
      payload.company ??
      contact.companyName ??
      "Unknown",
  )
  const signalDetail = escHtml(
    payload.signal_detail ??
      payload.detail ??
      payload.signal_type ??
      "engagement",
  )
  const competitor = payload.competitor_name
    ? ` <i>(via ${escHtml(payload.competitor_name)})</i>`
    : ""
  const linkedinUrl = payload.person_linkedin_url ?? ""

  const lines = [
    `🚨 <b>Hot signal — ${personName}</b>${competitor}`,
    ``,
    `<b>Company</b>: ${companyName}`,
    `<b>Action</b>: ${signalDetail}`,
    `<b>Type</b>: ${escHtml(signalCode)}`,
  ]
  if (linkedinUrl) lines.push(`<b>LinkedIn</b>: ${linkedinUrl}`)
  lines.push(``, `Recommandation: contact within 2h.`)
  return lines.join("\n")
}

/**
 * Broadcast a Telegram alert to every CRM_BD_EMAILS recipient when the
 * resolved signal code is in the immediate-alert set. No-op for other
 * codes. Never throws — caller can `await` without try/catch.
 */
export async function maybeAlertBDs(
  signalCode: string,
  contact: AlertContactContext,
  payload: TrigifyWebhookPayload,
): Promise<{ alerted: boolean; recipients: number; failures: number }> {
  if (!shouldAlertImmediately(signalCode)) {
    return { alerted: false, recipients: 0, failures: 0 }
  }

  const bdEmails = parseBdEmails()
  if (bdEmails.length === 0) {
    console.warn("[trigify] CRM_BD_EMAILS empty, skipping alerts")
    return { alerted: false, recipients: 0, failures: 0 }
  }

  const message = buildAlertMessage(signalCode, payload, contact)

  const results = await Promise.all(
    bdEmails.map(async (email) => {
      try {
        const ok = await notifyEmployee(email, message)
        if (!ok) {
          console.warn(`[trigify] alert delivery returned false for ${email}`)
        }
        return ok
      } catch (err) {
        console.error(`[trigify] alert failed for ${email}:`, err)
        return false
      }
    }),
  )

  const successes = results.filter(Boolean).length
  return {
    alerted: true,
    recipients: bdEmails.length,
    failures: bdEmails.length - successes,
  }
}
