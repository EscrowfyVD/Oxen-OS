"use client"

// Chat transcript + operator composer.
//
// SP16-002 shipped this as read-only (transcript-only). SP16-003 Slice 3
// added the inline operator composer below the transcript + the optimistic
// pending-bubble rendering for messages in flight. Pending bubbles look
// like operator bubbles with reduced opacity and a "Sending…" / "Failed"
// state subtitle. They live alongside the canonical chat.messages and
// disappear once the refetch lands the server-side canonical message.

import { useState } from "react"
import { CRM_COLORS } from "@/lib/crm-config"
import { formatTimestamp } from "./format"
import type { ChatMessage, ChatSummary } from "./detail-types"
import MessageComposer, {
  type PendingMessage,
  type PendingMessageActions,
} from "./MessageComposer"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary

interface BubbleStyle {
  align: "left" | "right" | "center"
  background: string
  border: string
  label: string
  labelColor: string
}

function bubbleStyleFor(role: string): BubbleStyle {
  switch (role) {
    case "user":
      return {
        align: "right",
        background: "rgba(255,255,255,0.04)",
        border: "rgba(255,255,255,0.08)",
        label: "User",
        labelColor: TEXT2,
      }
    case "ai":
      return {
        align: "left",
        background: "rgba(129,140,248,0.08)",
        border: "rgba(129,140,248,0.25)",
        label: "Agent",
        labelColor: "#818CF8",
      }
    case "operator":
      return {
        align: "left",
        background: "rgba(192,139,136,0.10)",
        border: "rgba(192,139,136,0.35)",
        label: "Operator",
        labelColor: "#C08B88",
      }
    case "system":
    default:
      return {
        align: "center",
        background: "transparent",
        border: "rgba(255,255,255,0.06)",
        label: role === "system" ? "System" : role,
        labelColor: TEXT3,
      }
  }
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const s = bubbleStyleFor(msg.role)
  const align =
    s.align === "right" ? "flex-end" : s.align === "left" ? "flex-start" : "center"
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align,
        marginBottom: 12,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: s.align === "center" ? "100%" : "78%",
          padding: s.align === "center" ? "6px 12px" : "10px 14px",
          background: s.background,
          border: `1px solid ${s.border}`,
          borderRadius: s.align === "center" ? 6 : 12,
          fontSize: 12,
          color: TEXT,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {msg.content}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 10,
          color: TEXT3,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span style={{ color: s.labelColor, fontWeight: 600 }}>{s.label}</span>
        {msg.operator_email && (
          <span style={{ color: TEXT3 }}>· {msg.operator_email}</span>
        )}
        <span>· {formatTimestamp(msg.createdAt)}</span>
      </div>
    </div>
  )
}

function PendingBubble({ msg }: { msg: PendingMessage }) {
  // Renders like an operator bubble but with reduced opacity + a
  // "Sending…" or red error subtitle. Stays in the transcript until
  // the operator dismisses it (V1 only auto-removes on success).
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        marginBottom: 12,
        fontFamily: "'DM Sans', sans-serif",
        opacity: msg.error ? 1 : 0.6,
      }}
    >
      <div
        style={{
          maxWidth: "78%",
          padding: "10px 14px",
          background: "rgba(192,139,136,0.10)",
          border: `1px solid ${msg.error ? "#F87171" : "rgba(192,139,136,0.35)"}`,
          borderRadius: 12,
          fontSize: 12,
          color: TEXT,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {msg.content}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 10,
          color: TEXT3,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span style={{ color: "#C08B88", fontWeight: 600 }}>Operator</span>
        <span style={{ color: msg.error ? "#F87171" : TEXT3 }}>
          · {msg.error ?? "Sending…"}
        </span>
      </div>
    </div>
  )
}

export default function ChatPanel({
  chat,
  sessionId,
  onAfterAction,
}: {
  chat: ChatSummary | null
  /** SP16-003 — required for the operator composer to know what
   *  session to POST messages to. */
  sessionId: string
  /** SP16-003 — refetch the consolidated GET after a message lands. */
  onAfterAction: () => Promise<void> | void
}) {
  const [pending, setPending] = useState<PendingMessage[]>([])

  const pendingActions: PendingMessageActions = {
    add: (tempId, content) =>
      setPending((prev) => [...prev, { tempId, content, error: null }]),
    remove: (tempId) =>
      setPending((prev) => prev.filter((p) => p.tempId !== tempId)),
    setError: (tempId, error) =>
      setPending((prev) =>
        prev.map((p) => (p.tempId === tempId ? { ...p, error } : p)),
      ),
  }

  return (
    <div
      style={{
        padding: "16px 18px",
        background: CRM_COLORS.card_bg,
        border: `1px solid ${CRM_COLORS.card_border}`,
        borderRadius: 10,
        fontFamily: "'DM Sans', sans-serif",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: CRM_COLORS.rose_gold,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          fontWeight: 600,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Chat transcript</span>
        {chat && (
          <span style={{ color: TEXT3, fontWeight: 400, letterSpacing: 0 }}>
            {chat.total} {chat.total === 1 ? "message" : "messages"}
          </span>
        )}
      </div>

      {chat?.truncated && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "rgba(192,139,136,0.06)",
            border: "1px solid rgba(192,139,136,0.25)",
            borderRadius: 8,
            fontSize: 11,
            color: TEXT2,
          }}
        >
          Showing the last {chat.messages.length} of {chat.total} messages —
          earlier history truncated by OCA.
        </div>
      )}

      {(!chat || chat.messages.length === 0) && pending.length === 0 ? (
        <div style={{ fontSize: 12, color: TEXT3, fontStyle: "italic" }}>
          No messages
        </div>
      ) : (
        <div
          style={{
            maxHeight: 560,
            overflowY: "auto",
            paddingRight: 6,
          }}
        >
          {chat?.messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
          {pending.map((p) => (
            <PendingBubble key={p.tempId} msg={p} />
          ))}
        </div>
      )}

      <MessageComposer
        sessionId={sessionId}
        pendingActions={pendingActions}
        onAfterAction={onAfterAction}
      />
    </div>
  )
}
