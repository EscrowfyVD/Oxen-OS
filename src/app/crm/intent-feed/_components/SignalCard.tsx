"use client"

import Link from "next/link"
import { CRM_COLORS } from "@/lib/crm-config"
import { formatSignalDate } from "@/lib/intent-feed/format-date"
import SignalCardActions from "./SignalCardActions"
import type { IntentFeedSignalView } from "./types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const CARD_BORDER = CRM_COLORS.card_border

// Source colors mirror the rough convention used elsewhere in the
// app — trigify on amber (intent / urgency), clay on teal (enrichment),
// api on indigo (programmatic), n8n on purple. Fallback gray for any
// new source that ships before this list is updated.
const SOURCE_COLOR: Record<string, string> = {
  trigify: "#FBBF24",
  clay: "#2DD4BF",
  "api/signals": "#818CF8",
  lemlist: "#22D3EE",
  n8n: "#A78BFA",
}

function badgeStyle(color: string, opacity = 0.15): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px",
    borderRadius: 6,
    background: `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`,
    color,
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "'DM Sans', sans-serif",
  }
}

interface SignalCardProps {
  signal: IntentFeedSignalView
  onActioned: (signalId: string, actionedAt: string, actionedBy: string | null) => void
  onSuccess: (message: string) => void
}

export default function SignalCard({ signal, onActioned, onSuccess }: SignalCardProps) {
  const sourceColor = SOURCE_COLOR[signal.source] ?? "#9CA3AF"
  const isActioned = !!signal.actionedAt

  return (
    <div
      style={{
        background: CRM_COLORS.card_bg,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        padding: "16px 18px",
        backdropFilter: CRM_COLORS.glass_blur,
        WebkitBackdropFilter: CRM_COLORS.glass_blur,
        opacity: isActioned ? 0.55 : 1,
        transition: "opacity 120ms ease",
      }}
    >
      {/* Header row: badges + date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 10,
        }}
      >
        {signal.isHot && (
          <span style={badgeStyle("#EF4444", 0.18)}>🔥 Hot</span>
        )}
        <span style={badgeStyle(sourceColor)}>{signal.source}</span>
        <span style={badgeStyle(ROSE, 0.12)}>{signal.points} pt</span>
        {isActioned && (
          <span style={badgeStyle("#34D399", 0.15)}>✓ Actioned</span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>
          {formatSignalDate(signal.createdAt)}
        </span>
      </div>

      {/* Person + company */}
      <div style={{ marginBottom: 8 }}>
        {signal.contact ? (
          <Link
            href={`/crm/contacts/${signal.contact.id}`}
            style={{
              fontSize: 15,
              color: TEXT,
              textDecoration: "none",
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {signal.contact.name}
          </Link>
        ) : (
          <span style={{ fontSize: 15, color: TEXT3, fontStyle: "italic" }}>
            No contact attached
          </span>
        )}
        {(signal.contact?.jobTitle || signal.company) && (
          <div
            style={{
              fontSize: 12,
              color: TEXT2,
              marginTop: 2,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {signal.contact?.jobTitle && <span>{signal.contact.jobTitle}</span>}
            {signal.contact?.jobTitle && signal.company && <span> · </span>}
            {signal.company && (
              <Link
                href={`/crm/companies/${signal.company.id}`}
                style={{ color: TEXT2, textDecoration: "none" }}
              >
                {signal.company.name}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Signal title + detail */}
      <div
        style={{
          fontSize: 13,
          color: TEXT,
          marginBottom: 6,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
        }}
      >
        {signal.signalTypeLabel}
      </div>
      {signal.detail && (
        <div
          style={{
            fontSize: 12,
            color: TEXT2,
            lineHeight: 1.5,
            marginBottom: 10,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {signal.detail}
        </div>
      )}

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {signal.contact?.group && (
          <span style={tagStyle}>Group {signal.contact.group}</span>
        )}
        {signal.contact?.painTier && (
          <span style={tagStyle}>{signal.contact.painTier}</span>
        )}
        {signal.contact?.persona && (
          <span style={tagStyle}>{signal.contact.persona}</span>
        )}
        {signal.company?.country && (
          <span style={tagStyle}>{signal.company.country}</span>
        )}
      </div>

      {/* Actions */}
      <SignalCardActions
        signal={signal}
        onActioned={onActioned}
        onSuccess={onSuccess}
      />
    </div>
  )
}

const tagStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 7px",
  borderRadius: 5,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${CRM_COLORS.card_border}`,
  color: CRM_COLORS.text_secondary,
  fontSize: 10,
  fontFamily: "'DM Sans', sans-serif",
  textTransform: "uppercase",
  letterSpacing: 0.4,
}
