"use client"

import { useState, useMemo } from "react"
import {
  STAGE_COLORS as CRM_STAGE_COLORS,
  STAGE_LABELS,
  OWNER_COLORS,
  KYC_COLORS,
  KYC_STATUSES,
  getAgingColor,
  fmtCurrency,
  fmtCurrencyFull,
} from "@/lib/crm-config"
import {
  CARD_BG,
  CARD_BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  ROSE_GOLD,
} from "./constants"
import type { PipelineDeal } from "./PipelineView"

interface TableViewProps {
  deals: PipelineDeal[]
  onDealClick: (deal: PipelineDeal) => void
}

type SortKey =
  | "contact"
  | "company"
  | "stage"
  | "value"
  | "weighted"
  | "owner"
  | "vertical"
  | "source"
  | "kyc"
  | "daysInStage"
  | "lastActivity"
  | "created"

const COLUMNS: { key: SortKey; label: string; width?: string }[] = [
  { key: "contact", label: "Contact", width: "160px" },
  { key: "company", label: "Company", width: "140px" },
  { key: "stage", label: "Stage", width: "130px" },
  { key: "value", label: "Value", width: "100px" },
  { key: "weighted", label: "Weighted", width: "100px" },
  { key: "owner", label: "Owner", width: "90px" },
  { key: "vertical", label: "Vertical", width: "140px" },
  { key: "source", label: "Source", width: "130px" },
  { key: "kyc", label: "KYC", width: "60px" },
  { key: "daysInStage", label: "Days", width: "60px" },
  { key: "lastActivity", label: "Last Activity", width: "100px" },
  { key: "created", label: "Created", width: "100px" },
]

function getContactName(deal: PipelineDeal): string {
  if (deal.contact) return `${deal.contact.firstName} ${deal.contact.lastName}`
  return deal.dealName
}

function getCompanyName(deal: PipelineDeal): string {
  return deal.company?.name ?? ""
}

function getKycLabel(status: string): string {
  const found = KYC_STATUSES.find((k) => k.id === status)
  return found?.label ?? status
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
}

export default function TableView({ deals, onDealClick }: TableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("created")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = useMemo(() => {
    const arr = [...deals]
    const dir = sortDir === "asc" ? 1 : -1

    arr.sort((a, b) => {
      switch (sortKey) {
        case "contact":
          return getContactName(a).localeCompare(getContactName(b)) * dir
        case "company":
          return getCompanyName(a).localeCompare(getCompanyName(b)) * dir
        case "stage":
          return a.stage.localeCompare(b.stage) * dir
        case "value":
          return ((a.dealValue ?? 0) - (b.dealValue ?? 0)) * dir
        case "weighted":
          return ((a.weightedValue ?? 0) - (b.weightedValue ?? 0)) * dir
        case "owner":
          return a.dealOwner.localeCompare(b.dealOwner) * dir
        case "vertical":
          return (a.vertical?.[0] ?? "").localeCompare(b.vertical?.[0] ?? "") * dir
        case "source":
          return (a.acquisitionSource ?? "").localeCompare(b.acquisitionSource ?? "") * dir
        case "kyc":
          return a.kycStatus.localeCompare(b.kycStatus) * dir
        case "daysInStage":
          return (a.daysInCurrentStage - b.daysInCurrentStage) * dir
        case "lastActivity":
          return (a.daysSinceLastActivity - b.daysSinceLastActivity) * dir
        case "created":
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
        default:
          return 0
      }
    })
    return arr
  }, [deals, sortKey, sortDir])

  const headerStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 10,
    fontWeight: 600,
    color: TEXT_TERTIARY,
    fontFamily: "'DM Sans', sans-serif",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    borderBottom: `1px solid ${CARD_BORDER}`,
    background: "rgba(255,255,255,0.02)",
    position: "sticky" as const,
    top: 0,
    zIndex: 2,
  }

  const cellStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontFamily: "'DM Sans', sans-serif",
    borderBottom: `1px solid ${CARD_BORDER}`,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 280px)" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 1400,
          }}
        >
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    ...headerStyle,
                    width: col.width,
                    textAlign: col.key === "value" || col.key === "weighted" || col.key === "daysInStage" ? "right" : "left",
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4, opacity: 0.6 }}>
                      {sortDir === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((deal) => {
              const stageColor = CRM_STAGE_COLORS[deal.stage] ?? "#9CA3AF"
              const kycColor = KYC_COLORS[deal.kycStatus] ?? "#9CA3AF"
              const agingColor = getAgingColor(deal.daysInCurrentStage)

              return (
                <tr
                  key={deal.id}
                  onClick={() => onDealClick(deal)}
                  style={{
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(192,139,136,0.05)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                  }}
                >
                  {/* Contact */}
                  <td style={cellStyle}>
                    <span style={{ fontWeight: 600 }}>{getContactName(deal)}</span>
                  </td>

                  {/* Company */}
                  <td style={{ ...cellStyle, color: TEXT_SECONDARY }}>
                    {getCompanyName(deal)}
                  </td>

                  {/* Stage badge */}
                  <td style={cellStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 600,
                        background: `${stageColor}18`,
                        color: stageColor,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {STAGE_LABELS[deal.stage] ?? deal.stage}
                    </span>
                  </td>

                  {/* Value */}
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: "right",
                      fontFamily: "'Bellfair', serif",
                      fontSize: 13,
                    }}
                  >
                    {deal.dealValue != null ? fmtCurrencyFull(deal.dealValue) : "-"}
                  </td>

                  {/* Weighted */}
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: "right",
                      fontFamily: "'Bellfair', serif",
                      fontSize: 13,
                      color: TEXT_SECONDARY,
                    }}
                  >
                    {deal.weightedValue != null ? fmtCurrencyFull(deal.weightedValue) : "-"}
                  </td>

                  {/* Owner */}
                  <td style={cellStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: OWNER_COLORS[deal.dealOwner] ?? "#9CA3AF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9,
                          fontWeight: 700,
                          color: "#060709",
                          flexShrink: 0,
                        }}
                      >
                        {deal.dealOwner?.[0] ?? "?"}
                      </div>
                      <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                        {deal.dealOwner}
                      </span>
                    </div>
                  </td>

                  {/* Vertical */}
                  <td style={cellStyle}>
                    <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                      {deal.vertical?.join(", ") || "-"}
                    </span>
                  </td>

                  {/* Source */}
                  <td style={{ ...cellStyle, color: TEXT_SECONDARY, fontSize: 11 }}>
                    {deal.acquisitionSource ?? "-"}
                  </td>

                  {/* KYC dot */}
                  <td style={{ ...cellStyle, textAlign: "center" }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: kycColor,
                        display: "inline-block",
                      }}
                      title={getKycLabel(deal.kycStatus)}
                    />
                  </td>

                  {/* Days in Stage */}
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      color: agingColor,
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                  >
                    {deal.daysInCurrentStage}
                  </td>

                  {/* Last Activity */}
                  <td
                    style={{
                      ...cellStyle,
                      color: TEXT_SECONDARY,
                      fontSize: 11,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {deal.daysSinceLastActivity === 0
                      ? "Today"
                      : `${deal.daysSinceLastActivity}d ago`}
                  </td>

                  {/* Created */}
                  <td style={{ ...cellStyle, color: TEXT_TERTIARY, fontSize: 11 }}>
                    {formatDate(deal.createdAt)}
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  style={{
                    ...cellStyle,
                    textAlign: "center",
                    padding: "40px 12px",
                    color: TEXT_TERTIARY,
                  }}
                >
                  No deals match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
