"use client"

// Operator audit timeline — read-only V1 (SP16-003 adds the action
// surface that produces these). Renders nothing-cluttering when the
// audit list is empty.

import { CRM_COLORS } from "@/lib/crm-config"
import { formatTimestamp } from "./format"
import type { AuditEvent } from "./detail-types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary

function renderDetails(details: AuditEvent["details"]): string {
  if (!details) return ""
  if (typeof details === "string") return details
  try {
    const json = JSON.stringify(details)
    return json.length > 200 ? json.slice(0, 200) + "…" : json
  } catch {
    return ""
  }
}

export default function AuditPanel({ events }: { events: AuditEvent[] }) {
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
        }}
      >
        Operator audit
      </div>

      {events.length === 0 ? (
        <div style={{ fontSize: 12, color: TEXT3, fontStyle: "italic" }}>
          No operator actions yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {events.map((ev) => (
            <div
              key={ev.id}
              style={{
                paddingLeft: 12,
                borderLeft: `2px solid ${CRM_COLORS.card_border}`,
                fontSize: 12,
              }}
            >
              <div style={{ color: TEXT, fontWeight: 500 }}>{ev.action}</div>
              <div style={{ color: TEXT2, fontSize: 11, marginTop: 2 }}>
                {ev.operator_email ?? "(unknown operator)"} · {formatTimestamp(ev.createdAt)}
              </div>
              {ev.details && (
                <div
                  style={{
                    color: TEXT3,
                    fontSize: 11,
                    marginTop: 4,
                    wordBreak: "break-word",
                  }}
                >
                  {renderDetails(ev.details)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
