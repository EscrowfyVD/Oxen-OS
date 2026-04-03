"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import ChatSection from "@/components/ai/ChatSection"
import InsightsSection from "@/components/ai/InsightsSection"
import BriefsSection from "@/components/ai/BriefsSection"
import BriefModal from "@/components/ai/BriefModal"
import CallNotesModal from "@/components/calendar/CallNotesModal"
import type { AIInsight, MeetingBrief, CalendarEvent } from "@/components/ai/types"

const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "rgba(240,240,242,0.92)"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"

export default function AIPage() {
  return (
    <Suspense fallback={<div style={{ padding: "60px 32px", textAlign: "center", color: TEXT_TERTIARY }}>Loading...</div>}>
      <AIPageInner />
    </Suspense>
  )
}

function AIPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const contactId = searchParams.get("contactId")
  const contactName = searchParams.get("contactName")

  /* Build initial prompt if navigated from CRM contact page */
  const initialPrompt = contactId && contactName
    ? `Tell me about ${contactName} \u2014 deal status, recent interactions, risks, and opportunities.`
    : undefined
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [briefs, setBriefs] = useState<MeetingBrief[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [generatingBriefId, setGeneratingBriefId] = useState<string | null>(null)
  const [viewingBrief, setViewingBrief] = useState<MeetingBrief | null>(null)
  const [digest, setDigest] = useState<string | null>(null)
  const [loadingDigest, setLoadingDigest] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [teamView, setTeamView] = useState(false)
  const [showCallNotesModal, setShowCallNotesModal] = useState(false)
  const [callNotesModalEvent, setCallNotesModalEvent] = useState<{ id: string; title: string; start: string; attendees?: string[]; description?: string } | null>(null)
  const [intelHighlights, setIntelHighlights] = useState<{ id: string; title: string; summary: string; relevance: string; research: { category: string } }[]>([])

  // Check admin status via roleLevel
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        const rl = data.employee?.roleLevel ?? "member"
        if (rl === "super_admin" || rl === "admin") setIsAdmin(true)
      })
      .catch(() => {})
  }, [])

  const fetchInsights = useCallback(() => {
    fetch("/api/ai/insights")
      .then((r) => r.json())
      .then((data) => setInsights(data.insights ?? []))
      .catch(() => {})
  }, [])

  const fetchBriefs = useCallback((tv?: boolean) => {
    const tvParam = tv !== undefined ? tv : teamView
    const qs = tvParam ? "?teamView=true" : ""
    fetch(`/api/ai/briefs${qs}`)
      .then((r) => r.json())
      .then((data) => setBriefs(data.briefs ?? []))
      .catch(() => {})
  }, [teamView])

  const fetchEvents = useCallback((tv?: boolean) => {
    const tvParam = tv !== undefined ? tv : teamView
    const qs = tvParam ? "&teamView=true" : ""
    fetch(`/api/calendar/events?upcoming=true${qs}`)
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
  }, [teamView])

  useEffect(() => {
    fetchInsights()
    fetchBriefs()
    fetchEvents()
    // Fetch Intel highlights
    fetch("/api/intel/results/feed?limit=5")
      .then((r) => r.json())
      .then((d) => setIntelHighlights(d.results?.slice(0, 5) || []))
      .catch(() => {})
  }, [fetchInsights, fetchBriefs, fetchEvents])

  const toggleTeamView = () => {
    const newVal = !teamView
    setTeamView(newVal)
    fetchBriefs(newVal)
    fetchEvents(newVal)
  }

  /* ── Handlers ── */
  const runInsightAnalysis = async () => {
    setLoadingInsights(true)
    try {
      const r = await fetch("/api/ai/auto-insights", { method: "POST" })
      const data = await r.json()
      if (data.insights) {
        fetchInsights()
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
                fontFamily: "'Bellfair', serif", fontSize: 32, fontWeight: 400, margin: 0, lineHeight: 1.2,
                background: "linear-gradient(90deg, #C08B88, #E8C4C0, #C08B88)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Sentinel
              </h1>
              <span style={{
                padding: "2px 10px", borderRadius: 20, fontSize: 9, fontWeight: 500,
                background: "linear-gradient(135deg, rgba(192,139,136,0.15), rgba(232,196,192,0.08))",
                border: "1px solid rgba(192,139,136,0.2)", color: ROSE_GOLD,
                fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.5,
              }}>
                AI SALES INTELLIGENCE
              </span>
            </div>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 6 }}>
              Sentinel — your AI-powered sales intelligence engine, powered by Claude
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Admin Team View toggle */}
            {isAdmin && (
              <button
                onClick={toggleTeamView}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                  background: teamView ? "rgba(192,139,136,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${teamView ? "rgba(192,139,136,0.3)" : CARD_BORDER}`,
                  color: teamView ? ROSE_GOLD : TEXT_SECONDARY,
                  transition: "all 0.2s",
                }}
              >
                {teamView ? "\uD83D\uDC41 Team View" : "\uD83D\uDC64 My View"}
              </button>
            )}

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

        {/* Section 1: Sentinel Chat */}
        <ChatSection onRefresh={() => { fetchInsights(); fetchBriefs() }} initialPrompt={initialPrompt} />

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
          onPrepareCallNotes={(event) => {
            setCallNotesModalEvent({
              id: event.id,
              title: event.title,
              start: event.start,
              attendees: event.attendees,
            })
            setShowCallNotesModal(true)
          }}
        />

        {/* Section 4: Intel Highlights */}
        {intelHighlights.length > 0 && (
          <div className="fade-in" style={{
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            padding: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>🔍</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>Intel Highlights</span>
              </div>
              <Link href="/intel" style={{ fontSize: 11, color: ROSE_GOLD, textDecoration: "none" }}>
                View in Intel →
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {intelHighlights.map((item) => {
                const catColors: Record<string, string> = {
                  marketing: "#C08B88", ai_tools: "#818CF8", competitors: "#EF4444",
                  regulations: "#F59E0B", conferences: "#22C55E", oxen: "#5BB8A8", finance: "#A855F7",
                }
                const catIcons: Record<string, string> = {
                  marketing: "🎯", ai_tools: "🤖", competitors: "⚔️",
                  regulations: "📜", conferences: "🎪", oxen: "🏛", finance: "💰",
                }
                const color = catColors[item.research.category] || TEXT_SECONDARY
                return (
                  <div key={item.id} style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${CARD_BORDER}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 9, padding: "1px 6px", borderRadius: 4,
                        background: `${color}15`, color,
                      }}>
                        {catIcons[item.research.category]} {item.research.category.replace("_", " ")}
                      </span>
                      {(item.relevance === "critical" || item.relevance === "high") && (
                        <span style={{
                          fontSize: 9, padding: "1px 6px", borderRadius: 4,
                          background: "rgba(239,68,68,0.12)", color: "#EF4444",
                        }}>
                          {item.relevance}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY }}>{item.title}</div>
                    <div style={{
                      fontSize: 12, color: TEXT_SECONDARY, marginTop: 2,
                      display: "-webkit-box", WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                    }}>
                      {item.summary}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Brief Modal */}
      {viewingBrief && (
        <BriefModal
          brief={viewingBrief}
          onClose={() => setViewingBrief(null)}
        />
      )}

      {/* Call Notes Modal */}
      {showCallNotesModal && (
        <CallNotesModal
          event={callNotesModalEvent}
          onClose={() => {
            setShowCallNotesModal(false)
            setCallNotesModalEvent(null)
          }}
          onSuccess={(callNoteId) => {
            setShowCallNotesModal(false)
            setCallNotesModalEvent(null)
            router.push(`/calendar/${callNoteId}`)
          }}
        />
      )}
    </div>
  )
}
