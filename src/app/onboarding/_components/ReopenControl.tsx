"use client"

// Reopen-rejected-session control (SP16-003 Slice 4).
//
// Renders ONLY when the session status === "rejected" (Vernon's
// reopen-gating decision — show-only-when-applicable, don't display
// a disabled button on non-rejected sessions). Clicking opens a
// confirm modal whose text states what happens (the session moves
// back to "review"). On confirm → POST /api/oca/sessions/:id/reopen.
//
// Hybrid optimistic UX: during the inflight we show "Reopening…"
// and disable the button. The refetch lands the canonical
// status="review" → the parent re-renders without this button (the
// status guard above hides it). On error → enable + inline message.
//
// Edge case: OCA-409 (session.status raced — e.g. another operator
// already reopened it). The proxy maps it to 409 status_conflict ;
// the UX is "refresh to see the new state" — the refetch the
// component triggers anyway will settle it.

import { useState } from "react"
import { CRM_COLORS } from "@/lib/crm-config"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const CARD_BORDER = CRM_COLORS.card_border

interface ReopenControlProps {
  sessionId: string
  /** Canonical session.status — used to gate the button visibility. */
  sessionStatus: string
  /** Optional context for the confirm modal copy. */
  legalRepName?: string | null
  companyName?: string | null
  /** Refetch the consolidated session after the reopen lands. */
  onAfterAction: () => Promise<void> | void
}

const buttonStyle: React.CSSProperties = {
  padding: "4px 14px",
  background: "transparent",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 6,
  color: TEXT2,
  fontSize: 12,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
}

// Modal overlay pattern mirrors src/components/crm/ContactModal.tsx
// (centered card with backdrop blur). No new component library —
// inline styles per CLAUDE.md.
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
  borderRadius: 12,
  padding: 24,
  width: 460,
  maxWidth: "calc(100vw - 32px)",
  color: TEXT,
  fontFamily: "'DM Sans', sans-serif",
}

export default function ReopenControl({
  sessionId,
  sessionStatus,
  legalRepName,
  companyName,
  onAfterAction,
}: ReopenControlProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [inflight, setInflight] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Per Vernon's gating decision — only render when applicable.
  if (sessionStatus !== "rejected") return null

  async function confirmReopen() {
    if (inflight) return
    setInflight(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/oca/sessions/${encodeURIComponent(sessionId)}/reopen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `Reopen failed (HTTP ${res.status})`
        setErrorMsg(msg)
        return
      }
      // Hybrid: canonical status="review" lands via the refetch.
      // This component's render returns null on non-rejected statuses,
      // so the modal disappears with it once the refetch settles —
      // no need to setModalOpen(false) manually before unmount.
      await onAfterAction()
    } catch {
      setErrorMsg("Network error reopening session")
    } finally {
      setInflight(false)
    }
  }

  // Build the confirm copy. Fallback gracefully if names absent.
  const subject =
    legalRepName && companyName
      ? `${legalRepName} at ${companyName}`
      : legalRepName ?? companyName ?? "this session"

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMsg(null)
          setModalOpen(true)
        }}
        style={{
          ...buttonStyle,
          borderColor: ROSE,
          color: ROSE,
        }}
        aria-label="Reopen rejected session"
      >
        Reopen →
      </button>

      {modalOpen && (
        <div
          style={overlayStyle}
          onClick={() => !inflight && setModalOpen(false)}
        >
          <div
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 20,
                fontWeight: 400,
                margin: 0,
                marginBottom: 12,
              }}
            >
              Reopen session?
            </h2>
            <p style={{ fontSize: 13, color: TEXT2, lineHeight: 1.5, margin: 0 }}>
              Reopen session for <strong style={{ color: TEXT }}>{subject}</strong>?
              This will move the session from <strong>rejected</strong> back
              to <strong>review</strong> so an operator can re-engage.
            </p>
            {errorMsg && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "#F87171",
                  background: "rgba(248,113,113,0.06)",
                  border: "1px solid rgba(248,113,113,0.35)",
                  borderRadius: 6,
                }}
              >
                {errorMsg}
              </div>
            )}
            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={inflight}
                style={{
                  ...buttonStyle,
                  color: TEXT3,
                  opacity: inflight ? 0.6 : 1,
                  cursor: inflight ? "default" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReopen}
                disabled={inflight}
                style={{
                  ...buttonStyle,
                  background: ROSE,
                  borderColor: ROSE,
                  color: "#0F1118",
                  fontWeight: 600,
                  opacity: inflight ? 0.6 : 1,
                  cursor: inflight ? "default" : "pointer",
                }}
              >
                {inflight ? "Reopening…" : "Reopen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
