"use client"

import { useState } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, AMBER, RED, ROSE_GOLD, INDIGO, CYAN, labelStyle,
} from "@/components/crm/constants"
import type { AIInsight, MeetingBrief } from "@/components/ai/types"
import CompanyIntelPanel from "@/components/ai/CompanyIntelPanel"

interface SentinelTabProps {
  contactId: string
  contactName: string
  companyName: string | null
  insights: AIInsight[]
  briefs: MeetingBrief[]
  onRefresh: () => void
}

const INSIGHT_COLORS: Record<string, string> = {
  opportunity: GREEN,
  risk: RED,
  buying_signal: ROSE_GOLD,
  churn_warning: AMBER,
  deal_stuck: INDIGO,
  upsell: GREEN,
  news_alert: CYAN,
  follow_up_needed: TEXT_SECONDARY,
}

const SEVERITY_DOTS: Record<string, string> = {
  critical: RED,
  high: AMBER,
  medium: ROSE_GOLD,
  low: TEXT_TERTIARY,
}

const BRIEF_SECTIONS: Array<{ key: string; label: string; icon: string }> = [
  { key: "company_context", label: "Company Context", icon: "\uD83D\uDCCA" },
  { key: "relationship_history", label: "Relationship History", icon: "\uD83E\uDD1D" },
  { key: "deal_status", label: "Deal Status", icon: "\uD83D\uDCC8" },
  { key: "talking_points", label: "Talking Points", icon: "\uD83D\uDCAC" },
  { key: "risks", label: "Risks", icon: "\u26A0\uFE0F" },
  { key: "opportunities", label: "Opportunities", icon: "\uD83C\uDFAF" },
  { key: "suggested_ask", label: "Suggested Ask", icon: "\uD83D\uDCCB" },
]

export default function SentinelTab({
  contactId, contactName, companyName, insights, briefs, onRefresh,
}: SentinelTabProps) {
  const [runningAnalysis, setRunningAnalysis] = useState(false)
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null)

  const activeInsights = insights.filter((i) => !i.dismissed)

  /* ── Actions ── */
  const handleRunAnalysis = async () => {
    setRunningAnalysis(true)
    try {
      await fetch("/api/ai/auto-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      onRefresh()
    } catch { /* silent */ }
    setRunningAnalysis(false)
  }

  const handleCreateTask = async (insight: AIInsight) => {
    setCreatingTaskId(insight.id)
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[AI] ${insight.title}`,
          contactId: insight.contactId,
        }),
      })
      onRefresh()
    } catch { /* silent */ }
    setCreatingTaskId(null)
  }

  const handleDismiss = async (id: string) => {
    setDismissingId(id)
    try {
      await fetch(`/api/ai/insights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      })
      onRefresh()
    } catch { /* silent */ }
    setDismissingId(null)
  }

  const toggleBrief = (id: string) => {
    setExpandedBriefId(expandedBriefId === id ? null : id)
  }

  const formatMeetingDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ══════════════════════════════════════════════
          Section 1: Sentinel Insights
          ══════════════════════════════════════════════ */}
      <div style={{
        padding: 20,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>{"\uD83D\uDEE1\uFE0F"}</span>
            <span style={{
              fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST,
            }}>
              Sentinel Insights
            </span>
            {activeInsights.length > 0 && (
              <span style={{
                padding: "1px 8px", borderRadius: 10, fontSize: 9, fontWeight: 600,
                background: "rgba(192,139,136,0.12)", color: ROSE_GOLD,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {activeInsights.length}
              </span>
            )}
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={runningAnalysis}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              cursor: runningAnalysis ? "wait" : "pointer",
              background: runningAnalysis
                ? "rgba(251,191,36,0.08)"
                : "linear-gradient(135deg, rgba(192,139,136,0.15), rgba(192,139,136,0.08))",
              border: `1px solid ${runningAnalysis ? "rgba(251,191,36,0.2)" : "rgba(192,139,136,0.25)"}`,
              color: runningAnalysis ? AMBER : ROSE_GOLD,
            }}
          >
            {runningAnalysis ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>

        {/* Insights List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeInsights.map((insight) => {
            const typeColor = INSIGHT_COLORS[insight.type] || TEXT_SECONDARY
            const sevColor = SEVERITY_DOTS[insight.severity] || TEXT_TERTIARY
            const isCreating = creatingTaskId === insight.id
            const isDismissing = dismissingId === insight.id

            return (
              <div
                key={insight.id}
                style={{
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${CARD_BORDER}`,
                  borderLeft: `3px solid ${typeColor}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  {/* Severity dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                    background: sevColor,
                    ...(insight.severity === "critical" ? { animation: "aiPulse 2s ease-in-out infinite" } : {}),
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title + type badge */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginBottom: 4, flexWrap: "wrap",
                    }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY,
                        fontFamily: "'DM Sans', sans-serif",
                      }}>
                        {insight.title}
                      </span>
                      <span style={{
                        padding: "1px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500,
                        background: `${typeColor}15`, color: typeColor,
                        fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                        textTransform: "capitalize",
                      }}>
                        {insight.type.replace(/_/g, " ")}
                      </span>
                    </div>

                    {/* Summary */}
                    <p style={{
                      fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.5,
                      margin: "0 0 8px", fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {insight.summary}
                    </p>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleCreateTask(insight)}
                        disabled={isCreating}
                        style={{
                          padding: "3px 10px", borderRadius: 4, fontSize: 9,
                          background: "rgba(192,139,136,0.08)", color: ROSE_GOLD,
                          border: "none", cursor: isCreating ? "wait" : "pointer",
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                        }}
                      >
                        {isCreating ? "Creating..." : "Create Task"}
                      </button>
                      <button
                        onClick={() => handleDismiss(insight.id)}
                        disabled={isDismissing}
                        style={{
                          padding: "3px 10px", borderRadius: 4, fontSize: 9,
                          background: "rgba(255,255,255,0.04)", color: TEXT_TERTIARY,
                          border: "none", cursor: isDismissing ? "wait" : "pointer",
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                        }}
                      >
                        {isDismissing ? "..." : "Dismiss"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {activeInsights.length === 0 && !runningAnalysis && (
            <div style={{
              textAlign: "center", padding: "24px 16px", color: TEXT_TERTIARY,
              fontSize: 12, fontFamily: "'DM Sans', sans-serif",
            }}>
              No insights yet. Run analysis to generate AI-powered insights.
            </div>
          )}

          {runningAnalysis && (
            <div className="ai-shimmer" style={{ height: 60, borderRadius: 8 }} />
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          Section 2: Meeting Briefs
          ══════════════════════════════════════════════ */}
      <div style={{
        padding: 20,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 15 }}>{"\uD83D\uDCCB"}</span>
          <span style={{
            fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST,
          }}>
            Meeting Briefs
          </span>
          {briefs.length > 0 && (
            <span style={{
              padding: "1px 8px", borderRadius: 10, fontSize: 9, fontWeight: 600,
              background: "rgba(192,139,136,0.12)", color: ROSE_GOLD,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {briefs.length}
            </span>
          )}
        </div>

        {/* Briefs List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {briefs.map((brief) => {
            const isExpanded = expandedBriefId === brief.id
            const statusColor = brief.status === "viewed" ? GREEN : AMBER

            return (
              <div
                key={brief.id}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {/* Brief Header Row */}
                <div style={{
                  padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY,
                      fontFamily: "'DM Sans', sans-serif", marginBottom: 3,
                    }}>
                      {brief.title}
                    </div>
                    <div style={{
                      fontSize: 10, color: TEXT_TERTIARY,
                      fontFamily: "'DM Sans', sans-serif",
                      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                    }}>
                      <span>{formatMeetingDate(brief.meetingDate)}</span>
                      {brief.attendees.length > 0 && (
                        <span>
                          {brief.attendees.slice(0, 3).join(", ")}
                          {brief.attendees.length > 3 && ` +${brief.attendees.length - 3}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500,
                    background: `${statusColor}15`,
                    color: statusColor,
                    fontFamily: "'DM Sans', sans-serif",
                    textTransform: "capitalize",
                    flexShrink: 0,
                  }}>
                    {brief.status}
                  </span>

                  {/* View Brief button */}
                  <button
                    onClick={() => toggleBrief(brief.id)}
                    style={{
                      padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                      background: isExpanded
                        ? "rgba(52,211,153,0.08)"
                        : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isExpanded ? "rgba(52,211,153,0.2)" : CARD_BORDER}`,
                      color: isExpanded ? GREEN : TEXT_SECONDARY,
                      flexShrink: 0,
                    }}
                  >
                    {isExpanded ? "Hide Brief" : "View Brief"}
                  </button>
                </div>

                {/* Expanded Brief Content */}
                {isExpanded && brief.briefContent && (
                  <div style={{
                    padding: "0 14px 14px",
                    borderTop: `1px solid ${CARD_BORDER}`,
                    paddingTop: 14,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {BRIEF_SECTIONS.map((section) => {
                        const content = brief.briefContent[section.key as keyof typeof brief.briefContent]
                        if (!content) return null

                        return (
                          <div key={section.key}>
                            <div style={{
                              fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase",
                              letterSpacing: 0.5, fontWeight: 500, marginBottom: 6,
                              fontFamily: "'DM Sans', sans-serif",
                              display: "flex", alignItems: "center", gap: 4,
                            }}>
                              <span style={{ fontSize: 11 }}>{section.icon}</span>
                              {section.label}
                            </div>

                            {Array.isArray(content) ? (
                              <ul style={{
                                margin: 0, paddingLeft: 16,
                                fontSize: 11, color: TEXT_SECONDARY,
                                fontFamily: "'DM Sans', sans-serif",
                                lineHeight: 1.6,
                              }}>
                                {(content as string[]).map((item, idx) => (
                                  <li key={idx} style={{ marginBottom: 2 }}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p style={{
                                fontSize: 11, color: TEXT_SECONDARY,
                                fontFamily: "'DM Sans', sans-serif",
                                lineHeight: 1.6, margin: 0,
                              }}>
                                {content as string}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {briefs.length === 0 && (
            <div style={{
              textAlign: "center", padding: "24px 16px", color: TEXT_TERTIARY,
              fontSize: 12, fontFamily: "'DM Sans', sans-serif",
            }}>
              No meeting briefs generated yet.
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          Section 3: Company Research
          ══════════════════════════════════════════════ */}
      <div style={{
        padding: 20,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 15 }}>{"\uD83D\uDD0D"}</span>
          <span style={{
            fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST,
          }}>
            Company Research
          </span>
          {companyName && (
            <span style={{
              fontSize: 10, color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {companyName}
            </span>
          )}
        </div>

        {/* Embedded CompanyIntelPanel */}
        <CompanyIntelPanel contactId={contactId} />
      </div>
    </div>
  )
}
