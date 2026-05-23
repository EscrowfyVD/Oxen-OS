"use client"

// Read-only chat transcript. Bubbles per role (user / ai / operator /
// system). Truncation banner when OCA returned the last-50 cap.

import { CRM_COLORS } from "@/lib/crm-config"
import { formatTimestamp } from "./format"
import type { ChatMessage, ChatSummary } from "./detail-types"

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

export default function ChatPanel({ chat }: { chat: ChatSummary | null }) {
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

      {!chat || chat.messages.length === 0 ? (
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
          {chat.messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
        </div>
      )}
    </div>
  )
}
