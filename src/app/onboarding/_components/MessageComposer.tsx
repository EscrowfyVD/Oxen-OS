"use client"

// Operator message composer (SP16-003 Slice 3).
//
// Lives inline below the ChatPanel transcript. Posts to
// /api/oca/sessions/[id]/messages → OCA appends a sender="operator"
// message to the chat. Hybrid optimistic UI: a pending bubble appears
// in the transcript IMMEDIATELY on send ; on success the canonical
// message replaces it via the refetch ; on error the bubble shows
// the error so the operator can decide what to do (the pending
// bubble stays visible until the operator dismisses it — see
// onDismissPending).
//
// No confirm dialog — the compose-then-send sequence is the safety
// (the operator types, reviews, then clicks Send).
//
// 5000-char cap mirrors the OCA upstream operatorMessageSchema cap
// so a too-long message fails fast with the local 400 before we
// burn a round-trip on a guaranteed OCA reject.

import { useState } from "react"
import { CRM_COLORS } from "@/lib/crm-config"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const CARD_BORDER = CRM_COLORS.card_border

const MAX_LEN = 5000 // matches OCA operatorMessageSchema cap

export interface PendingMessage {
  tempId: string
  content: string
  error: string | null
}

export interface PendingMessageActions {
  /** Append a new optimistic bubble to the transcript. */
  add: (tempId: string, content: string) => void
  /** Remove an optimistic bubble (after canonical lands via refetch). */
  remove: (tempId: string) => void
  /** Mark an optimistic bubble as failed (network / OCA error). */
  setError: (tempId: string, error: string) => void
}

interface MessageComposerProps {
  sessionId: string
  pendingActions: PendingMessageActions
  /** Refetch the consolidated session (the hybrid-flow settle step). */
  onAfterAction: () => Promise<void> | void
}

export default function MessageComposer({
  sessionId,
  pendingActions,
  onAfterAction,
}: MessageComposerProps) {
  const [content, setContent] = useState("")
  const [inflight, setInflight] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const trimmedLen = content.trim().length
  const tooLong = content.length > MAX_LEN
  const canSend = !inflight && trimmedLen > 0 && !tooLong

  async function send() {
    if (!canSend) return
    const messageBody = content
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Optimistic UI: pending bubble in the transcript + clear composer.
    pendingActions.add(tempId, messageBody)
    setContent("")
    setInflight(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/oca/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: messageBody }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `Send failed (HTTP ${res.status})`
        pendingActions.setError(tempId, msg)
        setErrorMsg(msg)
        return
      }
      // Hybrid: refetch the consolidated session → the canonical
      // message lands in chat.messages. THEN drop the optimistic
      // bubble (so the operator never sees the message disappear).
      await onAfterAction()
      pendingActions.remove(tempId)
    } catch {
      const msg = "Network error sending message"
      pendingActions.setError(tempId, msg)
      setErrorMsg(msg)
    } finally {
      setInflight(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: `1px solid ${CARD_BORDER}`,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Reply as operator…"
        rows={3}
        maxLength={MAX_LEN + 100 /* allow paste-overflow → caller sees tooLong */}
        disabled={inflight}
        style={{
          width: "100%",
          minHeight: 72,
          maxHeight: 240,
          padding: "8px 10px",
          background: "var(--bg-input)",
          border: `1px solid ${tooLong ? "#F87171" : CARD_BORDER}`,
          borderRadius: 8,
          color: TEXT,
          fontSize: 12,
          lineHeight: 1.5,
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
          opacity: inflight ? 0.6 : 1,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 10, color: tooLong ? "#F87171" : TEXT3 }}>
          {content.length}/{MAX_LEN}
        </span>
        {errorMsg && (
          <span style={{ fontSize: 10, color: "#F87171", flex: 1 }}>
            {errorMsg}
          </span>
        )}
        <span style={{ flex: errorMsg ? 0 : 1 }} />
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          style={{
            padding: "6px 14px",
            background: canSend ? ROSE : "transparent",
            border: `1px solid ${canSend ? ROSE : CARD_BORDER}`,
            borderRadius: 6,
            color: canSend ? "#0F1118" : TEXT2,
            fontSize: 12,
            fontWeight: 600,
            cursor: canSend ? "pointer" : "default",
            fontFamily: "inherit",
            opacity: inflight ? 0.6 : 1,
          }}
        >
          {inflight ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  )
}
