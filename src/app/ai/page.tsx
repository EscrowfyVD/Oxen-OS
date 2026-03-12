"use client"

import { useState, useEffect, useCallback } from "react"
import ChatSection from "@/components/ai/ChatSection"
import InsightsSection from "@/components/ai/InsightsSection"
import BriefsSection from "@/components/ai/BriefsSection"
import BriefModal from "@/components/ai/BriefModal"
import type { AIInsight, MeetingBrief, CalendarEvent } from "@/components/ai/types"

const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const AMBER = "#FBBF24"

export default function AIPage() {
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [briefs, setBriefs] = useState<MeetingBrief[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [generatingBriefId, setGeneratingBriefId] = useState<string | null>(null)
  const [viewingBrief, setViewingBrief] = useState<MeetingBrief | null>(null)
  const [digest, setDigest] = useState<string | null>(null)
  const [loadingDigest, setLoadingDigest] = useState(false)

  const fetchInsights = useCallback(() => {
    fetch("/api/ai/insights")
      .then((r) => r.json())
      .then((data) => setInsights(data.insights ?? []))
      .catch(() => {})
  }, [])

  const fetchBriefs = useCallback(() => {
    fetch("/api/ai/briefs")
      .then((r) => r.json())
      .then((data) => setBriefs(data.briefs ?? []))
      .catch(() => {})
  }, [])

  const fetchEvents = useCallback(() => {
    fetch("/api/calendar/events?upcoming=true")
      .then((r) => r.json())
      .then((data) => {
        const evts = (data.events ?? []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          title: e.title as string,
          start: e.start as string,
          end: e.end as string,
          attendees: (e.attendees || []) as string[],
        }))
        setEvents(evts)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchInsights()
    fetchBriefs()
    fetchEvents()
  }, [fetchInsights, fetchBriefs, fetchEvents])

  /* ── Handlers ── */
  const runInsightAnalysis = async () => {
    setLoadingInsights(true)
    try {
      const r = await fetch("/api/ai/auto-insights", { method: "POST" })
      const data = await r.json()
      if (data.insights) {
        fetchInsights() // Refresh the full list
      }
    } catch { /* silent */ }
    setLoadingInsights(false)
  }

  const dismissInsight = async (id: string) => {
    try {
      await fetch(`/api/ai/insights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      })
      setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, dismissed: true } : i)))
    } catch { /* silent */ }
  }

  const createTaskFromInsight = async (insight: AIInsight) => {
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[AI] ${insight.title}`,
          description: insight.summary,
          priority: insight.severity === "critical" || insight.severity === "high" ? "high" : "medium",
          status: "todo",
        }),
      })
      const data = await r.json()
      if (data.task) {
        await fetch(`/api/ai/insights/${insight.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkedTaskId: data.task.id, actionTaken: "Task created" }),
        })
        fetchInsights()
      }
    } catch { /* silent */ }
  }

  const generateBrief = async (event: CalendarEvent) => {
    setGeneratingBriefId(event.id)
    try {
      await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          title: event.title,
          meetingDate: event.start,
          attendees: event.attendees,
        }),
      })
      fetchBriefs()
    } catch { /* silent */ }
    setGeneratingBriefId(null)
  }

  const generateDigest = async () => {
    setLoadingDigest(true)
    try {
      const r = await fetch("/api/ai/digest", { method: "POST" })
      const data = await r.json()
      if (data.digest) setDigest(data.digest)
    } catch { /* silent */ }
    setLoadingDigest(false)
  }

  return (
    <div className="page-content" style={{ padding: 0, background: "#060709", minHeight: "100vh" }}>
      {/* Header */}
      <div
        className="fade-in"
        style={{ padding: "24px 28px 20px" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{
                fontFamily: "'Bellfair', serif", fontSize: 28, fontWeight: 400, margin: 0, lineHeight: 1.2,
                background: "linear-gradient(90deg, #C08B88, #E8C4C0, #C08B88)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                AI Agent
              </h1>
              <span style={{
                padding: "2px 10px", borderRadius: 20, fontSize: 9, fontWeight: 500,
                background: "linear-gradient(135deg, rgba(192,139,136,0.15), rgba(232,196,192,0.08))",
                border: "1px solid rgba(192,139,136,0.2)", color: ROSE_GOLD,
                fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.5,
              }}>
                PREMIUM
              </span>
            </div>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 6 }}>
              Your AI-powered sales intelligence assistant — powered by Claude
            </p>
          </div>

          <button
            onClick={generateDigest}
            disabled={loadingDigest}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 11, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif", cursor: loadingDigest ? "wait" : "pointer",
              background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`,
              color: TEXT_SECONDARY,
            }}
          >
            {loadingDigest ? "Generating..." : "\uD83D\uDCCB Daily Digest"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 28px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Digest (if generated) */}
        {digest && (
          <div className="fade-in" style={{
            background: "linear-gradient(135deg, rgba(192,139,136,0.04), rgba(15,17,24,1))",
            border: "1px solid rgba(192,139,136,0.12)", borderRadius: 14,
            padding: 20, position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{"\uD83D\uDCCB"}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: ROSE_GOLD, fontFamily: "'DM Sans', sans-serif" }}>Daily Digest</span>
              </div>
              <button
                onClick={() => setDigest(null)}
                style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", fontSize: 14 }}
              >
                {"\u2715"}
              </button>
            </div>
            <div style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", whiteSpace: "pre-wrap" }}>
              {digest}
            </div>
          </div>
        )}

        {/* Section 1: AI Chat */}
        <ChatSection onRefresh={() => { fetchInsights(); fetchBriefs() }} />

        {/* Section 2: Insights */}
        <InsightsSection
          insights={insights}
          loading={loadingInsights}
          onRunAnalysis={runInsightAnalysis}
          onDismiss={dismissInsight}
          onCreateTask={createTaskFromInsight}
        />

        {/* Section 3: Meeting Briefs */}
        <BriefsSection
          briefs={briefs}
          events={events}
          onGenerateBrief={generateBrief}
          onViewBrief={setViewingBrief}
          generatingId={generatingBriefId}
        />
      </div>

      {/* Brief Modal */}
      {viewingBrief && (
        <BriefModal
          brief={viewingBrief}
          onClose={() => setViewingBrief(null)}
        />
      )}
    </div>
  )
}
