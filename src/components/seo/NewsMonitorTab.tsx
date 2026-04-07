"use client"

import { useState, useEffect, useMemo, useCallback } from "react"

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

/* ── Constants ── */
const SEO_VERTICALS = [
  { id: "stablecoin", label: "Stablecoin", color: ROSE_GOLD },
  { id: "defi", label: "DeFi", color: INDIGO },
  { id: "compliance", label: "Compliance", color: GREEN },
  { id: "payments", label: "Payments", color: CYAN },
  { id: "infrastructure", label: "Infrastructure", color: AMBER },
  { id: "general", label: "General", color: TEXT_SECONDARY },
]

const VERTICAL_COLORS: Record<string, string> = {}
for (const v of SEO_VERTICALS) VERTICAL_COLORS[v.id] = v.color

const NEWS_CATEGORIES = ["crypto", "fintech", "regulation", "defi", "payments", "general"]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "New", color: CYAN, bg: "rgba(34,211,238,0.12)" },
  queued: { label: "Queued", color: AMBER, bg: "rgba(251,191,36,0.12)" },
  used: { label: "Used", color: GREEN, bg: "rgba(52,211,153,0.12)" },
  irrelevant: { label: "Irrelevant", color: TEXT_TERTIARY, bg: "var(--surface-input)" },
}

/* ── Types ── */
interface NewsItem {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string
  relevanceScore: number | null
  verticals: string[]
  status: string
  category: string | null
}

interface NewsSource {
  id: string
  name: string
  url: string
  rssUrl: string | null
  category: string | null
  active: boolean
  lastScanned: string | null
}

/* ── Shared styles ── */
const cardStyle: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  padding: 20,
  backdropFilter: "blur(20px)",
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

/* ── Modal overlay ── */
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
          width: "100%",
          maxWidth: 520,
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}
      >
        {children}
      </div>
    </div>
  )
}

function RelevanceBadge({ score }: { score: number | null }) {
  if (score == null) return <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>--</span>
  let bg = "rgba(248,113,113,0.12)"
  let color = RED
  if (score >= 80) {
    bg = "rgba(52,211,153,0.12)"
    color = GREEN
  } else if (score >= 60) {
    bg = "rgba(251,191,36,0.12)"
    color = AMBER
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        background: bg,
        color,
      }}
    >
      {score}
    </span>
  )
}

export default function NewsMonitorTab() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [sources, setSources] = useState<NewsSource[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState("")
  const [relevanceFilter, setRelevanceFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showSources, setShowSources] = useState(false)

  /* Source modal state */
  const [showSourceModal, setShowSourceModal] = useState(false)
  const [editingSource, setEditingSource] = useState<NewsSource | null>(null)
  const [sourceForm, setSourceForm] = useState({ name: "", url: "", rssUrl: "", category: "" })
  const [sourceSaving, setSourceSaving] = useState(false)

  /* Toast */
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")

  /* Delete confirmation */
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [newsRes, sourcesRes] = await Promise.all([
        fetch("/api/seo/news"),
        fetch("/api/seo/news/sources"),
      ])
      if (newsRes.ok) {
        const json = await newsRes.json()
        setNewsItems(json.items ?? [])
      }
      if (sourcesRes.ok) {
        const json = await sourcesRes.json()
        setSources(json.sources ?? [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* Filtered news */
  const filteredNews = useMemo(() => {
    let list = [...newsItems]
    if (categoryFilter) list = list.filter((n) => n.category === categoryFilter)
    if (relevanceFilter === "high") list = list.filter((n) => (n.relevanceScore ?? 0) >= 80)
    else if (relevanceFilter === "medium") list = list.filter((n) => (n.relevanceScore ?? 0) >= 60 && (n.relevanceScore ?? 0) < 80)
    else if (relevanceFilter === "low") list = list.filter((n) => (n.relevanceScore ?? 0) < 60)
    if (statusFilter) list = list.filter((n) => n.status === statusFilter)
    return list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  }, [newsItems, categoryFilter, relevanceFilter, statusFilter])

  /* Scan now */
  const handleScan = async () => {
    setScanning(true)
    try {
      const res = await fetch("/api/seo/news/scan", { method: "POST" })
      if (res.ok) {
        const json = await res.json()
        setToastMessage(`Scan complete: ${json.newItems ?? 0} new items found`)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 4000)
        fetchData()
      }
    } catch {
      /* silent */
    } finally {
      setScanning(false)
    }
  }

  /* Mark irrelevant */
  const handleMarkIrrelevant = async (id: string) => {
    try {
      await fetch(`/api/seo/news/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "irrelevant" }),
      })
      setNewsItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "irrelevant" } : n))
      )
    } catch {
      /* silent */
    }
  }

  /* Generate article from news */
  const handleGenerateArticle = async (newsId: string) => {
    try {
      await fetch("/api/seo/articles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsIds: [newsId] }),
      })
      setToastMessage("Article generation started")
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } catch {
      /* silent */
    }
  }

  /* Source CRUD */
  const openAddSource = () => {
    setEditingSource(null)
    setSourceForm({ name: "", url: "", rssUrl: "", category: "" })
    setShowSourceModal(true)
  }

  const openEditSource = (source: NewsSource) => {
    setEditingSource(source)
    setSourceForm({
      name: source.name,
      url: source.url,
      rssUrl: source.rssUrl ?? "",
      category: source.category ?? "",
    })
    setShowSourceModal(true)
  }

  const handleSaveSource = async () => {
    if (!sourceForm.name.trim() || !sourceForm.url.trim()) return
    setSourceSaving(true)
    try {
      const endpoint = editingSource
        ? `/api/seo/news/sources/${editingSource.id}`
        : "/api/seo/news/sources"
      await fetch(endpoint, {
        method: editingSource ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sourceForm.name.trim(),
          url: sourceForm.url.trim(),
          rssUrl: sourceForm.rssUrl.trim() || null,
          category: sourceForm.category || null,
        }),
      })
      setShowSourceModal(false)
      fetchData()
    } catch {
      /* silent */
    } finally {
      setSourceSaving(false)
    }
  }

  const handleDeleteSource = async (id: string) => {
    try {
      await fetch(`/api/seo/news/sources/${id}`, { method: "DELETE" })
      setDeletingSourceId(null)
      fetchData()
    } catch {
      /* silent */
    }
  }

  const handleToggleSource = async (id: string, active: boolean) => {
    try {
      await fetch(`/api/seo/news/sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, active } : s)))
    } catch {
      /* silent */
    }
  }

  if (loading) {
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ ...cardStyle }}>
              <div style={{ ...skeletonPulse, height: 16, width: "30%", marginBottom: 10 }} />
              <div style={{ ...skeletonPulse, height: 20, width: "70%", marginBottom: 8 }} />
              <div style={{ ...skeletonPulse, height: 12, width: "50%" }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>

      {/* Toast */}
      {showToast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 2000,
            background: CARD_BG,
            border: `1px solid ${GREEN}40`,
            borderRadius: 10,
            padding: "12px 20px",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            fontSize: 12,
            color: GREEN,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            padding: "7px 16px",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            background: scanning ? "rgba(192,139,136,0.3)" : ROSE_GOLD,
            color: "#1a1a1a",
            border: "none",
            borderRadius: 8,
            cursor: scanning ? "default" : "pointer",
            opacity: scanning ? 0.7 : 1,
          }}
        >
          {scanning ? "Scanning..." : "Scan Now"}
        </button>
        <div style={{ flex: 1 }} />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ ...selectStyle, width: 130 }}
        >
          <option value="">All Categories</option>
          {NEWS_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <select
          value={relevanceFilter}
          onChange={(e) => setRelevanceFilter(e.target.value)}
          style={{ ...selectStyle, width: 130 }}
        >
          <option value="">All Relevance</option>
          <option value="high">High (80+)</option>
          <option value="medium">Medium (60-79)</option>
          <option value="low">Low (&lt;60)</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...selectStyle, width: 130 }}
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([id, s]) => (
            <option key={id} value={id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* News Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {filteredNews.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "40px 20px" }}>
            <div style={{ color: TEXT_TERTIARY, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              No news items found. Try scanning for new content.
            </div>
          </div>
        ) : (
          filteredNews.map((item) => {
            const statusConf = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.new
            return (
              <div key={item.id} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Source + date */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                        {item.source}
                      </span>
                      <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {new Date(item.publishedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Title */}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: TEXT_PRIMARY,
                        fontFamily: "'DM Sans', sans-serif",
                        textDecoration: "none",
                        display: "block",
                        marginBottom: 8,
                        lineHeight: 1.4,
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.color = ROSE_GOLD
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.color = TEXT_PRIMARY
                      }}
                    >
                      {item.title}
                    </a>

                    {/* Tags + badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <RelevanceBadge score={item.relevanceScore} />
                      {(item.verticals ?? []).map((v) => (
                        <span
                          key={v}
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 9,
                            fontWeight: 600,
                            fontFamily: "'DM Sans', sans-serif",
                            background: `${VERTICAL_COLORS[v] ?? TEXT_SECONDARY}18`,
                            color: VERTICAL_COLORS[v] ?? TEXT_SECONDARY,
                          }}
                        >
                          {v}
                        </span>
                      ))}
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 9,
                          fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
                          background: statusConf.bg,
                          color: statusConf.color,
                        }}
                      >
                        {statusConf.label}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleGenerateArticle(item.id)}
                      style={{
                        padding: "5px 12px",
                        fontSize: 10,
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 600,
                        background: ROSE_GOLD,
                        color: "#1a1a1a",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Generate Article
                    </button>
                    {item.status !== "irrelevant" && (
                      <button
                        onClick={() => handleMarkIrrelevant(item.id)}
                        style={{
                          padding: "5px 12px",
                          fontSize: 10,
                          fontFamily: "'DM Sans', sans-serif",
                          background: "transparent",
                          color: TEXT_TERTIARY,
                          border: `1px solid ${CARD_BORDER}`,
                          borderRadius: 6,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Mark Irrelevant
                      </button>
                    )}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "5px 12px",
                        fontSize: 10,
                        fontFamily: "'DM Sans', sans-serif",
                        background: "transparent",
                        color: CYAN,
                        border: `1px solid ${CARD_BORDER}`,
                        borderRadius: 6,
                        cursor: "pointer",
                        textAlign: "center",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      View Source
                    </a>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* News Sources Section */}
      <div style={cardStyle}>
        <div
          onClick={() => setShowSources(!showSources)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <div style={sectionTitle}>News Sources</div>
          <span style={{ color: TEXT_TERTIARY, fontSize: 12 }}>{showSources ? "\u25B2" : "\u25BC"}</span>
        </div>

        {showSources && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button
                onClick={openAddSource}
                style={{
                  padding: "6px 14px",
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  background: ROSE_GOLD,
                  color: "#1a1a1a",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                + Add Source
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Name", "URL", "RSS URL", "Category", "Active", "Last Scanned", ""].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 10px",
                          fontSize: 10,
                          fontWeight: 600,
                          color: TEXT_TERTIARY,
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          fontFamily: "'DM Sans', sans-serif",
                          textAlign: "left",
                          borderBottom: `1px solid ${CARD_BORDER}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sources.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "30px 0",
                          textAlign: "center",
                          color: TEXT_TERTIARY,
                          fontSize: 12,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        No sources configured yet.
                      </td>
                    </tr>
                  ) : (
                    sources.map((source) => (
                      <tr
                        key={source.id}
                        style={{ transition: "background 0.12s" }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLElement).style.background = "transparent"
                        }}
                      >
                        <td style={{ padding: "10px 10px", fontSize: 12, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                          {source.name}
                        </td>
                        <td
                          style={{
                            padding: "10px 10px",
                            fontSize: 11,
                            color: CYAN,
                            fontFamily: "'DM Sans', sans-serif",
                            borderBottom: `1px solid ${CARD_BORDER}`,
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {source.url}
                        </td>
                        <td
                          style={{
                            padding: "10px 10px",
                            fontSize: 11,
                            color: TEXT_TERTIARY,
                            fontFamily: "'DM Sans', sans-serif",
                            borderBottom: `1px solid ${CARD_BORDER}`,
                            maxWidth: 160,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {source.rssUrl || "--"}
                        </td>
                        <td style={{ padding: "10px 10px", fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                          {source.category || "--"}
                        </td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                          <div
                            onClick={() => handleToggleSource(source.id, !source.active)}
                            style={{
                              width: 36,
                              height: 20,
                              borderRadius: 10,
                              background: source.active ? GREEN : "rgba(255,255,255,0.1)",
                              cursor: "pointer",
                              position: "relative",
                              transition: "background 0.2s",
                            }}
                          >
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                background: "#fff",
                                position: "absolute",
                                top: 2,
                                left: source.active ? 18 : 2,
                                transition: "left 0.2s",
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ padding: "10px 10px", fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                          {source.lastScanned ? new Date(source.lastScanned).toLocaleDateString() : "--"}
                        </td>
                        <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => openEditSource(source)}
                              style={{
                                padding: "4px 10px",
                                fontSize: 10,
                                fontFamily: "'DM Sans', sans-serif",
                                background: "transparent",
                                border: `1px solid ${CARD_BORDER}`,
                                borderRadius: 4,
                                color: TEXT_SECONDARY,
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            {deletingSourceId === source.id ? (
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  onClick={() => handleDeleteSource(source.id)}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 10,
                                    fontFamily: "'DM Sans', sans-serif",
                                    background: RED,
                                    border: "none",
                                    borderRadius: 4,
                                    color: "#fff",
                                    cursor: "pointer",
                                  }}
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeletingSourceId(null)}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 10,
                                    fontFamily: "'DM Sans', sans-serif",
                                    background: "transparent",
                                    border: `1px solid ${CARD_BORDER}`,
                                    borderRadius: 4,
                                    color: TEXT_TERTIARY,
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingSourceId(source.id)}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 10,
                                  fontFamily: "'DM Sans', sans-serif",
                                  background: "transparent",
                                  border: `1px solid rgba(248,113,113,0.2)`,
                                  borderRadius: 4,
                                  color: RED,
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Source Modal */}
      {showSourceModal && (
        <ModalOverlay onClose={() => setShowSourceModal(false)}>
          <h3
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 20,
              color: TEXT_PRIMARY,
              margin: "0 0 20px",
            }}
          >
            {editingSource ? "Edit Source" : "Add Source"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input
                type="text"
                value={sourceForm.name}
                onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                placeholder="e.g. CoinDesk"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>URL *</label>
              <input
                type="text"
                value={sourceForm.url}
                onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                placeholder="https://www.coindesk.com"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>RSS URL</label>
              <input
                type="text"
                value={sourceForm.rssUrl}
                onChange={(e) => setSourceForm({ ...sourceForm, rssUrl: e.target.value })}
                placeholder="https://www.coindesk.com/arc/outboundfeeds/rss/"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select
                value={sourceForm.category}
                onChange={(e) => setSourceForm({ ...sourceForm, category: e.target.value })}
                style={selectStyle}
              >
                <option value="">None</option>
                {NEWS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setShowSourceModal(false)}
                style={{
                  padding: "8px 18px",
                  fontSize: 12,
                  fontFamily: "'DM Sans', sans-serif",
                  background: "transparent",
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 8,
                  color: TEXT_SECONDARY,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSource}
                disabled={sourceSaving || !sourceForm.name.trim() || !sourceForm.url.trim()}
                style={{
                  padding: "8px 18px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  background: ROSE_GOLD,
                  color: "#1a1a1a",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  opacity: sourceSaving || !sourceForm.name.trim() || !sourceForm.url.trim() ? 0.5 : 1,
                }}
              >
                {sourceSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
