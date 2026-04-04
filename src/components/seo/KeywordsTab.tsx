"use client"

import { useState, useEffect, useMemo, useCallback } from "react"

/* ── Design tokens ── */
const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
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

/* ── Types ── */
interface Keyword {
  id: string
  keyword: string
  vertical: string
  position: number | null
  previousPosition: number | null
  targetPosition: number
  searchVolume: number | null
  difficulty: number | null
  url: string | null
  lastChecked: string | null
}

interface DiscoveredKeyword {
  keyword: string
  estimatedVolume: number | null
  difficulty: number | null
  vertical: string
  reason: string
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

const skeletonPulse: React.CSSProperties = {
  background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
  borderRadius: 6,
}

type SortField = "keyword" | "vertical" | "position" | "previousPosition" | "targetPosition" | "searchVolume" | "difficulty" | "lastChecked"
type SortDir = "asc" | "desc"

function fmtNum(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`
  return val.toLocaleString()
}

function PositionBadge({ position }: { position: number | null }) {
  if (position == null) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: 4,
          fontSize: 11,
          fontFamily: "'DM Sans', sans-serif",
          background: "rgba(255,255,255,0.04)",
          color: TEXT_TERTIARY,
        }}
      >
        --
      </span>
    )
  }
  let bg = "rgba(248,113,113,0.12)"
  let color = RED
  if (position <= 10) {
    bg = "rgba(52,211,153,0.12)"
    color = GREEN
  } else if (position <= 20) {
    bg = "rgba(251,191,36,0.12)"
    color = AMBER
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        background: bg,
        color,
      }}
    >
      {position}
    </span>
  )
}

function DeltaArrow({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) {
    return <span style={{ color: TEXT_TERTIARY, fontSize: 11 }}>&mdash;</span>
  }
  const delta = previous - current
  if (delta > 0) {
    return (
      <span style={{ color: GREEN, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
        {"\u25B2"} {delta}
      </span>
    )
  }
  if (delta < 0) {
    return (
      <span style={{ color: RED, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
        {"\u25BC"} {Math.abs(delta)}
      </span>
    )
  }
  return <span style={{ color: TEXT_TERTIARY, fontSize: 11 }}>&mdash;</span>
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

export default function KeywordsTab() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [verticalFilter, setVerticalFilter] = useState("")
  const [sortField, setSortField] = useState<SortField>("keyword")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  /* Add keyword modal */
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    keyword: "",
    vertical: "general",
    searchVolume: "",
    difficulty: "",
    targetPosition: "10",
  })
  const [addSaving, setAddSaving] = useState(false)

  /* Discover modal */
  const [showDiscoverModal, setShowDiscoverModal] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discoveredKeywords, setDiscoveredKeywords] = useState<DiscoveredKeyword[]>([])
  const [selectedDiscovered, setSelectedDiscovered] = useState<Set<number>>(new Set())
  const [importingDiscovered, setImportingDiscovered] = useState(false)

  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch("/api/seo/keywords")
      if (res.ok) {
        const json = await res.json()
        setKeywords(json.keywords ?? [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeywords()
  }, [fetchKeywords])

  /* Sort handler */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  /* Filtered + sorted keywords */
  const filteredKeywords = useMemo(() => {
    let list = [...keywords]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (k) => k.keyword.toLowerCase().includes(q) || k.url?.toLowerCase().includes(q)
      )
    }
    if (verticalFilter) {
      list = list.filter((k) => k.vertical === verticalFilter)
    }
    list.sort((a, b) => {
      let valA: string | number | null = null
      let valB: string | number | null = null
      switch (sortField) {
        case "keyword":
          valA = a.keyword.toLowerCase()
          valB = b.keyword.toLowerCase()
          break
        case "vertical":
          valA = a.vertical
          valB = b.vertical
          break
        case "position":
          valA = a.position ?? 999
          valB = b.position ?? 999
          break
        case "previousPosition":
          valA = a.previousPosition ?? 999
          valB = b.previousPosition ?? 999
          break
        case "targetPosition":
          valA = a.targetPosition
          valB = b.targetPosition
          break
        case "searchVolume":
          valA = a.searchVolume ?? 0
          valB = b.searchVolume ?? 0
          break
        case "difficulty":
          valA = a.difficulty ?? 0
          valB = b.difficulty ?? 0
          break
        case "lastChecked":
          valA = a.lastChecked ?? ""
          valB = b.lastChecked ?? ""
          break
      }
      if (valA == null || valB == null) return 0
      if (valA < valB) return sortDir === "asc" ? -1 : 1
      if (valA > valB) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return list
  }, [keywords, searchQuery, verticalFilter, sortField, sortDir])

  /* Add keyword */
  const handleAddKeyword = async () => {
    if (!addForm.keyword.trim()) return
    setAddSaving(true)
    try {
      await fetch("/api/seo/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: addForm.keyword.trim(),
          vertical: addForm.vertical,
          searchVolume: addForm.searchVolume ? parseInt(addForm.searchVolume) : null,
          difficulty: addForm.difficulty ? parseInt(addForm.difficulty) : null,
          targetPosition: parseInt(addForm.targetPosition) || 10,
        }),
      })
      setShowAddModal(false)
      setAddForm({ keyword: "", vertical: "general", searchVolume: "", difficulty: "", targetPosition: "10" })
      fetchKeywords()
    } catch {
      /* silent */
    } finally {
      setAddSaving(false)
    }
  }

  /* Discover keywords */
  const handleDiscover = async () => {
    setShowDiscoverModal(true)
    setDiscovering(true)
    setDiscoveredKeywords([])
    setSelectedDiscovered(new Set())
    try {
      const res = await fetch("/api/seo/keywords/discover", { method: "POST" })
      if (res.ok) {
        const json = await res.json()
        setDiscoveredKeywords(json.keywords ?? [])
      }
    } catch {
      /* silent */
    } finally {
      setDiscovering(false)
    }
  }

  const toggleDiscoveredSelection = (idx: number) => {
    setSelectedDiscovered((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleImportSelected = async () => {
    const selected = Array.from(selectedDiscovered).map((i) => discoveredKeywords[i])
    if (selected.length === 0) return
    setImportingDiscovered(true)
    try {
      await fetch("/api/seo/keywords/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: selected }),
      })
      setShowDiscoverModal(false)
      fetchKeywords()
    } catch {
      /* silent */
    } finally {
      setImportingDiscovered(false)
    }
  }

  /* Column header */
  const SortHeader = ({ field, label, width }: { field: SortField; label: string; width?: number | string }) => (
    <th
      onClick={() => handleSort(field)}
      style={{
        padding: "10px 10px",
        fontSize: 10,
        fontWeight: 600,
        color: sortField === field ? TEXT_PRIMARY : TEXT_TERTIARY,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        fontFamily: "'DM Sans', sans-serif",
        cursor: "pointer",
        userSelect: "none",
        textAlign: "left",
        width: width ?? "auto",
        whiteSpace: "nowrap",
        borderBottom: `1px solid ${CARD_BORDER}`,
      }}
    >
      {label}
      {sortField === field && (
        <span style={{ marginLeft: 4, fontSize: 8 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
      )}
    </th>
  )

  if (loading) {
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
        <div style={{ ...cardStyle }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ ...skeletonPulse, height: 36, marginBottom: 6 }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "7px 16px",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            background: ROSE_GOLD,
            color: "#1a1a1a",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          + Add Keyword
        </button>
        <button
          onClick={handleDiscover}
          style={{
            padding: "7px 16px",
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            background: "transparent",
            color: TEXT_SECONDARY,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Discover Keywords
        </button>
        <div style={{ flex: 1 }} />
        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value)}
          style={{ ...selectStyle, width: 150 }}
        >
          <option value="">All Verticals</option>
          {SEO_VERTICALS.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, width: 200 }}
        />
      </div>

      {/* Keyword Table */}
      <div style={cardStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <SortHeader field="keyword" label="Keyword" width="20%" />
                <SortHeader field="vertical" label="Vertical" width={90} />
                <SortHeader field="position" label="Position" width={80} />
                <th style={{ padding: "10px 10px", fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'DM Sans', sans-serif", textAlign: "left", width: 60, borderBottom: `1px solid ${CARD_BORDER}` }}>
                  Delta
                </th>
                <SortHeader field="previousPosition" label="Previous" width={70} />
                <SortHeader field="targetPosition" label="Target" width={60} />
                <SortHeader field="searchVolume" label="Volume" width={70} />
                <SortHeader field="difficulty" label="Difficulty" width={70} />
                <th style={{ padding: "10px 10px", fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'DM Sans', sans-serif", textAlign: "left", borderBottom: `1px solid ${CARD_BORDER}` }}>
                  URL
                </th>
                <SortHeader field="lastChecked" label="Last Checked" width={100} />
              </tr>
            </thead>
            <tbody>
              {filteredKeywords.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: "40px 0",
                      textAlign: "center",
                      color: TEXT_TERTIARY,
                      fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {keywords.length === 0 ? "No keywords tracked yet. Add your first keyword." : "No keywords match your filters."}
                  </td>
                </tr>
              ) : (
                filteredKeywords.map((kw) => (
                  <tr
                    key={kw.id}
                    onClick={() => setExpandedId(expandedId === kw.id ? null : kw.id)}
                    style={{ cursor: "pointer", transition: "background 0.12s" }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = "transparent"
                    }}
                  >
                    <td style={{ padding: "10px 10px", fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {kw.keyword}
                    </td>
                    <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 9,
                          fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
                          background: `${VERTICAL_COLORS[kw.vertical] ?? TEXT_SECONDARY}18`,
                          color: VERTICAL_COLORS[kw.vertical] ?? TEXT_SECONDARY,
                        }}
                      >
                        {kw.vertical}
                      </span>
                    </td>
                    <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      <PositionBadge position={kw.position} />
                    </td>
                    <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      <DeltaArrow current={kw.position} previous={kw.previousPosition} />
                    </td>
                    <td style={{ padding: "10px 10px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {kw.previousPosition ?? "--"}
                    </td>
                    <td style={{ padding: "10px 10px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {kw.targetPosition}
                    </td>
                    <td style={{ padding: "10px 10px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {kw.searchVolume != null ? fmtNum(kw.searchVolume) : "--"}
                    </td>
                    <td style={{ padding: "10px 10px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {kw.difficulty != null ? kw.difficulty : "--"}
                    </td>
                    <td
                      style={{
                        padding: "10px 10px",
                        fontSize: 11,
                        color: TEXT_TERTIARY,
                        fontFamily: "'DM Sans', sans-serif",
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        borderBottom: `1px solid ${CARD_BORDER}`,
                      }}
                    >
                      {kw.url || "--"}
                    </td>
                    <td style={{ padding: "10px 10px", fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {kw.lastChecked ? new Date(kw.lastChecked).toLocaleDateString() : "--"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
          {filteredKeywords.length} keyword{filteredKeywords.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Add Keyword Modal */}
      {showAddModal && (
        <ModalOverlay onClose={() => setShowAddModal(false)}>
          <h3
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 20,
              color: TEXT_PRIMARY,
              margin: "0 0 20px",
            }}
          >
            Add Keyword
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Keyword *</label>
              <input
                type="text"
                value={addForm.keyword}
                onChange={(e) => setAddForm({ ...addForm, keyword: e.target.value })}
                placeholder="e.g. stablecoin regulation europe"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Vertical</label>
              <select
                value={addForm.vertical}
                onChange={(e) => setAddForm({ ...addForm, vertical: e.target.value })}
                style={selectStyle}
              >
                {SEO_VERTICALS.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Search Volume</label>
                <input
                  type="number"
                  value={addForm.searchVolume}
                  onChange={(e) => setAddForm({ ...addForm, searchVolume: e.target.value })}
                  placeholder="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Difficulty</label>
                <input
                  type="number"
                  value={addForm.difficulty}
                  onChange={(e) => setAddForm({ ...addForm, difficulty: e.target.value })}
                  placeholder="0-100"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Target Position</label>
                <input
                  type="number"
                  value={addForm.targetPosition}
                  onChange={(e) => setAddForm({ ...addForm, targetPosition: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setShowAddModal(false)}
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
                onClick={handleAddKeyword}
                disabled={addSaving || !addForm.keyword.trim()}
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
                  opacity: addSaving || !addForm.keyword.trim() ? 0.5 : 1,
                }}
              >
                {addSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Discover Keywords Modal */}
      {showDiscoverModal && (
        <ModalOverlay onClose={() => !discovering && setShowDiscoverModal(false)}>
          <h3
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 20,
              color: TEXT_PRIMARY,
              margin: "0 0 20px",
            }}
          >
            Discover Keywords
          </h3>
          {discovering ? (
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
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ color: TEXT_SECONDARY, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                Analyzing your content and competitors...
              </div>
            </div>
          ) : discoveredKeywords.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
              No keyword suggestions found at this time.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
                {discoveredKeywords.map((dk, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleDiscoveredSelection(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: selectedDiscovered.has(idx) ? "rgba(192,139,136,0.08)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${selectedDiscovered.has(idx) ? "rgba(192,139,136,0.2)" : CARD_BORDER}`,
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${selectedDiscovered.has(idx) ? ROSE_GOLD : CARD_BORDER}`,
                        background: selectedDiscovered.has(idx) ? ROSE_GOLD : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: "#1a1a1a",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {selectedDiscovered.has(idx) && "\u2713"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                        {dk.keyword}
                      </div>
                      <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
                        {dk.reason}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                      <span>Vol: {dk.estimatedVolume != null ? fmtNum(dk.estimatedVolume) : "--"}</span>
                      <span>Diff: {dk.difficulty ?? "--"}</span>
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 9,
                        fontWeight: 600,
                        fontFamily: "'DM Sans', sans-serif",
                        background: `${VERTICAL_COLORS[dk.vertical] ?? TEXT_SECONDARY}18`,
                        color: VERTICAL_COLORS[dk.vertical] ?? TEXT_SECONDARY,
                        flexShrink: 0,
                      }}
                    >
                      {dk.vertical}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
                <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                  {selectedDiscovered.size} selected
                </span>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setShowDiscoverModal(false)}
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
                    onClick={handleImportSelected}
                    disabled={selectedDiscovered.size === 0 || importingDiscovered}
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
                      opacity: selectedDiscovered.size === 0 || importingDiscovered ? 0.5 : 1,
                    }}
                  >
                    {importingDiscovered ? "Importing..." : `Add Selected (${selectedDiscovered.size})`}
                  </button>
                </div>
              </div>
            </>
          )}
        </ModalOverlay>
      )}
    </div>
  )
}
