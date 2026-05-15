// Build a Telegram broadcast message for an Intent Feed signal.
//
// Mirrors the format produced by src/lib/trigify-alerts.ts (used by the
// trigify webhook auto-broadcast for hot signals) but adapted for the
// UI manual-send path: user-clicked, can be customized in the modal
// before submission. Uses the same escHtml helper from telegram.ts so
// the HTML parse-mode contract stays consistent.

import { escHtml } from "@/lib/telegram"

interface TemplateInputContact {
  name: string
  jobTitle?: string | null
  linkedinUrl?: string | null
  group?: string | null
}

interface TemplateInputCompany {
  name: string
  country?: string | null
}

export interface BuildHotSignalMessageInput {
  signalTypeLabel: string
  signalSource: string
  points: number
  detail?: string | null
  contact?: TemplateInputContact | null
  company?: TemplateInputCompany | null
}

/**
 * Render the default Telegram message for a signal. Caller is free to
 * edit before sending — this is just the pre-fill.
 */
export function buildHotSignalMessage(input: BuildHotSignalMessageInput): string {
  const lines: string[] = []
  const headline = input.contact?.name || input.company?.name || "Unknown lead"
  lines.push(`🚨 <b>Hot signal — ${escHtml(headline)}</b>`)
  lines.push("")

  if (input.company?.name) {
    const country = input.company.country ? ` · ${escHtml(input.company.country)}` : ""
    lines.push(`<b>Company</b>: ${escHtml(input.company.name)}${country}`)
  }
  if (input.contact?.jobTitle) {
    lines.push(`<b>Title</b>: ${escHtml(input.contact.jobTitle)}`)
  }
  if (input.contact?.group) {
    lines.push(`<b>Group</b>: ${escHtml(input.contact.group)}`)
  }
  lines.push(`<b>Signal</b>: ${escHtml(input.signalTypeLabel)} (${input.points} pt)`)
  lines.push(`<b>Source</b>: ${escHtml(input.signalSource)}`)

  if (input.detail) {
    lines.push("")
    lines.push(escHtml(input.detail))
  }

  if (input.contact?.linkedinUrl) {
    lines.push("")
    lines.push(`LinkedIn: ${input.contact.linkedinUrl}`)
  }

  lines.push("")
  lines.push("Recommendation: contact within 2h.")

  return lines.join("\n")
}
