"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, AMBER, RED, ROSE_GOLD, INDIGO, CYAN,
  STAGE_COLORS, INTERACTION_TYPES, INTERACTION_ICONS, labelStyle,
} from "@/components/crm/constants"
import type { Interaction } from "@/components/crm/types"

interface TimelineItem {
  id: string
  type: "interaction" | "insight" | "brief" | "deal_update" | "email"
  title: string
  description: string
  date: string
  metadata: Record<string, unknown>
}

interface TimelineTabProps {
  contactId: string
  contact: { interactions: Interaction[] }
  onRefresh: () => void
}

const relativeDate = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: RED,
  high: AMBER,
  medium: ROSE_GOLD,
  low: TEXT_TERTIARY,
}

const TYPE_CONFIG: Record<string, { icon: string; accent: string; label: string }> = {
  interaction: { icon: "", accent: TEXT_SECONDARY, label: "Interaction" },
  insight: { icon: "\uD83D\uDEE1\uFE0F", accent: AMBER, label: "Insight" },
  brief: { icon: "\uD83D\uDCCB", accent: ROSE_GOLD, label: "Brief" },
  deal_update: { icon: "\uD83D\uDCC8", accent: GREEN, label: "Deal Update" },
  email: { icon: "\u2709\uFE0F", accent: CYAN, label: "Email" },
}

export default function TimelineTab({ contactId, contact, onRefresh }: TimelineTabProps) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [interType, setInterType] = useState("note")
  const [interContent, setInterContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchTimeline = useCallback(() => {
    setLoading(true)
    fetch(`/api/contacts/${contactId}/timeline`)
      .then((r) => r.json())
      .then((data) => {
        setTimeline(data.items ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [contactId])

  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  const handleAddInteraction = async () => {
    if (!interContent.trim() || submitting) return
    setSubmitting(true)
    try {
      await fetch(`/api/contacts/${contactId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: interType, content: interContent.trim() }),
      })
      setInterContent("")
      onRefresh()
      fetchTimeline()
    } catch { /* silent */ }
    setSubmitting(false)
  }

  const getItemIcon = (item: TimelineItem): string => {
    if (item.type === "interaction" && item.metadata.interactionType) {
      return INTERACTION_ICONS[item.metadata.interactionType as string] || "\uD83D\uDCDD"
    }
    return TYPE_CONFIG[item.type]?.icon || "\uD83D\uDCDD"
  }

  const getItemBorderColor = (item: TimelineItem): string | null => {
    if (item.type === "insight") {
      const severity = item.metadata.severity as string
      return SEVERITY_BORDER[severity] || TEXT_TERTIARY
    }
    if (item.type === "brief") return ROSE_GOLD
    if (item.type === "deal_update") {
      const stage = item.metadata.dealStage as string
      const stageColor = STAGE_COLORS[stage]
      return stageColor?.text || GREEN
    }
    if (item.type === "email") return CYAN
    return null
  }

  const getTypeBadgeStyle = (item: TimelineItem): { bg: string; color: string } => {
    const config = TYPE_CONFIG[item.type]
    if (!config) return { bg: "rgba(255,255,255,0.04)", color: TEXT_TERTIARY }

    switch (item.type) {
      case "insight": return { bg: "rgba(251,191,36,0.08)", color: AMBER }
      case "brief": return { bg: "rgba(192,139,136,0.08)", color: ROSE_GOLD }
      case "deal_update": {
        const stage = item.metadata.dealStage as string
        const sc = STAGE_COLORS[stage]
        return sc ? { bg: sc.bg, color: sc.text } : { bg: "rgba(52,211,153,0.08)", color: GREEN }
      }
      case "email": return { bg: "rgba(34,211,238,0.08)", color: CYAN }
      case "interaction": return { bg: "rgba(255,255,255,0.04)", color: TEXT_SECONDARY }
      default: return { bg: "rgba(255,255,255,0.04)", color: TEXT_TERTIARY }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Add Interaction Form ── */}
      <div style={{
        padding: 16,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
      }}>
        <div style={{ ...labelStyle, marginBottom: 10 }}>Log Interaction</div>

        {/* Type selector buttons */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
          {INTERACTION_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setInterType(t)}
              style={{
                padding: "4px 10px",
                fontSize: 10,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                border: `1px solid ${interType === t ? "rgba(192,139,136,0.3)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 6,
                background: interType === t ? "rgba(192,139,136,0.1)" : "transparent",
                color: interType === t ? TEXT_PRIMARY : TEXT_TERTIARY,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.15s",
              }}
            >
              {INTERACTION_ICONS[t]} {t}
            </button>
          ))}
        </div>

        {/* Content textarea */}
        <textarea
          className="oxen-input"
          value={interContent}
          onChange={(e) => setInterContent(e.target.value)}
          placeholder="Add a note, log a call..."
          rows={3}
          style={{
            resize: "vertical",
            minHeight: 60,
            fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 10,
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        {/* Submit button */}
        <button
          className="btn-primary"
          onClick={handleAddInteraction}
          disabled={!interContent.trim() || submitting}
          style={{
            padding: "8px 16px",
            fontSize: 11,
            width: "100%",
            textTransform: "capitalize",
          }}
        >
          {submitting ? "Adding..." : `Add ${interType}`}
        </button>
      </div>

      {/* ── Timeline Feed ── */}
      <div style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14,
        padding: 20,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST }}>
            Timeline
          </span>
          <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
            {timeline.length} event{timeline.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading && (
          <div className="ai-shimmer" style={{ height: 120, borderRadius: 8 }} />
        )}

        {!loading && timeline.length === 0 && (
          <div style={{
            fontSize: 12, color: TEXT_TERTIARY, textAlign: "center",
            padding: "30px 0", fontFamily: "'DM Sans', sans-serif",
          }}>
            No timeline events yet
          </div>
        )}

        {!loading && timeline.length > 0 && (
          <div style={{ position: "relative", paddingLeft: 20 }}>
            {/* Vertical timeline line */}
            <div style={{
              position: "absolute",
              left: 13,
              top: 0,
              bottom: 0,
              width: 1,
              background: CARD_BORDER,
            }} />

            {timeline.map((item, i) => {
              const borderColor = getItemBorderColor(item)
              const badge = getTypeBadgeStyle(item)
              const icon = getItemIcon(item)
              const truncatedDesc = item.description.length > 200
                ? item.description.substring(0, 200) + "..."
                : item.description

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    paddingBottom: i < timeline.length - 1 ? 16 : 0,
                    marginBottom: i < timeline.length - 1 ? 16 : 0,
                    borderBottom: i < timeline.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                    position: "relative",
                  }}
                >
                  {/* Timeline dot */}
                  <div style={{
                    position: "absolute",
                    left: -20,
                    top: 4,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: borderColor || TEXT_TERTIARY,
                    border: `2px solid ${CARD_BG}`,
                    zIndex: 1,
                  }} />

                  {/* Icon */}
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: borderColor
                      ? `${borderColor}15`
                      : "rgba(255,255,255,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    flexShrink: 0,
                    ...(borderColor ? { border: `1px solid ${borderColor}25` } : {}),
                  }}>
                    {icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginBottom: 4, flexWrap: "wrap",
                    }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY,
                        fontFamily: "'DM Sans', sans-serif",
                      }}>
                        {item.title}
                      </span>
                      <span style={{
                        padding: "1px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500,
                        background: badge.bg, color: badge.color,
                        fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                        textTransform: "capitalize",
                      }}>
                        {TYPE_CONFIG[item.type]?.label || item.type}
                      </span>
                    </div>

                    <div style={{
                      fontSize: 11, color: TEXT_SECONDARY,
                      fontFamily: "'DM Sans', sans-serif",
                      lineHeight: 1.5,
                      ...(borderColor ? { borderLeft: `2px solid ${borderColor}`, paddingLeft: 8 } : {}),
                    }}>
                      {truncatedDesc}
                    </div>

                    <div style={{
                      fontSize: 9, color: TEXT_TERTIARY,
                      fontFamily: "'DM Sans', sans-serif",
                      marginTop: 6,
                    }}>
                      {relativeDate(item.date)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
