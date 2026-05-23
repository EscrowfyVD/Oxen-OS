"use client"

// Operator audit timeline — read-only V1 (SP16-003 adds the action
// surface that produces these). Renders nothing-cluttering when the
// audit list is empty.
//
// SP16-002b §4 — pre-fix the panel read `ev.operator_email` and
// `ev.createdAt`, both of which were guesses; the real OCA fields
// are `actor` (e.g. "operator:vd@oxen.finance", "lifecycle-emitter",
// "agent") and `created_at` (snake_case, the proxy is pass-through).
// `details` was renamed to `payload`. OCA does NOT return an `id` —
// the React key is synthesized from action+created_at.

import { CRM_COLORS } from "@/lib/crm-config"
import { formatTimestamp } from "./format"
import type { AuditEvent } from "./detail-types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary

function renderPayload(payload: AuditEvent["payload"]): string {
  if (!payload) return ""
  try {
    const json = JSON.stringify(payload)
    return json.length > 200 ? json.slice(0, 200) + "…" : json
  } catch {
    return ""
  }
}

/**
 * Display the actor string. The OCA convention is
 * `operator:<email>` for human operators — strip the prefix for a
 * cleaner display while preserving the namespace as a subtle hint.
 * Non-operator actors (`agent`, `lifecycle-emitter`, ...) render
 * as-is.
 */
function formatActor(actor: string | null | undefined): string {
  if (!actor) return "(unknown actor)"
  if (actor.startsWith("operator:")) {
    const email = actor.slice("operator:".length)
    return email || "operator"
  }
  return actor
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
          {events.map((ev, i) => {
            // No `id` upstream — synthesize a stable React key from
            // action + created_at + index (index breaks ties if two
            // entries collide on action + timestamp, which is rare
            // but possible during bulk slot-feed flows).
            const key = `${ev.action}-${ev.created_at}-${i}`
            const payloadStr = renderPayload(ev.payload)
            return (
              <div
                key={key}
                style={{
                  paddingLeft: 12,
                  borderLeft: `2px solid ${CRM_COLORS.card_border}`,
                  fontSize: 12,
                }}
              >
                <div style={{ color: TEXT, fontWeight: 500 }}>{ev.action}</div>
                <div style={{ color: TEXT2, fontSize: 11, marginTop: 2 }}>
                  {formatActor(ev.actor)} · {formatTimestamp(ev.created_at)}
                </div>
                {payloadStr && (
                  <div
                    style={{
                      color: TEXT3,
                      fontSize: 11,
                      marginTop: 4,
                      wordBreak: "break-word",
                    }}
                  >
                    {payloadStr}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
