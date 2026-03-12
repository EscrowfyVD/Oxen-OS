"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, INSIGHT_TYPES, INSIGHT_TYPE_COLORS, SEVERITY_COLORS, timeAgo,
} from "./constants"
import type { AIInsight } from "./types"

interface InsightsSectionProps {
  insights: AIInsight[]
  loading: boolean
  onRunAnalysis: () => void
  onDismiss: (id: string) => void
  onCreateTask: (insight: AIInsight) => void
}

export default function InsightsSection({ insights, loading, onRunAnalysis, onDismiss, onCreateTask }: InsightsSectionProps) {
  const [filter, setFilter] = useState("all")
  const [showDismissed, setShowDismissed] = useState(false)

  const filtered = insights.filter((i) => {
    if (!showDismissed && i.dismissed) return false
    if (filter !== "all" && i.type !== filter) return false
    return true
  })

  const filterChips = [
    { id: "all", label: "All" },
    ...INSIGHT_TYPES.filter((t) => insights.some((i) => i.type === t.id)),
  ]

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 400, color: TEXT_PRIMARY, fontFamily: "'Bellfair', serif", margin: 0 }}>
          Insights
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: TEXT_TERTIARY, cursor: "pointer" }}>
            <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} style={{ accentColor: ROSE_GOLD }} />
            Show dismissed
          </label>
          <button
            onClick={onRunAnalysis}
            disabled={loading}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif", cursor: loading ? "wait" : "pointer",
              background: "linear-gradient(135deg, rgba(192,139,136,0.15), rgba(192,139,136,0.08))",
              border: "1px solid rgba(192,139,136,0.25)", color: ROSE_GOLD,
            }}
          >
            {loading ? "Analyzing..." : "\uD83D\uDD04 Run Analysis"}
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {filterChips.map((chip) => {
          const isType = chip.id !== "all"
          const typeColor = isType ? INSIGHT_TYPE_COLORS[chip.id] : null
          return (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                border: `1px solid ${filter === chip.id ? (typeColor?.color || ROSE_GOLD) : CARD_BORDER}`,
                background: filter === chip.id ? (typeColor?.bg || "rgba(192,139,136,0.08)") : "transparent",
                color: filter === chip.id ? (typeColor?.color || ROSE_GOLD) : TEXT_TERTIARY,
                transition: "all 0.15s",
              }}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Insight cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((insight) => {
          const typeColor = INSIGHT_TYPE_COLORS[insight.type] || { color: TEXT_TERTIARY, bg: "rgba(255,255,255,0.04)" }
          const sevColor = SEVERITY_COLORS[insight.severity] || SEVERITY_COLORS.medium

          return (
            <div
              key={insight.id}
              style={{
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderLeft: `3px solid ${typeColor.color}`,
                borderRadius: 10,
                padding: "12px 16px",
                opacity: insight.dismissed ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                {/* Severity dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                  background: sevColor.dot,
                  ...(insight.severity === "critical" ? { animation: "aiPulse 2s ease-in-out infinite" } : {}),
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title + type badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {insight.title}
                    </span>
                    <span style={{
                      padding: "1px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500,
                      background: typeColor.bg, color: typeColor.color,
                      fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                    }}>
                      {INSIGHT_TYPES.find((t) => t.id === insight.type)?.label || insight.type}
                    </span>
                  </div>

                  {/* Summary */}
                  <p style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5, margin: "0 0 8px", fontFamily: "'DM Sans', sans-serif" }}>
                    {insight.summary}
                  </p>

                  {/* Footer */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {insight.contact && (
                      <Link
                        href={`/crm/${insight.contact.id}`}
                        style={{
                          fontSize: 10, color: ROSE_GOLD, textDecoration: "none",
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                        }}
                      >
                        {insight.contact.company || insight.contact.name}
                      </Link>
                    )}
                    <span style={{ fontSize: 9, color: TEXT_TERTIARY }}>{timeAgo(insight.createdAt)}</span>

                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      {insight.contact && (
                        <Link
                          href={`/crm/${insight.contact.id}`}
                          style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 9,
                            background: "rgba(255,255,255,0.04)", color: TEXT_TERTIARY,
                            textDecoration: "none", fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          View Contact
                        </Link>
                      )}
                      <button
                        onClick={() => onCreateTask(insight)}
                        style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 9,
                          background: "rgba(192,139,136,0.08)", color: ROSE_GOLD,
                          border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Create Task
                      </button>
                      {!insight.dismissed && (
                        <button
                          onClick={() => onDismiss(insight.id)}
                          style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 9,
                            background: "rgba(255,255,255,0.04)", color: TEXT_TERTIARY,
                            border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && !loading && (
          <div style={{
            textAlign: "center", padding: "40px 20px", color: TEXT_TERTIARY, fontSize: 12,
            background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
          }}>
            {insights.length === 0
              ? "No insights yet. Click \"Run Analysis\" to generate insights from your CRM data."
              : "No insights match your filters."}
          </div>
        )}

        {loading && (
          <div className="ai-shimmer" style={{
            height: 80, borderRadius: 10,
          }} />
        )}
      </div>
    </div>
  )
}
