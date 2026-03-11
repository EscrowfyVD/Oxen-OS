"use client"

import { CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, SECTOR_COLORS, FROST } from "./constants"
import type { Contact } from "./types"

interface DealCardProps {
  contact: Contact
  onClick: () => void
}

export default function DealCard({ contact, onClick }: DealCardProps) {
  const sectorStyle = contact.sector
    ? SECTOR_COLORS[contact.sector] || SECTOR_COLORS.Other
    : null

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", contact.id)
    e.dataTransfer.effectAllowed = "move"
  }

  const formatValue = (val: number | null, currency: string) => {
    if (val == null) return null
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  const daysSinceInteraction = () => {
    if (!contact.interactions || contact.interactions.length === 0) return null
    const last = new Date(contact.interactions[0].createdAt)
    const now = new Date()
    const diff = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const days = daysSinceInteraction()

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        padding: "12px 14px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        marginBottom: 8,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.borderColor = "rgba(192,139,136,0.2)"
        el.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.borderColor = CARD_BORDER
        el.style.transform = "translateY(0)"
      }}
    >
      {/* Company + Contact name */}
      <div style={{ marginBottom: 6 }}>
        {contact.company && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: TEXT_PRIMARY,
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.3,
            }}
          >
            {contact.company}
          </div>
        )}
        <div
          style={{
            fontSize: 11,
            color: contact.company ? TEXT_SECONDARY : TEXT_PRIMARY,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: contact.company ? 400 : 600,
            lineHeight: 1.3,
          }}
        >
          {contact.name}
        </div>
      </div>

      {/* Sector badge + Value */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        {sectorStyle && (
          <span
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 10,
              background: sectorStyle.bg,
              color: sectorStyle.text,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {contact.sector}
          </span>
        )}
        {contact.value != null && (
          <span
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 14,
              fontWeight: 400,
              color: FROST,
              lineHeight: 1,
            }}
          >
            {formatValue(contact.value, contact.currency)}
          </span>
        )}
      </div>

      {/* Assignee + Days since interaction */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {contact.assignedTo && (
          <span
            style={{
              fontSize: 10,
              color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {contact.assignedTo}
          </span>
        )}
        {days !== null && (
          <span
            style={{
              fontSize: 9,
              color: days > 14 ? "#F87171" : TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
              fontVariantNumeric: "tabular-nums",
              marginLeft: "auto",
            }}
          >
            {days === 0 ? "today" : `${days}d ago`}
          </span>
        )}
      </div>
    </div>
  )
}
