"use client"

import { useState, useMemo } from "react"
import { CRM_COLORS } from "@/lib/crm-config"
import type { IntentFeedSignalView } from "./types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const CARD_BORDER = CRM_COLORS.card_border

interface SendTelegramModalProps {
  signal: IntentFeedSignalView
  onClose: () => void
  onSuccess: (message: string) => void
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

const modalStyle: React.CSSProperties = {
  background: "var(--modal-bg)",
  border: `1px solid ${CARD_BORDER}`,
  borderTop: `2px solid ${ROSE}`,
  borderRadius: 16,
  padding: 24,
  width: 560,
  maxHeight: "88vh",
  overflowY: "auto",
  color: TEXT,
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: TEXT3,
  fontFamily: "'DM Sans', sans-serif",
  marginBottom: 4,
}

/**
 * Client-side equivalent of buildHotSignalMessage from the server lib.
 * Lives here (not imported) so the textarea pre-fill is plain text the
 * user can edit — server re-renders with full HTML escaping on send if
 * the user leaves the textarea empty.
 *
 * Why duplicate the template? Two reasons:
 *   1. The user edits this string — the rendered HTML <b> tags would
 *      be confusing in the textarea (they'd see literal "<b>X</b>").
 *   2. If the user clears the textarea, we fall through to the server
 *      template — which has the canonical HTML output. So both paths
 *      remain in sync at the boundary: textarea = plain readable;
 *      empty textarea = server canonical.
 */
function buildPlainTextPreview(signal: IntentFeedSignalView): string {
  const headline = signal.contact?.name || signal.company?.name || "Unknown lead"
  const lines: string[] = []
  lines.push(`🚨 Hot signal — ${headline}`)
  lines.push("")
  if (signal.company?.name) {
    const country = signal.company.country ? ` · ${signal.company.country}` : ""
    lines.push(`Company: ${signal.company.name}${country}`)
  }
  if (signal.contact?.jobTitle) lines.push(`Title: ${signal.contact.jobTitle}`)
  if (signal.contact?.group) lines.push(`Group: ${signal.contact.group}`)
  lines.push(`Signal: ${signal.signalTypeLabel} (${signal.points} pt)`)
  lines.push(`Source: ${signal.source}`)
  if (signal.detail) {
    lines.push("")
    lines.push(signal.detail)
  }
  if (signal.contact?.linkedinUrl) {
    lines.push("")
    lines.push(`LinkedIn: ${signal.contact.linkedinUrl}`)
  }
  lines.push("")
  lines.push("Recommendation: contact within 2h.")
  return lines.join("\n")
}

export default function SendTelegramModal({
  signal,
  onClose,
  onSuccess,
}: SendTelegramModalProps) {
  const defaultMessage = useMemo(() => buildPlainTextPreview(signal), [signal])
  const [message, setMessage] = useState(defaultMessage)
  const [submitting, setSubmitting] = useState(false)

  async function handleSend() {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/intent-feed/send-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal_id: signal.id,
          // Only send custom_message if the user edited it; otherwise
          // omit so the server falls through to its canonical HTML
          // template (the textarea preview is plain text for editing).
          custom_message: message !== defaultMessage ? message : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        onSuccess(`Failed: ${data.error || "Unknown error"}`)
        return
      }
      onSuccess(`Telegram sent to ${data.succeeded}/${data.sent_to} BDs`)
    } catch {
      onSuccess("Network error sending Telegram")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2
          style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 20,
            margin: "0 0 6px 0",
          }}
        >
          Send Telegram broadcast
        </h2>
        <p
          style={{
            fontSize: 11,
            color: TEXT3,
            marginTop: 0,
            marginBottom: 14,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Recipients: all BDs configured in <code>CRM_BD_EMAILS</code>
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Message (edit before sending)</label>
          <textarea
            style={{
              width: "100%",
              minHeight: 200,
              background: "var(--bg-input)",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 8,
              padding: "10px 12px",
              color: TEXT,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
              resize: "vertical",
              lineHeight: 1.5,
            }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 8,
              padding: "8px 16px",
              color: TEXT2,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={submitting || message.trim().length === 0}
            style={{
              background: ROSE,
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              color: "#1A1A1A",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: submitting || !message.trim() ? "default" : "pointer",
              opacity: submitting || !message.trim() ? 0.5 : 1,
            }}
          >
            {submitting ? "Sending…" : "Send to all BDs"}
          </button>
        </div>
      </div>
    </div>
  )
}
