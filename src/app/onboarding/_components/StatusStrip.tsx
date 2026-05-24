"use client"

// Top strip on the detail page — at-a-glance status: platform, status,
// risk, idle, agent_active, plus a blocker_reason banner if present.
//
// SP16-003 Slice 2: the agent_active indicator was a static dot+label
// in SP16-002 ; it now renders <AgentToggleControl /> which makes it
// clickable (takeover / hand-back). Everything else stays static.

import { CRM_COLORS } from "@/lib/crm-config"
import { classifyIdle, statusColor, riskColor } from "./format"
import { labelForBlockerReason, labelForRiskLevel } from "@/lib/onboarding/labels"
import type { ConsolidatedSession } from "./detail-types"
import AgentToggleControl from "./AgentToggleControl"
import ReopenControl from "./ReopenControl"

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
    padding: "4px 10px",
    borderRadius: 6,
    background: `${color}${alpha}`,
    color,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "'DM Sans', sans-serif",
  }
}

const IDLE_COLOR: Record<string, string> = {
  fresh: TEXT3,
  warm: "#FBBF24",
  stuck: "#F87171",
}

export default function StatusStrip({
  payload,
  onAfterAction,
}: {
  payload: ConsolidatedSession
  /**
   * SP16-003 — refetch the consolidated session after an operator
   * action mutates state. Wired to OnboardingDetail.loadSession so
   * the hybrid optimistic+refetch UX settles on canonical data.
   */
  onAfterAction: () => Promise<void> | void
}) {
  const s = payload.session
  const idle = classifyIdle(s.idle_minutes)
  const idleColor = IDLE_COLOR[idle.bucket]

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          padding: "14px 18px",
          background: CRM_COLORS.card_bg,
          border: `1px solid ${CRM_COLORS.card_border}`,
          borderRadius: 10,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span style={badgeStyle("#A78BFA")}>{s.platform}</span>
        <span style={badgeStyle(statusColor(s.status))}>{s.status}</span>
        {/* Risk — SP16-005. risk_level + risk_score come from OCA's
            AdminSessionView DTO (admin-session-view.ts:76-77). Both
            are nullable: OCA only sets them once the session has
            progressed past TRIAGE into risk assessment. When null
            we render a clear muted "Risk: Not yet assessed" instead
            of just hiding — the absence is informative (operator
            knows assessment hasn't happened, not that we forgot to
            render). When present: pill in the OCA-RiskLevel color
            (Slice 1 RISK_COLOR pin) + label via labelForRiskLevel
            + the numeric score inline. */}
        {s.risk_level ? (
          <span style={badgeStyle(riskColor(s.risk_level))}>
            {labelForRiskLevel(s.risk_level)}
            {s.risk_score !== null && ` · ${s.risk_score}`}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: TEXT3, fontStyle: "italic" }}>
            Risk: not yet assessed
          </span>
        )}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: idleColor,
            fontWeight: idle.bucket === "stuck" ? 600 : 400,
          }}
        >
          {idle.bucket === "stuck" && "⚠ "}
          idle {idle.label}
        </span>
        <span style={{ flex: 1 }} />
        {/* SP16-003 Slice 4 — reopen button, conditionally
            rendered (only when session.status === "rejected" — the
            component self-gates and returns null otherwise). */}
        <ReopenControl
          sessionId={s.id}
          sessionStatus={s.status}
          legalRepName={s.legal_rep_name}
          companyName={s.company_name}
          onAfterAction={onAfterAction}
        />
        <AgentToggleControl
          sessionId={s.id}
          agentActive={s.agent_active}
          onAfterAction={onAfterAction}
        />
      </div>

      {payload.blocker_reason && (
        <div
          style={{
            marginTop: 10,
            padding: "12px 16px",
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.3)",
            borderLeft: "3px solid #FBBF24",
            borderRadius: 8,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "#FBBF24",
              marginBottom: 4,
            }}
          >
            Blocker · {labelForBlockerReason(payload.blocker_reason.code)}
          </div>
          <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
            {payload.blocker_reason.message}
          </div>
        </div>
      )}
    </div>
  )
}
