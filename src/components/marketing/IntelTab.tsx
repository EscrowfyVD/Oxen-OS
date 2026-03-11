"use client"

import { useState, useMemo } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, INTEL_TYPES, INTEL_TYPE_COLORS, RELEVANCE_COLORS,
} from "./constants"
import type { MarketingIntel } from "./types"

interface IntelTabProps {
  intel: MarketingIntel[]
  onAdd: () => void
  onEdit: (item: MarketingIntel) => void
  onDelete: (id: string) => void
}

export default function IntelTab({ intel, onAdd, onEdit, onDelete }: IntelTabProps) {
  const [filterType, setFilterType] = useState("all")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    if (filterType === "all") return intel
    return intel.filter((i) => i.type === filterType)
  }, [intel, filterType])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={onAdd} className="btn-primary" style={{ padding: "7px 16px", fontSize: 11 }}>
          + Add Intel
        </button>
        <div style={{ display: "flex", gap: 4, marginLeft: 10 }}>
          <FilterBtn label="All" active={filterType === "all"} onClick={() => setFilterType("all")} />
          {INTEL_TYPES.map((t) => (
            <FilterBtn key={t.id} label={t.label} active={filterType === t.id} onClick={() => setFilterType(t.id)} color={t.color} />
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
          {filtered.length} items
        </div>
      </div>

      {/* Intel Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
            No intelligence entries yet
          </div>
        )}
        {filtered.map((item) => {
          const tc = INTEL_TYPE_COLORS[item.type] || { bg: "rgba(255,255,255,0.06)", text: TEXT_TERTIARY }
          const rc = RELEVANCE_COLORS[item.relevance] || RELEVANCE_COLORS.medium
          const isExpanded = expanded.has(item.id)
          const isLong = item.summary.length > 200

          return (
            <div
              key={item.id}
              style={{
                background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
                padding: "16px 20px", transition: "all 0.15s",
                position: "relative",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.12)" }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = CARD_BORDER }}
            >
              {/* Top row: type badge + relevance + date */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                  background: tc.bg, color: tc.text,
                  fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 0.5,
                }}>
                  {item.type}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 500, padding: "2px 6px", borderRadius: 4,
                  background: rc.bg, color: rc.text,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {item.relevance}
                </span>
                <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginLeft: "auto" }}>
                  {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              {/* Title */}
              <div style={{ fontSize: 14, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 6, lineHeight: 1.3 }}>
                {item.title}
              </div>

              {/* Summary */}
              <div style={{
                fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.6, marginBottom: 8,
                overflow: isExpanded ? "visible" : "hidden",
                maxHeight: isExpanded ? "none" : "3.2em",
              }}>
                {item.summary}
              </div>
              {isLong && (
                <button
                  onClick={() => toggleExpand(item.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 10, color: ROSE_GOLD, fontFamily: "'DM Sans', sans-serif",
                    padding: 0, marginBottom: 8,
                  }}
                >
                  {isExpanded ? "Show less" : "Read more"}
                </button>
              )}

              {/* Source */}
              {item.source && (
                <div style={{ marginBottom: 8 }}>
                  {item.source.startsWith("http") ? (
                    <a
                      href={item.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 10, color: ROSE_GOLD, fontFamily: "'DM Sans', sans-serif", textDecoration: "none" }}
                    >
                      {"\uD83D\uDD17"} {new URL(item.source).hostname}
                    </a>
                  ) : (
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      Source: {item.source}
                    </span>
                  )}
                </div>
              )}

              {/* Tags + actions */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {item.tags.map((tag) => (
                    <span key={tag} style={{
                      fontSize: 8, padding: "1px 6px", borderRadius: 3,
                      background: "rgba(192,139,136,0.08)", color: ROSE_GOLD,
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => onEdit(item)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FilterBtn({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 500,
        fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
        border: `1px solid ${active ? (color || ROSE_GOLD) : "transparent"}`,
        background: active ? `${color || ROSE_GOLD}12` : "transparent",
        color: active ? (color || ROSE_GOLD) : TEXT_TERTIARY,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  )
}
