"use client"

import {
  STAGE_COLORS as CRM_STAGE_COLORS,
  STAGE_LABELS,
  OWNER_COLORS,
  fmtCurrency,
} from "@/lib/crm-config"
import {
  CARD_BG,
  CARD_BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
} from "./constants"
import type { PipelineDeal } from "./PipelineView"

const VERTICAL_COLORS: Record<string, string> = {
  "FinTech / Crypto": "#34D399",
  "Family Office": "#818CF8",
  "CSP / Fiduciaries": "#FBBF24",
  "Luxury Assets": "#A78BFA",
  iGaming: "#C08B88",
  "Yacht Brokers": "#22D3EE",
  "Import / Export": "#2DD4BF",
}

interface CardViewProps {
  deals: PipelineDeal[]
  onDealClick: (deal: PipelineDeal) => void
}

export default function CardView({ deals, onDealClick }: CardViewProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}
    >
      {deals.map((deal) => {
        const contactName = deal.contact
          ? `${deal.contact.firstName} ${deal.contact.lastName}`
          : deal.dealName
        const companyName = deal.company?.name ?? null
        const stageColor = CRM_STAGE_COLORS[deal.stage] ?? "#9CA3AF"
        const ownerInitial = deal.dealOwner?.[0] ?? "?"
        const ownerColor = OWNER_COLORS[deal.dealOwner] ?? "#9CA3AF"
        const verticals = deal.vertical ?? []

        return (
          <div
            key={deal.id}
            onClick={() => onDealClick(deal)}
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 14,
              padding: "18px 20px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.borderColor = "rgba(192,139,136,0.25)"
              el.style.transform = "translateY(-3px)"
              el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)"
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.borderColor = CARD_BORDER
              el.style.transform = "translateY(0)"
              el.style.boxShadow = "none"
            }}
          >
            {/* Row 1: contact name + owner avatar */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                    fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {contactName}
                </div>
                {companyName && (
                  <div
                    style={{
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                      fontFamily: "'DM Sans', sans-serif",
                      lineHeight: 1.3,
                      marginTop: 2,
                    }}
                  >
                    {companyName}
                  </div>
                )}
              </div>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: ownerColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#060709",
                  fontFamily: "'DM Sans', sans-serif",
                  flexShrink: 0,
                  marginLeft: 12,
                }}
                title={deal.dealOwner}
              >
                {ownerInitial}
              </div>
            </div>

            {/* Row 2: stage badge + value */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  background: `${stageColor}18`,
                  color: stageColor,
                  fontFamily: "'DM Sans', sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                {STAGE_LABELS[deal.stage] ?? deal.stage}
              </span>
              {deal.dealValue != null && (
                <span
                  style={{
                    fontFamily: "'Bellfair', serif",
                    fontSize: 18,
                    color: "#FFFFFF",
                    lineHeight: 1,
                  }}
                >
                  {fmtCurrency(deal.dealValue)}
                </span>
              )}
            </div>

            {/* Row 3: vertical tags */}
            {verticals.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                {verticals.slice(0, 3).map((v) => (
                  <span
                    key={v}
                    style={{
                      fontSize: 9,
                      padding: "2px 8px",
                      borderRadius: 8,
                      background: `${VERTICAL_COLORS[v] ?? "#9CA3AF"}18`,
                      color: VERTICAL_COLORS[v] ?? "#9CA3AF",
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                    }}
                  >
                    {v}
                  </span>
                ))}
                {verticals.length > 3 && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.06)",
                      color: TEXT_TERTIARY,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    +{verticals.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {deals.length === 0 && (
        <div
          style={{
            gridColumn: "1 / -1",
            padding: "60px 20px",
            textAlign: "center",
            fontSize: 13,
            color: TEXT_TERTIARY,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          No deals match the current filters
        </div>
      )}
    </div>
  )
}
