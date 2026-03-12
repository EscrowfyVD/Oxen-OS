"use client"

import { useState, useEffect } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, AMBER, RED, BLUE, fmtDateTime,
} from "./constants"
import type { CompanyIntel } from "./types"

interface CompanyIntelPanelProps {
  contactId: string
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: GREEN,
  negative: RED,
  neutral: TEXT_TERTIARY,
}

export default function CompanyIntelPanel({ contactId }: CompanyIntelPanelProps) {
  const [intel, setIntel] = useState<CompanyIntel | null>(null)
  const [loading, setLoading] = useState(false)
  const [researching, setResearching] = useState(false)

  useEffect(() => {
    fetch(`/api/ai/research/${contactId}`)
      .then((r) => r.json())
      .then((data) => setIntel(data.intel ?? null))
      .catch(() => {})
  }, [contactId])

  const doResearch = async () => {
    setResearching(true)
    try {
      const r = await fetch(`/api/ai/research/${contactId}`, { method: "POST" })
      const data = await r.json()
      if (data.intel) setIntel(data.intel)
    } catch { /* silent */ }
    setResearching(false)
  }

  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${CARD_BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>{"\uD83E\uDD16"}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            background: "linear-gradient(90deg, #C08B88, #E8C4C0)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            AI Company Intel
          </span>
        </div>
        <button
          onClick={doResearch}
          disabled={researching}
          style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 9, fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif", cursor: researching ? "wait" : "pointer",
            background: researching ? "rgba(251,191,36,0.08)" : "linear-gradient(135deg, rgba(192,139,136,0.15), rgba(192,139,136,0.08))",
            border: `1px solid ${researching ? "rgba(251,191,36,0.2)" : "rgba(192,139,136,0.25)"}`,
            color: researching ? AMBER : ROSE_GOLD,
          }}
        >
          {researching ? "Researching..." : intel ? "\uD83D\uDD04 Refresh" : "\uD83E\uDD16 Research Company"}
        </button>
      </div>

      {researching && !intel && (
        <div className="ai-shimmer" style={{ margin: 16, height: 100, borderRadius: 8 }} />
      )}

      {!intel && !researching && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: TEXT_TERTIARY, fontSize: 11 }}>
          No company research yet. Click &quot;Research Company&quot; to generate intel.
        </div>
      )}

      {intel && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Company overview */}
          {intel.description && (
            <div>
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
                Overview
              </div>
              <p style={{ fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.6, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                {intel.description.substring(0, 300)}{intel.description.length > 300 ? "..." : ""}
              </p>
            </div>
          )}

          {/* Quick facts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {intel.industry && (
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                Industry: <span style={{ color: TEXT_SECONDARY }}>{intel.industry}</span>
              </div>
            )}
            {intel.employeeCount && (
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                Size: <span style={{ color: TEXT_SECONDARY }}>{intel.employeeCount}</span>
              </div>
            )}
            {intel.revenue && (
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                Revenue: <span style={{ color: TEXT_SECONDARY }}>{intel.revenue}</span>
              </div>
            )}
            {intel.headquarters && (
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                HQ: <span style={{ color: TEXT_SECONDARY }}>{intel.headquarters}</span>
              </div>
            )}
          </div>

          {/* Key People */}
          {intel.keyPeople && Array.isArray(intel.keyPeople) && intel.keyPeople.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
                Key People
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {intel.keyPeople.slice(0, 4).map((person, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(192,139,136,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color: ROSE_GOLD }}>
                        {person.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: TEXT_PRIMARY, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{person.name}</span>
                      {person.title && <span style={{ fontSize: 9, color: TEXT_TERTIARY, marginLeft: 4 }}>{person.title}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent News */}
          {intel.recentNews && Array.isArray(intel.recentNews) && intel.recentNews.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
                Recent News
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {intel.recentNews.slice(0, 3).map((news, i) => (
                  <div key={i} style={{
                    padding: "6px 10px", borderRadius: 6,
                    background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>
                      {news.title}
                    </div>
                    {news.summary && (
                      <div style={{ fontSize: 9, color: TEXT_TERTIARY, lineHeight: 1.4 }}>
                        {news.summary.substring(0, 100)}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                      {news.source && <span style={{ fontSize: 8, color: TEXT_TERTIARY }}>{news.source}</span>}
                      {news.sentiment && (
                        <span style={{ fontSize: 8, color: SENTIMENT_COLORS[news.sentiment] || TEXT_TERTIARY }}>
                          {news.sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last researched */}
          {intel.lastResearched && (
            <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderTop: `1px solid ${CARD_BORDER}`, paddingTop: 8 }}>
              Last researched: {fmtDateTime(intel.lastResearched)} · Source: {intel.dataSource || "AI"}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
