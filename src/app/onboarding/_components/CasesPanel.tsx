"use client"

// Cases section — formatted rows (one per case) per SP16-002b §3.
// Pre-fix the detail view stuffed {open_count, items} into a generic
// SectionPanel which serialized the items array into a raw JSON blob.
// Now we render the open-count header explicitly + one operator-
// focused row per case (severity, status, case_type, title, date).
//
// Shape verified live on OCA staging — see detail-types.ts
// `CaseItem`. Every per-row field is optional and null-checked here
// so a partially-populated case still renders.

import { CRM_COLORS } from "@/lib/crm-config"
import { formatTimestamp } from "./format"
import {
  labelForCaseSeverity,
  humanizeToken,
} from "@/lib/onboarding/labels"
import type { CasesSummary } from "./detail-types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary

// Severity ladder mirrors the canonical low→critical scale used
// elsewhere in the OS (Activity tags, alert pills).
const SEVERITY_COLOR: Record<string, string> = {
  low: "#34D399",
  medium: "#FBBF24",
  high: "#F97316",
  critical: "#F87171",
}

// Status ladder matches the case-management lifecycle the OCA agent
// emits — new → in_progress → resolved/closed. Unknown values fall
// back to neutral gray.
const STATUS_COLOR: Record<string, string> = {
  new: "#3B82F6",
  in_progress: "#FBBF24",
  resolved: "#34D399",
  closed: "#9CA3AF",
}

function pillStyle(color: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 7px",
    fontSize: 10,
    fontWeight: 500,
    color,
    background: `${color}1A`,
    border: `1px solid ${color}33`,
    borderRadius: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  }
}

export default function CasesPanel({ cases }: { cases: CasesSummary | null }) {
  const items = cases?.items ?? []
  const openCount = cases?.open_count ?? 0

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
        Cases ({openCount} open)
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: TEXT3, fontStyle: "italic" }}>
          No cases for this session
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((c) => {
            const severityColor = c.severity
              ? SEVERITY_COLOR[c.severity] ?? "#9CA3AF"
              : null
            const statusColor = c.status
              ? STATUS_COLOR[c.status] ?? "#9CA3AF"
              : null
            return (
              <div
                key={c.id}
                style={{
                  paddingLeft: 12,
                  borderLeft: `2px solid ${CRM_COLORS.card_border}`,
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {c.severity && severityColor && (
                    <span style={pillStyle(severityColor)}>{labelForCaseSeverity(c.severity)}</span>
                  )}
                  {c.status && statusColor && (
                    <span style={pillStyle(statusColor)}>{humanizeToken(c.status)}</span>
                  )}
                  {c.case_type && (
                    <span style={{ color: TEXT2, fontSize: 11 }}>{humanizeToken(c.case_type)}</span>
                  )}
                </div>
                {c.title && (
                  <div
                    style={{
                      color: TEXT,
                      marginTop: 4,
                      wordBreak: "break-word",
                    }}
                  >
                    {c.title}
                  </div>
                )}
                {c.created_at && (
                  <div style={{ color: TEXT3, fontSize: 11, marginTop: 2 }}>
                    {formatTimestamp(c.created_at)}
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
