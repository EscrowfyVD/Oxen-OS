"use client"

// One row of the Onboarding session list — table-cell layout (inline
// flex) with badges, "stuck?" indicator, and click-through to detail.

import Link from "next/link"
import { CRM_COLORS } from "@/lib/crm-config"
import {
  formatTimestamp,
  classifyIdle,
  statusColor,
  riskColor,
} from "./format"
import {
  labelForEntityType,
  labelForOnboardingStep,
} from "@/lib/onboarding/labels"
import type { SessionRow as SessionRowData } from "./types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary

function badgeStyle(color: string, opacity = 0.15): React.CSSProperties {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0")
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px",
    borderRadius: 6,
    background: `${color}${alpha}`,
    color,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "'DM Sans', sans-serif",
    whiteSpace: "nowrap",
  }
}

const IDLE_COLOR: Record<string, string> = {
  fresh: TEXT3,
  warm: "#FBBF24",
  stuck: "#F87171",
}

export default function SessionRow({ row }: { row: SessionRowData }) {
  const idle = classifyIdle(row.idle_minutes)
  const idleColor = IDLE_COLOR[idle.bucket]

  return (
    <Link
      href={`/onboarding/${row.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 2fr 1fr 1.4fr 1fr 1.4fr",
        gap: 12,
        padding: "14px 16px",
        background: CRM_COLORS.card_bg,
        border: `1px solid ${CRM_COLORS.card_border}`,
        borderRadius: 10,
        textDecoration: "none",
        color: TEXT,
        fontFamily: "'DM Sans', sans-serif",
        alignItems: "center",
        transition: "border-color 120ms ease",
      }}
    >
      {/* Legal rep — name on top, email mute on subline */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: TEXT,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.legal_rep_name || "—"}
        </div>
        <div
          style={{
            fontSize: 11,
            color: TEXT3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.legal_rep_email || ""}
        </div>
      </div>

      {/* Company + entity_type */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: row.company_name ? TEXT : TEXT3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.company_name || "—"}
        </div>
        <div style={{ fontSize: 11, color: TEXT3 }}>{labelForEntityType(row.entity_type)}</div>
      </div>

      {/* Platform */}
      <div>
        <span style={badgeStyle("#A78BFA")}>{row.platform}</span>
      </div>

      {/* Status + current_step */}
      <div style={{ minWidth: 0 }}>
        <span style={badgeStyle(statusColor(row.status))}>{row.status}</span>
        {row.current_step && (
          <div
            style={{
              fontSize: 11,
              color: TEXT2,
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {labelForOnboardingStep(row.current_step)}
          </div>
        )}
      </div>

      {/* Risk score + level */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {row.risk_level && (
          <span style={badgeStyle(riskColor(row.risk_level))}>
            {row.risk_level}
          </span>
        )}
        {row.risk_score !== null && (
          <span style={{ fontSize: 11, color: TEXT2 }}>{row.risk_score}</span>
        )}
        {row.risk_level === null && row.risk_score === null && (
          <span style={{ fontSize: 11, color: TEXT3 }}>—</span>
        )}
      </div>

      {/* Agent active + idle + last activity */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            marginBottom: 2,
          }}
        >
          <span
            aria-label={row.agent_active ? "agent active" : "agent idle"}
            title={row.agent_active ? "Agent active" : "Agent idle"}
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: row.agent_active ? "#34D399" : "#6B7280",
            }}
          />
          <span style={{ color: idleColor, fontWeight: idle.bucket === "stuck" ? 600 : 400 }}>
            {idle.bucket === "stuck" && "⚠ "}
            idle {idle.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: TEXT3 }}>
          {formatTimestamp(row.lastActivityAt)}
        </div>
      </div>
    </Link>
  )
}
