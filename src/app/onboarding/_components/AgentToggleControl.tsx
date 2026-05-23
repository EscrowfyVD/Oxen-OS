"use client"

// Live takeover / hand-back control (SP16-003 Slice 2).
//
// Wraps the agent_active state into a clickable button. Mirrors the
// SignalCardActions pattern from intent-feed:
//   - inflight boolean guards against double-click + drives the
//     disabled state + the "…" label transition
//   - hybrid optimistic UI: flip the displayed state immediately on
//     click, then refetch the consolidated GET to settle on truth
//   - rollback the optimistic flip on error + surface a clear inline
//     message
//
// No confirm dialog: the action is reversible in one click and the
// labels themselves ("Take over conversation" / "Hand back to agent")
// carry the weight per Vernon's decision.

import { useState } from "react"
import { CRM_COLORS } from "@/lib/crm-config"

interface AgentToggleControlProps {
  sessionId: string
  /** Canonical agent_active from the latest consolidated GET. */
  agentActive: boolean
  /** Refetch the consolidated session (used to settle the hybrid flow). */
  onAfterAction: () => Promise<void> | void
}

const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const CARD_BORDER = CRM_COLORS.card_border

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 6,
  background: "transparent",
  border: `1px solid ${CARD_BORDER}`,
  color: TEXT2,
  fontSize: 12,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
  transition: "background 120ms, border-color 120ms",
}

const dotStyle = (active: boolean): React.CSSProperties => ({
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: active ? "#34D399" : "#6B7280",
})

export default function AgentToggleControl({
  sessionId,
  agentActive,
  onAfterAction,
}: AgentToggleControlProps) {
  const [optimisticActive, setOptimisticActive] = useState<boolean | null>(null)
  const [inflight, setInflight] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Display the optimistic value while a request is inflight ; fall
  // back to the canonical prop value the moment the override clears.
  const displayActive = optimisticActive ?? agentActive

  async function toggle() {
    if (inflight) return
    const newActive = !displayActive
    setOptimisticActive(newActive)
    setInflight(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/oca/sessions/${encodeURIComponent(sessionId)}/agent`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `Toggle failed (HTTP ${res.status})`
        setErrorMsg(msg)
        setOptimisticActive(null) // rollback
        return
      }
      // Hybrid : refetch the consolidated session so the canonical
      // agent_active + new audit row reach the UI. Clearing the
      // optimistic override AFTER awaiting onAfterAction means the
      // canonical prop is in place by the time we re-render.
      await onAfterAction()
      setOptimisticActive(null)
    } catch {
      setErrorMsg("Network error toggling agent")
      setOptimisticActive(null)
    } finally {
      setInflight(false)
    }
  }

  // Button label per Vernon's decision: action-verb framing carries
  // the safety in place of a confirm dialog.
  const buttonLabel = inflight
    ? "…"
    : displayActive
      ? "Take over conversation"
      : "Hand back to agent"

  const stateLabel = displayActive ? "Agent active" : "Agent idle"

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        onClick={toggle}
        disabled={inflight}
        aria-label={displayActive ? "Take over conversation" : "Hand back to agent"}
        title={buttonLabel}
        style={{
          ...buttonStyle,
          opacity: inflight ? 0.6 : 1,
          cursor: inflight ? "default" : "pointer",
        }}
      >
        <span aria-hidden style={dotStyle(displayActive)} />
        <span>{stateLabel}</span>
        <span style={{ color: TEXT3 }}>·</span>
        <span style={{ color: CRM_COLORS.rose_gold, fontWeight: 500 }}>{buttonLabel}</span>
      </button>
      {!displayActive && !errorMsg && (
        <span style={{ fontSize: 10, color: TEXT3, fontStyle: "italic" }}>
          (you are in control)
        </span>
      )}
      {errorMsg && (
        <span style={{ fontSize: 10, color: "#F87171" }}>{errorMsg}</span>
      )}
    </div>
  )
}
