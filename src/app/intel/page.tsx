"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, RefreshCw, Star, ExternalLink, CheckCircle, XCircle,
  Linkedin, Github, Globe, Newspaper, FileText, AlertTriangle,
  ChevronRight, Calendar, Users, X, Loader2, Eye, EyeOff,
  Megaphone, Sparkles, TrendingUp,
} from "lucide-react"

/* ── Design tokens ── */
const VOID = "#060709"
const CARD_BG = "rgba(255,255,255,0.03)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "rgba(240,240,242,0.92)"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"

const CATEGORY_COLORS: Record<string, string> = {
  marketing: "#C08B88",
  ai_tools: "#818CF8",
  competitors: "#EF4444",
  regulations: "#F59E0B",
  conferences: "#22C55E",
  oxen: "#5BB8A8",
  finance: "#A855F7",
}

const CATEGORY_ICONS: Record<string, string> = {
  marketing: "🎯",
  ai_tools: "🤖",
  competitors: "⚔️",
  regulations: "📜",
  conferences: "🎪",
  oxen: "🏛",
  finance: "💰",
}

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  marketing: "Marketing",
  ai_tools: "AI Tools",
  competitors: "Competitors",
  regulations: "Regulations",
  conferences: "Conferences",
  oxen: "Oxen",
  finance: "Finance",
}

const SUBCATEGORIES: Record<string, { value: string; label: string }[]> = {
  marketing: [
    { value: "social_trends", label: "Social Media Trends" },
    { value: "competitive_intel", label: "Marketing Competitive Intel" },
    { value: "repost_suggestions", label: "Repost Suggestions" },
    { value: "content_ideas", label: "Content Ideas" },
  ],
  ai_tools: [
    { value: "trending_tools", label: "Trending AI Tools" },
    { value: "github_repos", label: "GitHub Repositories" },
    { value: "google_search", label: "Google Search" },
    { value: "news_scraping", label: "AI News Monitoring" },
  ],
  competitors: [
    { value: "business_news", label: "Business News" },
    { value: "website_changes", label: "Website Changes" },
    { value: "reviews", label: "Reviews Monitoring" },
  ],
  regulations: [
    { value: "new_regulation", label: "New Regulations" },
    { value: "regulation_change", label: "Regulation Changes" },
    { value: "regulation_removal", label: "Regulation Removals" },
    { value: "regulation_news", label: "Regulatory News" },
  ],
  conferences: [
    { value: "relevant_conferences", label: "Relevant Conferences" },
  ],
  oxen: [
    { value: "news_mentions", label: "News Mentions" },
    { value: "social_mentions", label: "Social Mentions" },
    { value: "reviews_oxen", label: "Reviews" },
  ],
  finance: [
    { value: "financial_news", label: "Financial News" },
    { value: "fundraisings", label: "Fundraising Rounds" },
  ],
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  linkedin: <Linkedin size={14} />,
  twitter: <span style={{ fontSize: 13, fontWeight: 700 }}>𝕏</span>,
  reddit: <span style={{ fontSize: 14 }}>🔴</span>,
  github: <Github size={14} />,
  google: <Globe size={14} />,
  news: <Newspaper size={14} />,
  website: <Globe size={14} />,
  review_site: <Star size={14} />,
  regulatory: <FileText size={14} />,
  conference_site: <Calendar size={14} />,
}

const SENTIMENT_COLORS: Record<string, { bg: string; text: string }> = {
  positive: { bg: "rgba(34,197,94,0.12)", text: "#22C55E" },
  negative: { bg: "rgba(239,68,68,0.12)", text: "#EF4444" },
  neutral: { bg: "rgba(255,255,255,0.06)", text: TEXT_TERTIARY },
}

const RELEVANCE_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "rgba(239,68,68,0.2)", text: "#EF4444" },
  high: { bg: "rgba(239,68,68,0.12)", text: "#F87171" },
  medium: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B" },
  low: { bg: "rgba(255,255,255,0.06)", text: TEXT_TERTIARY },
}

type Research = {
  id: string
  title: string
  category: string
  subcategory: string | null
  query: string | null
  type: string
  frequency: string | null
  lastRunAt: string | null
  nextRunAt: string | null
  status: string
  createdAt: string
  resultCount: number
  unreadCount: number
}

type Result = {
  id: string
  researchId: string
  title: string
  summary: string
  source: string | null
  sourceType: string | null
  sentiment: string | null
  relevance: string
  actionable: boolean
  read: boolean
  starred: boolean
  metadata: Record<string, unknown> | null
  createdAt: string
  research: { title: string; category: string; subcategory: string | null }
}

export default function IntelPage() {
  const [category, setCategory] = useState("all")
  const [researches, setResearches] = useState<Research[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [selectedResearch, setSelectedResearch] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [expandedResult, setExpandedResult] = useState<string | null>(null)
  const [showConferenceModal, setShowConferenceModal] = useState<string | null>(null)
  const [conferenceAttendees, setConferenceAttendees] = useState("")
  const [employees, setEmployees] = useState<{ id: string; name: string; email: string }[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [runningCron, setRunningCron] = useState(false)

  // New research form state
  const [formTitle, setFormTitle] = useState("")
  const [formCategory, setFormCategory] = useState("marketing")
  const [formSubcategory, setFormSubcategory] = useState("")
  const [formQuery, setFormQuery] = useState("")
  const [formType, setFormType] = useState("one_time")
  const [formFrequency, setFormFrequency] = useState("weekly")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        const rl = d.employee?.roleLevel ?? "member"
        if (rl === "super_admin" || rl === "admin") setIsAdmin(true)
      })
      .catch(() => {})
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => setEmployees((d.employees || []).map((e: Record<string, string>) => ({ id: e.id, name: e.name, email: e.email }))))
      .catch(() => {})
  }, [])

  const fetchResearches = useCallback(() => {
    const qs = category !== "all" ? `?category=${category}` : ""
    fetch(`/api/intel/researches${qs}`)
      .then((r) => r.json())
      .then((d) => setResearches(d.researches || []))
      .catch(() => {})
  }, [category])

  const fetchResults = useCallback(() => {
    setLoading(true)
    let url = "/api/intel/results/feed?"
    if (selectedResearch) {
      url = `/api/intel/results?researchId=${selectedResearch}&`
    } else if (category !== "all") {
      url += `category=${category}&`
    }
    url += "limit=50"
    fetch(url)
      .then((r) => r.json())
      .then((d) => setResults(d.results || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category, selectedResearch])

  useEffect(() => { fetchResearches() }, [fetchResearches])
  useEffect(() => { fetchResults() }, [fetchResults])

  const runResearch = async (id: string) => {
    setRunningId(id)
    try {
      await fetch(`/api/intel/run/${id}`, { method: "POST" })
      fetchResearches()
      fetchResults()
    } catch { /* empty */ }
    setRunningId(null)
  }

  const runAllDue = async () => {
    setRunningCron(true)
    try {
      await fetch("/api/intel/cron", { method: "POST" })
      fetchResearches()
      fetchResults()
    } catch { /* empty */ }
    setRunningCron(false)
  }

  const toggleStar = async (id: string, current: boolean) => {
    await fetch(`/api/intel/results/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: !current }),
    })
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, starred: !current } : r)))
  }

  const markRead = async (id: string) => {
    await fetch(`/api/intel/results/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    })
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, read: true } : r)))
  }

  const createResearch = async () => {
    if (!formTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/intel/researches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          category: formCategory,
          subcategory: formSubcategory || null,
          query: formQuery || null,
          type: formType,
          frequency: formType === "recurring" ? formFrequency : null,
        }),
      })
      const data = await res.json()
      setShowModal(false)
      setFormTitle("")
      setFormQuery("")
      setFormSubcategory("")
      fetchResearches()

      // Auto-run the research
      if (data.research?.id) {
        runResearch(data.research.id)
      }
    } catch { /* empty */ }
    setCreating(false)
  }

  const deleteResearch = async (id: string) => {
    await fetch(`/api/intel/researches/${id}`, { method: "DELETE" })
    if (selectedResearch === id) setSelectedResearch(null)
    fetchResearches()
    fetchResults()
  }

  const pauseResearch = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "paused" ? "active" : "paused"
    await fetch(`/api/intel/researches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchResearches()
  }

  const acceptConference = async (resultId: string) => {
    const attendeeList = conferenceAttendees.split(",").map((s) => s.trim()).filter(Boolean)
    await fetch(`/api/intel/conferences/${resultId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendees: attendeeList }),
    })
    setShowConferenceModal(null)
    setConferenceAttendees("")
    fetchResults()
  }

  const rejectConference = async (resultId: string) => {
    await fetch(`/api/intel/conferences/${resultId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    fetchResults()
  }

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }

  const categories = ["all", "marketing", "ai_tools", "competitors", "regulations", "conferences", "oxen", "finance"]

  return (
    <div style={{ padding: "32px 40px", minHeight: "100vh", background: VOID }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 28, color: TEXT_PRIMARY, margin: 0 }}>Intel</h1>
          <p style={{ fontSize: 13, color: TEXT_TERTIARY, margin: "4px 0 0" }}>Strategic Intelligence Hub</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={runAllDue}
              disabled={runningCron}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG,
                color: TEXT_SECONDARY,
                fontSize: 12,
                cursor: "pointer",
                opacity: runningCron ? 0.5 : 1,
              }}
            >
              <RefreshCw size={13} className={runningCron ? "animate-spin" : ""} />
              Run All Due
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: `linear-gradient(135deg, ${ROSE_GOLD}, #D4A5A2)`,
              color: VOID,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
            New Research
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2" style={{ marginBottom: 24, overflowX: "auto" }}>
        {categories.map((cat) => {
          const active = category === cat
          const color = CATEGORY_COLORS[cat] || TEXT_SECONDARY
          return (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setSelectedResearch(null) }}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: active ? `1px solid ${color}` : `1px solid ${CARD_BORDER}`,
                background: active ? `${color}15` : "transparent",
                color: active ? color : TEXT_SECONDARY,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {cat !== "all" && <span style={{ marginRight: 4 }}>{CATEGORY_ICONS[cat]}</span>}
              {CATEGORY_LABELS[cat]}
            </button>
          )
        })}
      </div>

      {/* Main layout */}
      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* Left panel — research list */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div
            onClick={() => setSelectedResearch(null)}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: !selectedResearch ? `${ROSE_GOLD}10` : "transparent",
              border: !selectedResearch ? `1px solid ${ROSE_GOLD}30` : `1px solid transparent`,
              cursor: "pointer",
              marginBottom: 4,
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 13, color: !selectedResearch ? ROSE_GOLD : TEXT_SECONDARY, fontWeight: 500 }}>
              All Results
            </span>
          </div>

          <div style={{ marginTop: 8 }}>
            {researches.map((r) => {
              const active = selectedResearch === r.id
              const catColor = CATEGORY_COLORS[r.category] || TEXT_SECONDARY
              const statusDot = r.status === "active" ? "#22C55E" : r.status === "paused" ? "#F59E0B" : TEXT_TERTIARY

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedResearch(r.id)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: active ? `${catColor}10` : "transparent",
                    border: active ? `1px solid ${catColor}30` : "1px solid transparent",
                    cursor: "pointer",
                    marginBottom: 2,
                    transition: "all 0.2s",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot, flexShrink: 0 }} />
                    <span style={{
                      fontSize: 13,
                      color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
                      fontWeight: r.unreadCount > 0 ? 600 : 400,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {r.title}
                    </span>
                    {r.unreadCount > 0 && (
                      <span style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 10,
                        background: `${catColor}20`,
                        color: catColor,
                        fontWeight: 600,
                      }}>
                        {r.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                    <span style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: r.type === "recurring" ? "rgba(129,140,248,0.12)" : "rgba(255,255,255,0.06)",
                      color: r.type === "recurring" ? "#818CF8" : TEXT_TERTIARY,
                    }}>
                      {r.type === "recurring" ? `↻ ${r.frequency}` : "one-time"}
                    </span>
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>{r.resultCount} results</span>
                  </div>
                  {r.type === "recurring" && (
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 2 }}>
                      {r.lastRunAt ? `Last: ${formatDate(r.lastRunAt)}` : "Never run"}
                      {r.nextRunAt && ` · Next: ${formatDate(r.nextRunAt)}`}
                    </div>
                  )}
                  {/* Action buttons */}
                  <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); runResearch(r.id) }}
                      disabled={runningId === r.id}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: `1px solid ${CARD_BORDER}`,
                        background: "transparent",
                        color: runningId === r.id ? ROSE_GOLD : TEXT_TERTIARY,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      {runningId === r.id ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                      {runningId === r.id ? "Running..." : "Run"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); pauseResearch(r.id, r.status) }}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: `1px solid ${CARD_BORDER}`,
                        background: "transparent",
                        color: TEXT_TERTIARY,
                        cursor: "pointer",
                      }}
                    >
                      {r.status === "paused" ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteResearch(r.id) }}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: `1px solid ${CARD_BORDER}`,
                        background: "transparent",
                        color: "#EF4444",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}

            {researches.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center", color: TEXT_TERTIARY, fontSize: 13 }}>
                No researches yet.
                <br />
                Click &quot;+ New Research&quot; to start.
              </div>
            )}
          </div>
        </div>

        {/* Main area — results feed */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <Loader2 size={24} className="animate-spin" style={{ color: ROSE_GOLD, margin: "0 auto" }} />
              <p style={{ color: TEXT_TERTIARY, fontSize: 13, marginTop: 12 }}>Sentinel is researching...</p>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: TEXT_TERTIARY }}>
              <Sparkles size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>No intel results yet</p>
              <p style={{ fontSize: 12 }}>Launch a research to populate the feed</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.map((r) => {
                const catColor = CATEGORY_COLORS[r.research.category] || TEXT_SECONDARY
                const sentColor = SENTIMENT_COLORS[r.sentiment || "neutral"]
                const relColor = RELEVANCE_COLORS[r.relevance]
                const expanded = expandedResult === r.id
                const meta = r.metadata as Record<string, unknown> | null
                const isConference = r.research.category === "conferences"
                const isAccepted = meta?.accepted === true
                const isRejected = meta?.rejected === true
                const isMarketing = r.research.category === "marketing"
                const isCritical = r.relevance === "critical"

                return (
                  <div
                    key={r.id}
                    onClick={() => { if (!r.read) markRead(r.id); setExpandedResult(expanded ? null : r.id) }}
                    style={{
                      padding: "14px 18px",
                      borderRadius: 10,
                      background: CARD_BG,
                      border: `1px solid ${isCritical ? "rgba(239,68,68,0.3)" : CARD_BORDER}`,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      borderLeft: !r.read ? `3px solid ${catColor}` : `3px solid transparent`,
                      position: "relative",
                    }}
                  >
                    {/* Critical pulse */}
                    {isCritical && (
                      <span style={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#EF4444",
                        animation: "pulse 2s infinite",
                      }} />
                    )}

                    {/* Top row */}
                    <div className="flex items-start gap-3">
                      {/* Source icon */}
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: `${catColor}15`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: catColor,
                        flexShrink: 0,
                      }}>
                        {SOURCE_ICONS[r.sourceType || ""] || <Globe size={14} />}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-2">
                          <span style={{
                            fontSize: 14,
                            fontWeight: r.read ? 400 : 600,
                            color: TEXT_PRIMARY,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: expanded ? "normal" : "nowrap",
                          }}>
                            {r.title}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleStar(r.id, r.starred) }}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            <Star size={14} fill={r.starred ? "#F59E0B" : "none"} color={r.starred ? "#F59E0B" : TEXT_TERTIARY} />
                          </button>
                        </div>

                        {/* Badges row */}
                        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 6 }}>
                          <span style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: `${catColor}15`,
                            color: catColor,
                          }}>
                            {CATEGORY_ICONS[r.research.category]} {CATEGORY_LABELS[r.research.category]}
                          </span>
                          {r.sourceType && (
                            <span style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "rgba(255,255,255,0.06)",
                              color: TEXT_TERTIARY,
                            }}>
                              {r.sourceType}
                            </span>
                          )}
                          <span style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: sentColor.bg,
                            color: sentColor.text,
                          }}>
                            {r.sentiment}
                          </span>
                          <span style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: relColor.bg,
                            color: relColor.text,
                            fontWeight: isCritical ? 700 : 400,
                          }}>
                            {r.relevance}
                          </span>
                          {r.actionable && (
                            <span style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "rgba(245,158,11,0.12)",
                              color: "#F59E0B",
                            }}>
                              ⚡ actionable
                            </span>
                          )}
                          {isAccepted && (
                            <span style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "rgba(34,197,94,0.15)",
                              color: "#22C55E",
                              fontWeight: 600,
                            }}>
                              ✅ Accepted{meta?.attendees ? ` — ${(meta.attendees as string[]).join(", ")}` : ""}
                            </span>
                          )}
                          {isRejected && (
                            <span style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "rgba(239,68,68,0.12)",
                              color: "#EF4444",
                            }}>
                              ❌ Rejected
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: TEXT_TERTIARY, marginLeft: "auto" }}>
                            {formatDate(r.createdAt)}
                          </span>
                        </div>

                        {/* Summary */}
                        <p style={{
                          fontSize: 13,
                          color: TEXT_SECONDARY,
                          lineHeight: 1.5,
                          marginTop: 8,
                          display: expanded ? "block" : "-webkit-box",
                          WebkitLineClamp: expanded ? undefined : 2,
                          WebkitBoxOrient: "vertical",
                          overflow: expanded ? "visible" : "hidden",
                        }}>
                          {r.summary}
                        </p>

                        {/* Expanded details */}
                        {expanded && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
                            {/* Metadata */}
                            {meta && Object.keys(meta).filter(k => !["accepted","rejected","rejectionReason","attendees","eventId","wikiPageSlug"].includes(k)).length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                {Object.entries(meta)
                                  .filter(([k]) => !["accepted","rejected","rejectionReason","attendees","eventId","wikiPageSlug"].includes(k))
                                  .map(([k, v]) => (
                                    <div key={k} className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                                      <span style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "capitalize" }}>{k.replace(/_/g, " ")}:</span>
                                      <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>{String(v)}</span>
                                    </div>
                                  ))}
                              </div>
                            )}

                            {/* Source link */}
                            {r.source && (
                              <a
                                href={r.source.startsWith("http") ? r.source : `https://${r.source}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  color: ROSE_GOLD,
                                  textDecoration: "none",
                                  marginBottom: 12,
                                }}
                              >
                                <ExternalLink size={11} />
                                {r.source.length > 60 ? r.source.slice(0, 60) + "..." : r.source}
                              </a>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Conference actions */}
                              {isConference && !isAccepted && !isRejected && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setShowConferenceModal(r.id) }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      padding: "4px 10px",
                                      borderRadius: 6,
                                      border: "none",
                                      background: "rgba(34,197,94,0.15)",
                                      color: "#22C55E",
                                      fontSize: 11,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <CheckCircle size={12} />
                                    Accept — Add to Calendar
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); rejectConference(r.id) }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      padding: "4px 10px",
                                      borderRadius: 6,
                                      border: "none",
                                      background: "rgba(239,68,68,0.12)",
                                      color: "#EF4444",
                                      fontSize: 11,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <XCircle size={12} />
                                    Reject
                                  </button>
                                </>
                              )}

                              {/* Marketing actions */}
                              {isMarketing && r.research.subcategory === "competitive_intel" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); window.open("https://www.linkedin.com/feed/", "_blank") }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    border: "none",
                                    background: "rgba(192,139,136,0.15)",
                                    color: ROSE_GOLD,
                                    fontSize: 11,
                                    cursor: "pointer",
                                  }}
                                >
                                  <Megaphone size={12} />
                                  Inspire New Post
                                </button>
                              )}

                              {isMarketing && (r.research.subcategory === "content_ideas" || r.research.subcategory === "repost_suggestions") && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); window.open("https://www.linkedin.com/feed/", "_blank") }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    border: "none",
                                    background: "rgba(192,139,136,0.15)",
                                    color: ROSE_GOLD,
                                    fontSize: 11,
                                    cursor: "pointer",
                                  }}
                                >
                                  <TrendingUp size={12} />
                                  Open on LinkedIn
                                </button>
                              )}

                              {/* Read/unread toggle */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  fetch(`/api/intel/results/${r.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ read: !r.read }),
                                  })
                                  setResults((prev) => prev.map((x) => (x.id === r.id ? { ...x, read: !r.read } : x)))
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  border: `1px solid ${CARD_BORDER}`,
                                  background: "transparent",
                                  color: TEXT_TERTIARY,
                                  fontSize: 11,
                                  cursor: "pointer",
                                }}
                              >
                                {r.read ? <EyeOff size={12} /> : <Eye size={12} />}
                                {r.read ? "Mark unread" : "Mark read"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Research Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#0F1118",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12,
              padding: 28,
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 22, color: TEXT_PRIMARY, margin: 0 }}>
                New Research
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_TERTIARY }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Title */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Title *</span>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Monitor Mercury pricing changes"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: CARD_BG,
                  color: TEXT_PRIMARY,
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </label>

            {/* Category */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Category *</span>
              <select
                value={formCategory}
                onChange={(e) => { setFormCategory(e.target.value); setFormSubcategory("") }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: "#0A0C10",
                  color: TEXT_PRIMARY,
                  fontSize: 13,
                  outline: "none",
                }}
              >
                {Object.entries(CATEGORY_LABELS).filter(([k]) => k !== "all").map(([k, v]) => (
                  <option key={k} value={k}>{CATEGORY_ICONS[k]} {v}</option>
                ))}
              </select>
            </label>

            {/* Subcategory */}
            {SUBCATEGORIES[formCategory] && (
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Subcategory</span>
                <select
                  value={formSubcategory}
                  onChange={(e) => setFormSubcategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${CARD_BORDER}`,
                    background: "#0A0C10",
                    color: TEXT_PRIMARY,
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="">Select subcategory...</option>
                  {SUBCATEGORIES[formCategory].map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Query */}
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Research Query</span>
              <textarea
                value={formQuery}
                onChange={(e) => setFormQuery(e.target.value)}
                placeholder="Describe what to look for in detail..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: CARD_BG,
                  color: TEXT_PRIMARY,
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </label>

            {/* Type toggle */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Type</span>
              <div className="flex gap-2">
                {["one_time", "recurring"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFormType(t)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 8,
                      border: formType === t ? `1px solid ${ROSE_GOLD}` : `1px solid ${CARD_BORDER}`,
                      background: formType === t ? `${ROSE_GOLD}15` : "transparent",
                      color: formType === t ? ROSE_GOLD : TEXT_SECONDARY,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {t === "one_time" ? "One-Time" : "Recurring"}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency */}
            {formType === "recurring" && (
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, display: "block", marginBottom: 6 }}>Frequency</span>
                <select
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${CARD_BORDER}`,
                    background: "#0A0C10",
                    color: TEXT_PRIMARY,
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
            )}

            {/* Submit */}
            <button
              onClick={createResearch}
              disabled={creating || !formTitle.trim()}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                background: `linear-gradient(135deg, ${ROSE_GOLD}, #D4A5A2)`,
                color: VOID,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                opacity: creating || !formTitle.trim() ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {creating ? "Launching..." : "Launch Research"}
            </button>
          </div>
        </div>
      )}

      {/* Conference Accept Modal */}
      {showConferenceModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowConferenceModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              background: "#0F1118",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12,
              padding: 28,
            }}
          >
            <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: "0 0 16px" }}>
              Accept Conference
            </h3>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 16 }}>Who is attending?</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {employees.map((emp) => {
                const selected = conferenceAttendees.split(",").map((s) => s.trim()).includes(emp.email || emp.name)
                return (
                  <button
                    key={emp.id}
                    onClick={() => {
                      const val = emp.email || emp.name
                      const list = conferenceAttendees.split(",").map((s) => s.trim()).filter(Boolean)
                      if (selected) {
                        setConferenceAttendees(list.filter((x) => x !== val).join(", "))
                      } else {
                        setConferenceAttendees([...list, val].join(", "))
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: selected ? `1px solid #22C55E` : `1px solid ${CARD_BORDER}`,
                      background: selected ? "rgba(34,197,94,0.1)" : "transparent",
                      color: selected ? "#22C55E" : TEXT_SECONDARY,
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Users size={12} />
                    {emp.name}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConferenceModal(null)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: "transparent",
                  color: TEXT_SECONDARY,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => acceptConference(showConferenceModal)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(34,197,94,0.2)",
                  color: "#22C55E",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ✅ Confirm & Add to Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
