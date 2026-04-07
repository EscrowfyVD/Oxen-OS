"use client"

import { useState, useRef } from "react"
import {
  PIPELINE_STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  OWNER_COLORS,
  KYC_COLORS,
  VERTICALS,
  getAgingColor,
  fmtCurrency,
  CRM_COLORS,
  OUTREACH_GROUPS,
  OUTREACH_GROUP_COLORS,
} from "@/lib/crm-config"
import {
  CARD_BG,
  CARD_BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  ROSE_GOLD,
} from "./constants"

/* ── Deal shape (matches API response) ── */
export interface PipelineDeal {
  id: string
  dealName: string
  contactId: string
  contact?: {
    id: string
    firstName: string
    lastName: string
    email?: string | null
    companyId?: string | null
    outreachGroup?: string | null
  } | null
  companyId?: string | null
  company?: { id: string; name: string; domain?: string | null } | null
  stage: string
  dealValue: number | null
  dealOwner: string
  vertical: string[]
  kycStatus: string
  daysInCurrentStage: number
  daysSinceLastActivity: number
  winProbability: number | null
  weightedValue: number | null
  acquisitionSource: string | null
  notes: string | null
  stageChangedAt: string
  createdAt: string
  updatedAt: string
}

interface PipelineViewProps {
  deals: PipelineDeal[]
  onDealClick: (deal: PipelineDeal) => void
  onStageChange: (dealId: string, newStage: string) => void
  onStageWon: (deal: PipelineDeal) => void
  onStageLost: (deal: PipelineDeal) => void
}

/* ── Vertical tag colors ── */
const VERTICAL_COLORS: Record<string, string> = {
  "FinTech / Crypto": "#34D399",
  "Family Office": "#818CF8",
  "CSP / Fiduciaries": "#FBBF24",
  "Luxury Assets": "#A78BFA",
  iGaming: "#C08B88",
  "Yacht Brokers": "#22D3EE",
  "Import / Export": "#2DD4BF",
}

export default function PipelineView({
  deals,
  onDealClick,
  onStageChange,
  onStageWon,
  onStageLost,
}: PipelineViewProps) {
  const [collapsedWon, setCollapsedWon] = useState(false)
  const [collapsedLost, setCollapsedLost] = useState(true)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const dragDealRef = useRef<PipelineDeal | null>(null)

  const dealsByStage: Record<string, PipelineDeal[]> = {}
  for (const s of PIPELINE_STAGES) dealsByStage[s.id] = []
  for (const d of deals) {
    if (dealsByStage[d.stage]) dealsByStage[d.stage].push(d)
  }

  const stageTotal = (stageId: string) =>
    dealsByStage[stageId].reduce((sum, d) => sum + (d.dealValue ?? 0), 0)

  const handleDragStart = (e: React.DragEvent, deal: PipelineDeal) => {
    dragDealRef.current = deal
    e.dataTransfer.setData("text/plain", deal.id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverStage(stageId)
  }

  const handleDragLeave = () => setDragOverStage(null)

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    setDragOverStage(null)
    const deal = dragDealRef.current
    if (!deal || deal.stage === stageId) return

    if (stageId === "closed_won") {
      onStageWon(deal)
    } else if (stageId === "closed_lost") {
      onStageLost(deal)
    } else {
      onStageChange(deal.id, stageId)
    }
    dragDealRef.current = null
  }

  const isCollapsed = (stageId: string) => {
    if (stageId === "closed_won") return collapsedWon
    if (stageId === "closed_lost") return collapsedLost
    return false
  }

  const toggleCollapse = (stageId: string) => {
    if (stageId === "closed_won") setCollapsedWon((v) => !v)
    if (stageId === "closed_lost") setCollapsedLost((v) => !v)
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        paddingBottom: 16,
        minHeight: 500,
      }}
    >
      {PIPELINE_STAGES.map((stage) => {
        const stageDeals = dealsByStage[stage.id]
        const collapsed = isCollapsed(stage.id)
        const isDropTarget = dragOverStage === stage.id
        const canCollapse = stage.id === "closed_won" || stage.id === "closed_lost"

        return (
          <div
            key={stage.id}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
            style={{
              minWidth: collapsed ? 48 : 280,
              maxWidth: collapsed ? 48 : 280,
              flex: collapsed ? "0 0 48px" : "0 0 280px",
              display: "flex",
              flexDirection: "column",
              background: isDropTarget
                ? "rgba(192,139,136,0.08)"
                : "var(--surface-subtle)",
              border: `1px solid ${isDropTarget ? "rgba(192,139,136,0.3)" : CARD_BORDER}`,
              borderRadius: 12,
              transition: "all 0.2s ease",
              overflow: "hidden",
            }}
          >
            {/* Column header */}
            <div
              onClick={() => canCollapse && toggleCollapse(stage.id)}
              style={{
                padding: collapsed ? "12px 8px" : "12px 14px",
                borderBottom: `1px solid ${CARD_BORDER}`,
                cursor: canCollapse ? "pointer" : "default",
                writingMode: collapsed ? "vertical-rl" : undefined,
                textOrientation: collapsed ? "mixed" : undefined,
                display: "flex",
                alignItems: collapsed ? "center" : "flex-start",
                justifyContent: collapsed ? "center" : "space-between",
                flexDirection: collapsed ? "column" : "row",
                gap: collapsed ? 8 : 0,
                minHeight: collapsed ? 200 : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: stage.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                    fontFamily: "'DM Sans', sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {stage.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: TEXT_TERTIARY,
                    fontFamily: "'DM Sans', sans-serif",
                    background: "var(--card-border)",
                    padding: "1px 6px",
                    borderRadius: 8,
                  }}
                >
                  {stageDeals.length}
                </span>
              </div>
              {!collapsed && (
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "'Bellfair', serif",
                    color: TEXT_SECONDARY,
                  }}
                >
                  {fmtCurrency(stageTotal(stage.id))}
                </span>
              )}
            </div>

            {/* Deal cards */}
            {!collapsed && (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {stageDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => onDealClick(deal)}
                    onDragStart={(e) => handleDragStart(e, deal)}
                  />
                ))}
                {stageDeals.length === 0 && (
                  <div
                    style={{
                      padding: "24px 12px",
                      textAlign: "center",
                      fontSize: 11,
                      color: TEXT_TERTIARY,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    No deals
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Individual deal card ── */
function DealCard({
  deal,
  onClick,
  onDragStart,
}: {
  deal: PipelineDeal
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const contactName = deal.contact
    ? `${deal.contact.firstName} ${deal.contact.lastName}`
    : deal.dealName
  const companyName = deal.company?.name ?? null
  const ownerInitial = deal.dealOwner?.[0] ?? "?"
  const ownerColor = OWNER_COLORS[deal.dealOwner] ?? "#9CA3AF"
  const kycColor = KYC_COLORS[deal.kycStatus] ?? "#9CA3AF"
  const agingColor = getAgingColor(deal.daysInCurrentStage)
  const verticals = deal.vertical ?? []
  const visibleVerticals = verticals.slice(0, 2)
  const extraCount = verticals.length - 2

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.borderColor = "rgba(192,139,136,0.25)"
        el.style.transform = "translateY(-2px)"
        el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)"
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.borderColor = CARD_BORDER
        el.style.transform = "translateY(0)"
        el.style.boxShadow = "none"
      }}
    >
      {/* Row 1: name + owner avatar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
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
                fontSize: 11,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {companyName}
            </div>
          )}
        </div>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: ownerColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "#060709",
            fontFamily: "'DM Sans', sans-serif",
            flexShrink: 0,
            marginLeft: 8,
          }}
          title={deal.dealOwner}
        >
          {ownerInitial}
        </div>
      </div>

      {/* Row 2: deal value */}
      {deal.dealValue != null && (
        <div
          style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 16,
            color: "var(--text-primary)",
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          {fmtCurrency(deal.dealValue)}
        </div>
      )}

      {/* Row 3: outreach group badge */}
      {deal.contact?.outreachGroup && (() => {
        const gObj = OUTREACH_GROUPS.find((g) => g.id === deal.contact?.outreachGroup)
        return gObj ? (
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: `${gObj.color}18`, color: gObj.color, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, whiteSpace: "nowrap" }}>
              {gObj.short}
            </span>
          </div>
        ) : null
      })()}

      {/* Row 4: vertical tags */}
      {verticals.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: 8,
          }}
        >
          {visibleVerticals.map((v) => (
            <span
              key={v}
              style={{
                fontSize: 9,
                padding: "2px 7px",
                borderRadius: 8,
                background: `${VERTICAL_COLORS[v] ?? "#9CA3AF"}18`,
                color: VERTICAL_COLORS[v] ?? "#9CA3AF",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {v}
            </span>
          ))}
          {extraCount > 0 && (
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 8,
                background: "var(--card-border)",
                color: TEXT_TERTIARY,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              +{extraCount}
            </span>
          )}
        </div>
      )}

      {/* Row 4: days in stage + KYC dot */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            color: agingColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {deal.daysInCurrentStage}d in stage
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: kycColor,
            }}
            title={`KYC: ${deal.kycStatus}`}
          />
        </div>
      </div>
    </div>
  )
}
