"use client"

import { useState } from "react"
import DealCard from "./DealCard"
import {
  CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  RED, FROST, PIPELINE_COLUMNS, STATUS_COLORS,
} from "./constants"
import type { Contact } from "./types"

interface PipelineTabProps {
  contacts: Contact[]
  onDrop: (contactId: string, newStatus: string) => void
  onCardClick: (contact: Contact) => void
}

export default function PipelineTab({ contacts, onDrop, onCardClick }: PipelineTabProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [showLost, setShowLost] = useState(false)

  const getColumnContacts = (status: string) =>
    contacts.filter((c) => c.status === status)

  const getColumnValue = (status: string) =>
    contacts
      .filter((c) => c.status === status)
      .reduce((sum, c) => sum + (c.value ?? 0), 0)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverCol(colId)
  }

  const handleDragLeave = () => {
    setDragOverCol(null)
  }

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault()
    setDragOverCol(null)
    const contactId = e.dataTransfer.getData("text/plain")
    if (contactId) onDrop(contactId, colId)
  }

  const lostContacts = getColumnContacts("lost")
  const lostValue = getColumnValue("lost")

  return (
    <div>
      {/* ── Kanban Board ── */}
      <div
        className="card fade-in"
        style={{ padding: 16, marginBottom: 20, animationDelay: "0.1s" }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          {PIPELINE_COLUMNS.map((col) => {
            const colContacts = getColumnContacts(col.id)
            const colValue = getColumnValue(col.id)
            const isDragTarget = dragOverCol === col.id

            return (
              <div
                key={col.id}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: isDragTarget ? "rgba(192,139,136,0.06)" : "transparent",
                  border: isDragTarget
                    ? "1px dashed rgba(192,139,136,0.3)"
                    : "1px solid transparent",
                  borderRadius: 8,
                  padding: 8,
                  transition: "all 0.2s ease",
                }}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column header */}
                <div
                  style={{
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: col.accent,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: TEXT_SECONDARY,
                        textTransform: "uppercase",
                        letterSpacing: 1.5,
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      {col.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: TEXT_TERTIARY,
                        fontFamily: "'DM Sans', sans-serif",
                        marginLeft: "auto",
                      }}
                    >
                      {colContacts.length}
                    </span>
                  </div>
                  {colValue > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: TEXT_TERTIARY,
                        fontFamily: "'Bellfair', serif",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatCurrency(colValue)}
                    </div>
                  )}
                </div>

                {/* Column body */}
                <div style={{ minHeight: 80 }}>
                  {colContacts.map((contact) => (
                    <DealCard
                      key={contact.id}
                      contact={contact}
                      onClick={() => onCardClick(contact)}
                    />
                  ))}
                  {colContacts.length === 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: TEXT_TERTIARY,
                        textAlign: "center",
                        padding: "24px 0",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      Drop deals here
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Lost section (collapsed) ── */}
      <div
        className="card fade-in"
        style={{ padding: "12px 16px", animationDelay: "0.15s" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
          }}
          onClick={() => setShowLost(!showLost)}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: RED,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: TEXT_SECONDARY,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
            }}
          >
            Lost
          </span>
          <span
            style={{
              fontSize: 10,
              color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {lostContacts.length} {lostValue > 0 ? `· ${formatCurrency(lostValue)}` : ""}
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: TEXT_TERTIARY,
              transition: "transform 0.2s",
              transform: showLost ? "rotate(180deg)" : "rotate(0)",
            }}
          >
            ▾
          </span>
        </div>

        {showLost && lostContacts.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid rgba(255,255,255,0.03)",
            }}
            onDragOver={(e) => handleDragOver(e, "lost")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "lost")}
          >
            {lostContacts.map((contact) => (
              <DealCard
                key={contact.id}
                contact={contact}
                onClick={() => onCardClick(contact)}
              />
            ))}
          </div>
        )}

        {!showLost && (
          <div
            style={{ height: 0, overflow: "hidden" }}
            onDragOver={(e) => {
              handleDragOver(e, "lost")
              setShowLost(true)
            }}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "lost")}
          />
        )}
      </div>

      {/* ── Column Stats ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          marginTop: 20,
          animationDelay: "0.2s",
        }}
      >
        {PIPELINE_COLUMNS.map((col) => {
          const count = contacts.filter((c) => c.status === col.id).length
          return (
            <div
              key={col.id}
              className="card"
              style={{ padding: "12px 16px", overflow: "hidden" }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: TEXT_TERTIARY,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                {col.label}
              </div>
              <span
                style={{
                  fontFamily: "'Bellfair', serif",
                  fontSize: 24,
                  fontWeight: 400,
                  color: FROST,
                  lineHeight: 1,
                }}
              >
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
