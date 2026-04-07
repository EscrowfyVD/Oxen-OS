"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts"

/* ── Design tokens ── */
const CARD_BG = "var(--card-bg)"
const CARD_BORDER = "var(--card-border)"
const TEXT_PRIMARY = "var(--text-primary)"
const TEXT_SECONDARY = "var(--text-secondary)"
const TEXT_TERTIARY = "var(--text-tertiary)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"
const RED = "#F87171"
const INDIGO = "#818CF8"
const CYAN = "#22D3EE"

/* ── Vertical colors ── */
const VERTICAL_COLORS: Record<string, string> = {
  "FinTech / Crypto": INDIGO,
  "Family Office": ROSE_GOLD,
  "CSP / Fiduciaries": AMBER,
  "Luxury Assets": "#A78BFA",
  "iGaming": GREEN,
  "Yacht Brokers": CYAN,
  "Import / Export": "#60A5FA",
}

const VERTICAL_LIST = Object.keys(VERTICAL_COLORS)

/* ── Article statuses ── */
const ARTICLE_STATUSES: Record<string, { label: string; color: string }> = {
  queued: { label: "Queued", color: TEXT_TERTIARY },
  draft: { label: "Draft", color: AMBER },
  in_review: { label: "In Review", color: "#60A5FA" },
  published: { label: "Published", color: GREEN },
  decaying: { label: "Decaying", color: RED },
  archived: { label: "Archived", color: "var(--text-tertiary)" },
}

/* ── Types ── */
interface Article {
  id: string
  title: string
  slug: string
  vertical: string
  status: string
  content: string | null
  metaDescription: string | null
  primaryKeyword: string | null
  wordCount: number | null
  sourceArticles: { title: string; url: string }[]
  schemaMarkup: Record<string, unknown> | null
  sessions7d: number | null
  sessions30d: number | null
  keywordsRanking: number | null
  bestPosition: number | null
  socialPost: string | null
  publishedAt: string | null
  scheduledAt: string | null
  createdAt: string
}

interface CalendarDay {
  date: string
  articles: { id: string; title: string; vertical: string; status: string }[]
}

type ViewMode = "list" | "calendar" | "coverage"

/* ── Shared styles ── */
const cardStyle: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  padding: 20,
  backdropFilter: "blur(20px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 6,
  padding: "8px 12px",
  color: TEXT_PRIMARY,
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  cursor: "pointer",
  paddingRight: 28,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(240,240,242,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 6,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Bellfair', serif",
  fontSize: 18,
  color: TEXT_PRIMARY,
  marginBottom: 14,
}

const skeletonPulse: React.CSSProperties = {
  background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
  borderRadius: 6,
}

function fmtNum(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`
  return val.toLocaleString()
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/* ── Button style helper ── */
function btnStyle(opts?: { primary?: boolean; danger?: boolean; active?: boolean; color?: string }): React.CSSProperties {
  const { primary, danger, active, color } = opts ?? {}
  if (primary) {
    return {
      padding: "7px 16px",
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif",
      background: ROSE_GOLD,
      color: "#1a1a1a",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
    }
  }
  if (danger) {
    return {
      padding: "6px 14px",
      fontSize: 10,
      fontFamily: "'DM Sans', sans-serif",
      background: "transparent",
      border: `1px solid ${CARD_BORDER}`,
      borderRadius: 6,
      color: RED,
      cursor: "pointer",
    }
  }
  return {
    padding: "7px 16px",
    fontSize: 11,
    fontWeight: active ? 600 : 500,
    fontFamily: "'DM Sans', sans-serif",
    background: active ? "rgba(192,139,136,0.12)" : "transparent",
    color: color ?? (active ? ROSE_GOLD : TEXT_SECONDARY),
    border: `1px solid ${active ? "rgba(192,139,136,0.3)" : CARD_BORDER}`,
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.15s",
  }
}

/* ── Modal overlay ── */
function ModalOverlay({ children, onClose, maxWidth = 560 }: { children: React.ReactNode; onClose: () => void; maxWidth?: number }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 16,
          padding: 28,
          backdropFilter: "blur(20px)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          width: "100%",
          maxWidth,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ── Custom tooltip for Recharts ── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: TEXT_TERTIARY, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || TEXT_PRIMARY, marginBottom: 2 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

/* ── Toast notification ── */
function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 2000,
        padding: "10px 20px",
        borderRadius: 8,
        fontSize: 12,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
        color: type === "success" ? GREEN : RED,
        background: CARD_BG,
        border: `1px solid ${type === "success" ? GREEN : RED}30`,
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {message}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  BlogWriterTab                                                 */
/* ═══════════════════════════════════════════════════════════════ */
export default function BlogWriterTab() {
  /* ── Core state ── */
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [statusFilter, setStatusFilter] = useState("")
  const [verticalFilter, setVerticalFilter] = useState("")

  /* ── Calendar state ── */
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)

  /* ── Modal state ── */
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genForm, setGenForm] = useState({ topic: "", vertical: "", targetKeyword: "" })
  const [manualForm, setManualForm] = useState({
    title: "",
    slug: "",
    metaDescription: "",
    content: "",
    verticals: [] as string[],
    primaryKeyword: "",
  })

  /* ── Detail state ── */
  const [showSchema, setShowSchema] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [scheduleDate, setScheduleDate] = useState("")

  /* ── Toast ── */
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  /* ── Fetch articles ── */
  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/seo/articles")
      if (res.ok) {
        const json = await res.json()
        setArticles(json.articles ?? [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  /* ── Fetch calendar data ── */
  useEffect(() => {
    if (viewMode !== "calendar") return
    setCalendarLoading(true)
    fetch(`/api/seo/articles/calendar?month=${calendarMonth}`)
      .then((r) => r.json())
      .then((data) => setCalendarData(data.days ?? []))
      .catch(() => {})
      .finally(() => setCalendarLoading(false))
  }, [viewMode, calendarMonth])

  /* ── Filtered articles ── */
  const filteredArticles = useMemo(() => {
    let list = [...articles]
    if (statusFilter) list = list.filter((a) => a.status === statusFilter)
    if (verticalFilter) list = list.filter((a) => a.vertical === verticalFilter)
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [articles, statusFilter, verticalFilter])

  const selectedArticle = articles.find((a) => a.id === selectedId) ?? null

  /* ── Vertical coverage data ── */
  const verticalCoverageData = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const published = articles.filter(
      (a) => a.status === "published" && a.publishedAt && new Date(a.publishedAt) >= thirtyDaysAgo
    )
    const counts: Record<string, number> = {}
    for (const a of published) {
      counts[a.vertical] = (counts[a.vertical] || 0) + 1
    }
    return VERTICAL_LIST.map((v) => ({
      vertical: v,
      count: counts[v] || 0,
      fill: VERTICAL_COLORS[v],
    }))
  }, [articles])

  /* ── Scan News ── */
  const handleScanNews = async () => {
    try {
      const res = await fetch("/api/seo/news/scan", { method: "POST" })
      if (res.ok) {
        setToast({ message: "News scan triggered successfully", type: "success" })
      } else {
        setToast({ message: "Failed to trigger news scan", type: "error" })
      }
    } catch {
      setToast({ message: "Network error scanning news", type: "error" })
    }
  }

  /* ── Generate article ── */
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch("/api/seo/articles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: genForm.topic || undefined,
          vertical: genForm.vertical || undefined,
          targetKeyword: genForm.targetKeyword || undefined,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setShowGenerateModal(false)
        setGenForm({ topic: "", vertical: "", targetKeyword: "" })
        await fetchArticles()
        if (json.article?.id) setSelectedId(json.article.id)
        setViewMode("list")
      } else {
        setToast({ message: "Failed to generate article", type: "error" })
      }
    } catch {
      setToast({ message: "Network error generating article", type: "error" })
    } finally {
      setGenerating(false)
    }
  }

  /* ── Save manual article ── */
  const handleSaveManual = async () => {
    try {
      const res = await fetch("/api/seo/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualForm.title,
          slug: manualForm.slug,
          metaDescription: manualForm.metaDescription,
          content: manualForm.content,
          vertical: manualForm.verticals[0] ?? "",
          primaryKeyword: manualForm.primaryKeyword,
        }),
      })
      if (res.ok) {
        setShowManualModal(false)
        setManualForm({ title: "", slug: "", metaDescription: "", content: "", verticals: [], primaryKeyword: "" })
        fetchArticles()
        setToast({ message: "Article saved", type: "success" })
      } else {
        setToast({ message: "Failed to save article", type: "error" })
      }
    } catch {
      setToast({ message: "Network error saving article", type: "error" })
    }
  }

  /* ── Publish article ── */
  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/seo/articles/${id}/publish`, { method: "POST" })
      if (res.ok) {
        fetchArticles()
        setToast({ message: "Article published", type: "success" })
      } else {
        setToast({ message: "Failed to publish", type: "error" })
      }
    } catch {
      setToast({ message: "Network error", type: "error" })
    }
  }

  /* ── Refresh with AI ── */
  const handleRefresh = async (id: string) => {
    try {
      const res = await fetch(`/api/seo/articles/${id}/refresh`, { method: "POST" })
      if (res.ok) {
        fetchArticles()
        setToast({ message: "Article refreshed", type: "success" })
      } else {
        setToast({ message: "Failed to refresh", type: "error" })
      }
    } catch {
      setToast({ message: "Network error", type: "error" })
    }
  }

  /* ── Archive ── */
  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/seo/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      })
      if (res.ok) {
        fetchArticles()
        setToast({ message: "Article archived", type: "success" })
      }
    } catch {
      setToast({ message: "Network error", type: "error" })
    }
  }

  /* ── Schedule ── */
  const handleSchedule = async (id: string, date: string) => {
    try {
      const res = await fetch(`/api/seo/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "queued", scheduledAt: date }),
      })
      if (res.ok) {
        setShowSchedulePicker(false)
        setScheduleDate("")
        fetchArticles()
        setToast({ message: `Scheduled for ${date}`, type: "success" })
      }
    } catch {
      setToast({ message: "Network error", type: "error" })
    }
  }

  /* ── Copy social post ── */
  const copySocialPost = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  /* ── Calendar helpers ── */
  const calendarMonthDate = new Date(calendarMonth + "-01")
  const calendarYear = calendarMonthDate.getFullYear()
  const calendarMonthIdx = calendarMonthDate.getMonth()
  const daysInMonth = new Date(calendarYear, calendarMonthIdx + 1, 0).getDate()
  const firstDayOfWeek = new Date(calendarYear, calendarMonthIdx, 1).getDay()
  const calendarMap: Record<string, CalendarDay["articles"]> = {}
  for (const day of calendarData) {
    calendarMap[day.date] = day.articles
  }

  const prevMonth = () => {
    const d = new Date(calendarYear, calendarMonthIdx - 1, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  const nextMonth = () => {
    const d = new Date(calendarYear, calendarMonthIdx + 1, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
        <div style={{ display: "flex", gap: 14, height: 500 }}>
          <div style={{ ...cardStyle, width: 320, flexShrink: 0 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ ...skeletonPulse, height: 60, marginBottom: 8 }} />
            ))}
          </div>
          <div style={{ ...cardStyle, flex: 1 }}>
            <div style={{ ...skeletonPulse, height: 24, width: "40%", marginBottom: 16 }} />
            <div style={{ ...skeletonPulse, height: 200 }} />
          </div>
        </div>
      </div>
    )
  }

  /* ── Status badge helper ── */
  const statusBadge = (status: string) => {
    const conf = ARTICLE_STATUSES[status] ?? ARTICLE_STATUSES.queued
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: 999,
          fontSize: 9,
          fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif",
          background: `${conf.color}18`,
          color: conf.color,
        }}
      >
        {conf.label}
      </span>
    )
  }

  /* ── Render ── */
  return (
    <div>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Header Row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setShowManualModal(true)} style={btnStyle()}>
          + Write Manually
        </button>
        <button onClick={() => setShowGenerateModal(true)} style={btnStyle({ primary: true })}>
          Generate Article
        </button>
        <button onClick={handleScanNews} style={btnStyle()}>
          Scan News
        </button>

        <div style={{ flex: 1 }} />

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...selectStyle, width: 130 }}
        >
          <option value="">All Status</option>
          {Object.entries(ARTICLE_STATUSES).map(([id, s]) => (
            <option key={id} value={id}>{s.label}</option>
          ))}
        </select>

        {/* Vertical filter */}
        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value)}
          style={{ ...selectStyle, width: 150 }}
        >
          <option value="">All Verticals</option>
          {VERTICAL_LIST.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        {/* View mode toggle */}
        <div style={{ display: "flex", gap: 0, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, overflow: "hidden" }}>
          {(["list", "calendar", "coverage"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "6px 14px",
                fontSize: 10,
                fontWeight: viewMode === mode ? 600 : 400,
                fontFamily: "'DM Sans', sans-serif",
                background: viewMode === mode ? "rgba(192,139,136,0.12)" : "transparent",
                color: viewMode === mode ? ROSE_GOLD : TEXT_TERTIARY,
                border: "none",
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.15s",
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/*  LIST VIEW                                  */}
      {/* ═══════════════════════════════════════════ */}
      {viewMode === "list" && (
        <div style={{ display: "flex", gap: 14, minHeight: 500 }}>
          {/* Left sidebar - Article list */}
          <div
            style={{
              ...cardStyle,
              width: 320,
              flexShrink: 0,
              overflowY: "auto",
              maxHeight: "70vh",
              padding: 10,
            }}
          >
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, padding: "8px 8px 12px", fontWeight: 500 }}>
              Article Queue ({filteredArticles.length})
            </div>
            {filteredArticles.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                No articles found
              </div>
            ) : (
              filteredArticles.map((article) => {
                const isActive = selectedId === article.id
                return (
                  <div
                    key={article.id}
                    onClick={() => {
                      setSelectedId(article.id)
                      setShowSchema(false)
                      setShowSchedulePicker(false)
                    }}
                    style={{
                      padding: "10px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: isActive ? "rgba(192,139,136,0.08)" : "transparent",
                      borderLeft: isActive ? `3px solid ${ROSE_GOLD}` : "3px solid transparent",
                      marginBottom: 2,
                      transition: "all 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: VERTICAL_COLORS[article.vertical] ?? TEXT_SECONDARY,
                          flexShrink: 0,
                          marginTop: 4,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: TEXT_PRIMARY,
                          fontFamily: "'DM Sans', sans-serif",
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          lineHeight: "1.4",
                          flex: 1,
                        }}
                      >
                        {article.title}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12 }}>
                      {statusBadge(article.status)}
                      {article.wordCount != null && (
                        <span style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                          {fmtNum(article.wordCount)} words
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {new Date(article.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Main area */}
          <div style={{ ...cardStyle, flex: 1, overflowY: "auto", maxHeight: "70vh" }}>
            {!selectedArticle ? (
              /* Empty state */
              <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_TERTIARY, marginBottom: 12 }}>
                  Select an article or generate a new one
                </div>
                <button onClick={() => setShowGenerateModal(true)} style={btnStyle({ primary: true })}>
                  Generate Article
                </button>
              </div>
            ) : (
              <div>
                {/* Article title */}
                <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 24, color: TEXT_PRIMARY, margin: "0 0 10px" }}>
                  {selectedArticle.title}
                </h2>

                {/* Meta bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  {statusBadge(selectedArticle.status)}
                  <span
                    style={{
                      padding: "2px 10px",
                      borderRadius: 999,
                      fontSize: 9,
                      fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
                      background: `${VERTICAL_COLORS[selectedArticle.vertical] ?? TEXT_SECONDARY}18`,
                      color: VERTICAL_COLORS[selectedArticle.vertical] ?? TEXT_SECONDARY,
                    }}
                  >
                    {selectedArticle.vertical}
                  </span>
                  {selectedArticle.publishedAt && (
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      Published {new Date(selectedArticle.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                  {selectedArticle.wordCount != null && (
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {fmtNum(selectedArticle.wordCount)} words
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 20 }}>
                  {/* Article content */}
                  <div style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
                    {selectedArticle.content ? (
                      <div
                        style={{
                          fontSize: 14,
                          lineHeight: 1.8,
                          color: TEXT_SECONDARY,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                        dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                      />
                    ) : (
                      <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                        No content generated yet.
                      </div>
                    )}

                    {/* Performance metrics */}
                    {selectedArticle.status === "published" && (
                      <div style={{ marginTop: 24 }}>
                        <div style={labelStyle}>Performance</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                          {[
                            { label: "7d Sessions", value: selectedArticle.sessions7d != null ? fmtNum(selectedArticle.sessions7d) : "--" },
                            { label: "30d Sessions", value: selectedArticle.sessions30d != null ? fmtNum(selectedArticle.sessions30d) : "--" },
                            { label: "KWs Ranking", value: selectedArticle.keywordsRanking != null ? String(selectedArticle.keywordsRanking) : "--" },
                            {
                              label: "Best Pos.",
                              value: selectedArticle.bestPosition != null ? `#${selectedArticle.bestPosition}` : "--",
                              color: selectedArticle.bestPosition != null && selectedArticle.bestPosition <= 10 ? GREEN : TEXT_PRIMARY,
                            },
                          ].map((stat) => (
                            <div key={stat.label} style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}` }}>
                              <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{stat.label}</div>
                              <div style={{ fontSize: 16, fontFamily: "'Bellfair', serif", color: (stat as { color?: string }).color ?? TEXT_PRIMARY }}>{stat.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                      <button
                        onClick={() => handlePublish(selectedArticle.id)}
                        style={{ ...btnStyle(), background: GREEN, color: "#1a1a1a", border: "none", fontWeight: 600 }}
                      >
                        Publish Now
                      </button>
                      <button
                        onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                        style={btnStyle({ active: showSchedulePicker })}
                      >
                        Schedule
                      </button>
                      <button onClick={() => handleRefresh(selectedArticle.id)} style={btnStyle({ color: CYAN })}>
                        Refresh with AI
                      </button>
                      <button onClick={() => handleArchive(selectedArticle.id)} style={btnStyle({ danger: true })}>
                        Archive
                      </button>
                    </div>

                    {/* Schedule date picker */}
                    {showSchedulePicker && (
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="datetime-local"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          style={{ ...inputStyle, width: 220 }}
                        />
                        <button
                          onClick={() => scheduleDate && handleSchedule(selectedArticle.id, scheduleDate)}
                          disabled={!scheduleDate}
                          style={{
                            ...btnStyle({ primary: true }),
                            opacity: scheduleDate ? 1 : 0.4,
                            cursor: scheduleDate ? "pointer" : "not-allowed",
                          }}
                        >
                          Confirm
                        </button>
                      </div>
                    )}

                    {/* Social post section */}
                    {selectedArticle.socialPost && (
                      <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${CARD_BORDER}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ ...labelStyle, marginBottom: 0 }}>Social Post</span>
                          <button
                            onClick={() => copySocialPost(selectedArticle.socialPost!)}
                            style={{
                              padding: "4px 12px",
                              fontSize: 10,
                              fontFamily: "'DM Sans', sans-serif",
                              background: "transparent",
                              border: `1px solid ${CARD_BORDER}`,
                              borderRadius: 4,
                              color: copied ? GREEN : TEXT_SECONDARY,
                              cursor: "pointer",
                            }}
                          >
                            {copied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <div style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                          {selectedArticle.socialPost}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right sidebar - meta */}
                  <div style={{ width: 200, flexShrink: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <div style={labelStyle}>Meta Description</div>
                        <div style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
                          {selectedArticle.metaDescription || "--"}
                        </div>
                      </div>
                      <div>
                        <div style={labelStyle}>Slug</div>
                        <div style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", wordBreak: "break-all" }}>
                          {selectedArticle.slug || "--"}
                        </div>
                      </div>
                      <div>
                        <div style={labelStyle}>Primary Keyword</div>
                        <div style={{ fontSize: 11, color: ROSE_GOLD, fontFamily: "'DM Sans', sans-serif" }}>
                          {selectedArticle.primaryKeyword || "--"}
                        </div>
                      </div>

                      {/* Source articles */}
                      {(selectedArticle.sourceArticles ?? []).length > 0 && (
                        <div>
                          <div style={labelStyle}>Source Articles</div>
                          {selectedArticle.sourceArticles.map((s, i) => (
                            <a
                              key={i}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "block",
                                fontSize: 10,
                                color: CYAN,
                                fontFamily: "'DM Sans', sans-serif",
                                marginBottom: 4,
                                textDecoration: "none",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {s.title}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Schema preview */}
                      {selectedArticle.schemaMarkup && (
                        <div>
                          <button
                            onClick={() => setShowSchema(!showSchema)}
                            style={{
                              ...labelStyle,
                              cursor: "pointer",
                              background: "transparent",
                              border: "none",
                              padding: 0,
                            }}
                          >
                            Schema Markup {showSchema ? "\u25B2" : "\u25BC"}
                          </button>
                          {showSchema && (
                            <pre
                              style={{
                                fontSize: 9,
                                color: TEXT_TERTIARY,
                                fontFamily: "monospace",
                                background: "rgba(255,255,255,0.02)",
                                padding: 8,
                                borderRadius: 6,
                                overflow: "auto",
                                maxHeight: 200,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-all",
                              }}
                            >
                              {JSON.stringify(selectedArticle.schemaMarkup, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  CALENDAR VIEW                              */}
      {/* ═══════════════════════════════════════════ */}
      {viewMode === "calendar" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={prevMonth} style={btnStyle()}>
              &lt; Prev
            </button>
            <span style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY }}>
              {calendarMonthDate.toLocaleString("default", { month: "long", year: "numeric" })}
            </span>
            <button onClick={nextMonth} style={btnStyle()}>
              Next &gt;
            </button>
          </div>

          {calendarLoading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              Loading calendar...
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    style={{
                      textAlign: "center",
                      fontSize: 9,
                      color: TEXT_TERTIARY,
                      fontFamily: "'DM Sans', sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      padding: 4,
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ minHeight: 80 }} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${calendarMonth}-${String(day).padStart(2, "0")}`
                  const dayArticles = calendarMap[dateStr] ?? []
                  const hasArticles = dayArticles.length > 0
                  return (
                    <div
                      key={day}
                      style={{
                        minHeight: 80,
                        padding: 6,
                        borderRadius: 6,
                        border: `1px solid ${CARD_BORDER}`,
                        background: hasArticles ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.005)",
                      }}
                    >
                      <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
                        {day}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {dayArticles.map((a) => {
                          const dotColor = VERTICAL_COLORS[a.vertical] ?? TEXT_SECONDARY
                          const isScheduled = a.status === "scheduled" || a.status === "queued"
                          return (
                            <div
                              key={a.id}
                              title={a.title}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: isScheduled ? "transparent" : dotColor,
                                border: isScheduled ? `1.5px dashed ${dotColor}` : `1.5px solid ${dotColor}`,
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                setSelectedId(a.id)
                                setViewMode("list")
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  COVERAGE VIEW                              */}
      {/* ═══════════════════════════════════════════ */}
      {viewMode === "coverage" && (
        <div>
          <div style={cardStyle}>
            <div style={sectionTitle}>Articles Published per Vertical (Last 30 Days)</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={verticalCoverageData} layout="horizontal" margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="vertical"
                  tick={{ fontSize: 9, fill: TEXT_TERTIARY }}
                  axisLine={false}
                  tickLine={false}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: TEXT_TERTIARY }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Articles" radius={[4, 4, 0, 0]}>
                  {verticalCoverageData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mini cards per vertical */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginTop: 14 }}>
            {verticalCoverageData.map((d) => (
              <div
                key={d.vertical}
                style={{
                  ...cardStyle,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.fill, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                    {d.vertical}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontFamily: "'Bellfair', serif", color: d.fill }}>
                  {d.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  GENERATE ARTICLE MODAL                     */}
      {/* ═══════════════════════════════════════════ */}
      {showGenerateModal && (
        <ModalOverlay onClose={() => !generating && setShowGenerateModal(false)} maxWidth={500}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_PRIMARY, margin: "0 0 20px" }}>
            Generate Article
          </h3>
          {generating ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: `2px solid ${CARD_BORDER}`,
                  borderTop: `2px solid ${ROSE_GOLD}`,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 16px",
                }}
              />
              <div style={{ color: TEXT_SECONDARY, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                Generating article with AI...
              </div>
              <div style={{ color: TEXT_TERTIARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif", marginTop: 8 }}>
                This may take a minute.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Topic (optional)</label>
                <textarea
                  value={genForm.topic}
                  onChange={(e) => setGenForm({ ...genForm, topic: e.target.value })}
                  placeholder="Leave empty to auto-select from news..."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Vertical</label>
                <select
                  value={genForm.vertical}
                  onChange={(e) => setGenForm({ ...genForm, vertical: e.target.value })}
                  style={selectStyle}
                >
                  <option value="">Select vertical...</option>
                  {VERTICAL_LIST.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Target Keyword (optional)</label>
                <input
                  type="text"
                  value={genForm.targetKeyword}
                  onChange={(e) => setGenForm({ ...genForm, targetKeyword: e.target.value })}
                  placeholder="e.g. stablecoin compliance"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowGenerateModal(false)} style={btnStyle()}>
                  Cancel
                </button>
                <button onClick={handleGenerate} style={btnStyle({ primary: true })}>
                  Generate
                </button>
              </div>
            </div>
          )}
        </ModalOverlay>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  WRITE MANUALLY MODAL                       */}
      {/* ═══════════════════════════════════════════ */}
      {showManualModal && (
        <ModalOverlay onClose={() => setShowManualModal(false)} maxWidth={600}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_PRIMARY, margin: "0 0 20px" }}>
            Write Article
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input
                type="text"
                value={manualForm.title}
                onChange={(e) =>
                  setManualForm({ ...manualForm, title: e.target.value, slug: slugify(e.target.value) })
                }
                placeholder="Article title"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Slug</label>
              <input
                type="text"
                value={manualForm.slug}
                onChange={(e) => setManualForm({ ...manualForm, slug: e.target.value })}
                style={{ ...inputStyle, color: TEXT_TERTIARY, fontSize: 12 }}
              />
            </div>
            <div>
              <label style={labelStyle}>Meta Description</label>
              <textarea
                value={manualForm.metaDescription}
                onChange={(e) => setManualForm({ ...manualForm, metaDescription: e.target.value })}
                placeholder="Brief description for search engines..."
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Content</label>
              <textarea
                value={manualForm.content}
                onChange={(e) => setManualForm({ ...manualForm, content: e.target.value })}
                placeholder="Write your article content here..."
                rows={10}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              />
            </div>
            <div>
              <label style={labelStyle}>Verticals</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {VERTICAL_LIST.map((v) => {
                  const isChecked = manualForm.verticals.includes(v)
                  return (
                    <label
                      key={v}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        fontSize: 11,
                        fontFamily: "'DM Sans', sans-serif",
                        color: isChecked ? TEXT_PRIMARY : TEXT_TERTIARY,
                      }}
                    >
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: `1.5px solid ${isChecked ? VERTICAL_COLORS[v] : CARD_BORDER}`,
                          background: isChecked ? VERTICAL_COLORS[v] : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 8,
                          color: "#1a1a1a",
                          fontWeight: 700,
                        }}
                        onClick={() => {
                          setManualForm((prev) => ({
                            ...prev,
                            verticals: isChecked
                              ? prev.verticals.filter((x) => x !== v)
                              : [...prev.verticals, v],
                          }))
                        }}
                      >
                        {isChecked && "\u2713"}
                      </div>
                      {v}
                    </label>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Primary Keyword</label>
              <input
                type="text"
                value={manualForm.primaryKeyword}
                onChange={(e) => setManualForm({ ...manualForm, primaryKeyword: e.target.value })}
                placeholder="e.g. crypto compliance"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button onClick={() => setShowManualModal(false)} style={btnStyle()}>
                Cancel
              </button>
              <button
                onClick={handleSaveManual}
                disabled={!manualForm.title.trim()}
                style={{
                  ...btnStyle({ primary: true }),
                  opacity: manualForm.title.trim() ? 1 : 0.4,
                  cursor: manualForm.title.trim() ? "pointer" : "not-allowed",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
