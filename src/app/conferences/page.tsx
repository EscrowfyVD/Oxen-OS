"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import PageHeader from "@/components/layout/PageHeader"

/* ── Design tokens ── */
const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "rgba(240,240,242,0.92)"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.35)"
const ROSE = "#C08B88"
const ROSE_HOVER = "#D4A5A2"
const ROSE_DIM = "rgba(192,139,136,0.15)"

/* ── Conference color palette ── */
const CONF_COLORS = [
  { solid: "#C08B88", dim: "rgba(192,139,136,0.25)", bg: "rgba(192,139,136,0.15)" },   // Rose gold
  { solid: "#818CF8", dim: "rgba(129,140,248,0.25)", bg: "rgba(129,140,248,0.15)" },   // Indigo
  { solid: "#5CB868", dim: "rgba(92,184,104,0.25)", bg: "rgba(92,184,104,0.15)" },     // Green
  { solid: "#E5C453", dim: "rgba(229,196,83,0.25)", bg: "rgba(229,196,83,0.15)" },     // Amber
  { solid: "#5BB8A8", dim: "rgba(91,184,168,0.25)", bg: "rgba(91,184,168,0.15)" },     // Teal
  { solid: "#9B7FD4", dim: "rgba(155,127,212,0.25)", bg: "rgba(155,127,212,0.15)" },   // Purple
  { solid: "#5B9BBF", dim: "rgba(91,155,191,0.25)", bg: "rgba(91,155,191,0.15)" },     // Blue
  { solid: "#D4885B", dim: "rgba(212,136,91,0.25)", bg: "rgba(212,136,91,0.15)" },     // Orange
]

function getConfColor(conf: Conference, index: number) {
  if (conf.color) {
    const match = CONF_COLORS.find((c) => c.solid === conf.color)
    if (match) return match
  }
  return CONF_COLORS[index % CONF_COLORS.length]
}

type TabKey = "calendar" | "intel" | "reports"
type CalView = "day" | "week" | "month" | "year"

interface TeamMember {
  id: string
  name: string
  email: string
  role?: string
  image?: string | null
}

interface Conference {
  id: string
  name: string
  location?: string
  country?: string
  startDate: string
  endDate: string
  website?: string
  description?: string
  status?: string
  source?: string
  reportStatus?: string
  currency?: string
  color?: string
  attendees?: { employeeId: string; employee?: { id: string; name: string }; name?: string; role: string; ticketCost?: number; hotelCost?: number; flightCost?: number; taxiCost?: number; mealsCost?: number; otherCost?: number }[]
  report?: { id: string } | null
  _count?: { collectedContacts: number }
}

interface IntelResult {
  id: string
  title: string
  description?: string
  summary?: string
  url?: string
  source?: string
  category?: string
  createdAt?: string
}

/* ── Helpers ── */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const ATTENDEE_ROLES = ["Speaker", "Attendee", "Booth", "Networking"]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const sStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const eStr = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return `${sStr} – ${eStr}`
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function confTotalBudget(c: Conference) {
  return (c.attendees || []).reduce((sum, a) =>
    sum + (a.ticketCost || 0) + (a.hotelCost || 0) + (a.flightCost || 0) + (a.taxiCost || 0) + (a.mealsCost || 0) + (a.otherCost || 0), 0)
}

function attName(att: Conference["attendees"] extends (infer T)[] | undefined ? T : never) {
  return att?.employee?.name || att?.name || "Unknown"
}

/* ── Styles ── */
const cardStyle: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  overflow: "hidden",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 14px",
  background: "#0A0C10",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8,
  color: TEXT_PRIMARY,
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: TEXT_SECONDARY,
  marginBottom: 6,
  display: "block",
  fontFamily: "'DM Sans', sans-serif",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 20px",
  background: ROSE,
  border: "none",
  borderRadius: 10,
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
  transition: "background 0.15s",
}

const btnSecondary: React.CSSProperties = {
  padding: "8px 16px",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8,
  color: TEXT_PRIMARY,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
  transition: "all 0.15s",
}

const viewBtn = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 6,
  border: `1px solid ${active ? ROSE : CARD_BORDER}`,
  background: active ? ROSE_DIM : "transparent",
  color: active ? ROSE_HOVER : TEXT_TERTIARY,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
  transition: "all 0.15s",
})

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function ConferencesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>("calendar")
  const [showAddModal, setShowAddModal] = useState(false)
  const [calView, setCalView] = useState<CalView>("month")

  // Data
  const [conferences, setConferences] = useState<Conference[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [intelResults, setIntelResults] = useState<IntelResult[]>([])
  const [loading, setLoading] = useState(true)

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calDay, setCalDay] = useState(new Date().getDate())
  const [filterMembers, setFilterMembers] = useState<Set<string>>(new Set())

  // Intel state
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())
  const [showRejected, setShowRejected] = useState(false)
  const [acceptModalItem, setAcceptModalItem] = useState<IntelResult | null>(null)
  const [expandedIntel, setExpandedIntel] = useState<Set<string>>(new Set())

  // Accept modal form
  const [acceptAttendees, setAcceptAttendees] = useState<{ id: string; role: string }[]>([])
  const [acceptDates, setAcceptDates] = useState({ start: "", end: "" })
  const [acceptLocation, setAcceptLocation] = useState("")

  /* ── Fetch data ── */
  const fetchConferences = useCallback(() => {
    setLoading(true)
    fetch("/api/conferences")
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`)
        return r.json()
      })
      .then((data) => {
        const list = data.conferences ?? data ?? []
        setConferences(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fetchTeam = useCallback(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => {
        const emps = data.employees ?? data.members ?? data ?? []
        const members: TeamMember[] = emps.map((e: Record<string, string>) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          role: e.role ?? e.jobTitle ?? "",
          image: e.image ?? e.avatarUrl ?? null,
        }))
        setTeamMembers(members)
        setFilterMembers(new Set(members.map((m: TeamMember) => m.id)))
      })
      .catch(() => {})
  }, [])

  const fetchIntel = useCallback(() => {
    fetch("/api/intel/results")
      .then((r) => r.json())
      .then((data) => {
        const results: IntelResult[] = data.results ?? data ?? []
        setIntelResults(results.filter((r) => r.category === "conferences"))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchConferences()
    fetchTeam()
  }, [fetchConferences, fetchTeam])

  useEffect(() => {
    if (activeTab === "intel") fetchIntel()
  }, [activeTab, fetchIntel])

  /* ── Calendar navigation ── */
  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1) }
    else setCalMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1) }
    else setCalMonth((m) => m + 1)
  }
  const goToday = () => {
    const now = new Date()
    setCalYear(now.getFullYear())
    setCalMonth(now.getMonth())
    setCalDay(now.getDate())
  }

  const navPrev = () => {
    if (calView === "year") setCalYear((y) => y - 1)
    else if (calView === "month") prevMonth()
    else if (calView === "week") {
      const d = new Date(calYear, calMonth, calDay - 7)
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
      setCalDay(d.getDate())
    } else {
      const d = new Date(calYear, calMonth, calDay - 1)
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
      setCalDay(d.getDate())
    }
  }
  const navNext = () => {
    if (calView === "year") setCalYear((y) => y + 1)
    else if (calView === "month") nextMonth()
    else if (calView === "week") {
      const d = new Date(calYear, calMonth, calDay + 7)
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
      setCalDay(d.getDate())
    } else {
      const d = new Date(calYear, calMonth, calDay + 1)
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
      setCalDay(d.getDate())
    }
  }

  const headerLabel = calView === "year"
    ? String(calYear)
    : calView === "month"
      ? `${MONTH_NAMES[calMonth]} ${calYear}`
      : calView === "week"
        ? (() => {
            const ws = getWeekStart(new Date(calYear, calMonth, calDay))
            const we = new Date(ws); we.setDate(we.getDate() + 6)
            return `${MONTH_SHORT[ws.getMonth()]} ${ws.getDate()} – ${MONTH_SHORT[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`
          })()
        : new Date(calYear, calMonth, calDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })

  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfWeek(calYear, calMonth)

  // Filter conferences for visibility
  const monthStart = new Date(calYear, calMonth, 1)
  const monthEnd = new Date(calYear, calMonth, daysInMonth, 23, 59, 59)

  const filterConf = (c: Conference, start: Date, end: Date) => {
    const cs = new Date(c.startDate)
    const ce = new Date(c.endDate)
    if (cs > end || ce < start) return false
    if (filterMembers.size < teamMembers.length && c.attendees) {
      const hasMatch = c.attendees.some((a) => filterMembers.has(a.employeeId))
      if (!hasMatch) return false
    }
    return true
  }

  const visibleConferences = conferences.filter((c) => filterConf(c, monthStart, monthEnd))

  const getConfsForDay = (day: number, month?: number, year?: number) => {
    const m = month ?? calMonth
    const y = year ?? calYear
    const date = new Date(y, m, day)
    return conferences.filter((c) => {
      const cs = new Date(c.startDate); cs.setHours(0, 0, 0, 0)
      const ce = new Date(c.endDate); ce.setHours(23, 59, 59, 999)
      if (date < cs || date > ce) return false
      if (filterMembers.size < teamMembers.length && c.attendees) {
        return c.attendees.some((a) => filterMembers.has(a.employeeId))
      }
      return true
    })
  }

  const isConfStart = (conf: Conference, day: number) => {
    const cs = new Date(conf.startDate)
    const date = new Date(calYear, calMonth, day)
    return isSameDay(cs, date) || (day === 1 && cs < monthStart)
  }

  /* ── Toggle filter ── */
  const toggleMember = (id: string) => {
    setFilterMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* ── Intel accept flow ── */
  const openAcceptModal = (item: IntelResult) => {
    setAcceptModalItem(item)
    setAcceptAttendees([])
    setAcceptDates({ start: "", end: "" })
    setAcceptLocation("")
  }

  const submitAccept = async () => {
    if (!acceptModalItem) return
    try {
      await fetch("/api/conferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: acceptModalItem.title,
          location: acceptLocation,
          startDate: acceptDates.start,
          endDate: acceptDates.end,
          description: acceptModalItem.description || acceptModalItem.summary,
          website: acceptModalItem.url,
          source: "intel",
          attendees: acceptAttendees.map((a) => ({ id: a.id, role: a.role })),
        }),
      })
      setAcceptedIds((prev) => new Set(prev).add(acceptModalItem.id))
      setAcceptModalItem(null)
      fetchConferences()
    } catch { /* silent */ }
  }

  /* ── Reports helpers ── */
  const getReportStatus = (conf: Conference) => {
    if (conf.report) return { label: "Report submitted", color: "#22C55E", bg: "rgba(34,197,94,0.1)" }
    const endPlusSeven = new Date(conf.endDate)
    endPlusSeven.setDate(endPlusSeven.getDate() + 7)
    if (new Date() > endPlusSeven) return { label: "Overdue", color: "#EF4444", bg: "rgba(239,68,68,0.1)" }
    return { label: "Awaiting report", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" }
  }

  const pastConferences = conferences.filter((c) => new Date(c.endDate) < new Date())

  /* ── Delete conference ── */
  const deleteConference = async (confId: string, confName: string) => {
    if (!confirm(`Delete "${confName}" and all associated data? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/conferences/${confId}`, { method: "DELETE" })
      if (res.ok) fetchConferences()
    } catch { /* silent */ }
  }

  // Build color index map: order conferences by creation and assign rotating colors
  const confColorMap = new Map<string, typeof CONF_COLORS[0]>()
  conferences.forEach((c, i) => { confColorMap.set(c.id, getConfColor(c, i)) })

  // Sort conferences: upcoming first, past dimmed
  const sortedConferences = [...conferences].sort((a, b) => {
    const now = new Date()
    const aFuture = new Date(a.startDate) >= now
    const bFuture = new Date(b.startDate) >= now
    if (aFuture && !bFuture) return -1
    if (!aFuture && bFuture) return 1
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  })

  /* ── Tab bar ── */
  const tabs: { key: TabKey; label: string }[] = [
    { key: "calendar", label: "Calendar" },
    { key: "intel", label: "Veille / Intel" },
    { key: "reports", label: "Reports" },
  ]

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="page-content">
      <PageHeader
        title="Conferences"
        description="Track, plan and report on team conferences"
        actions={
          <button
            style={btnPrimary}
            onClick={() => setShowAddModal(true)}
            onMouseEnter={(e) => (e.currentTarget.style.background = ROSE_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.background = ROSE)}
          >
            + Add Conference
          </button>
        }
      />

      {/* Tab bar */}
      <div
        className="flex items-center gap-1"
        style={{
          padding: "0 32px",
          borderBottom: `1px solid ${CARD_BORDER}`,
          background: "rgba(6,7,9,0.5)",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key ? `2px solid ${ROSE}` : "2px solid transparent",
              color: activeTab === tab.key ? TEXT_PRIMARY : TEXT_TERTIARY,
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* ═══════ TAB 1: CALENDAR ═══════ */}
        {activeTab === "calendar" && (
          <div style={{ display: "flex", gap: 24 }}>
            {/* Left panel — conference list */}
            <div style={{ width: 280, flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>
                All Conferences ({conferences.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedConferences.length === 0 && !loading && (
                  <div style={{ padding: 20, textAlign: "center", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                    No conferences yet
                  </div>
                )}
                {sortedConferences.map((c) => {
                  const isPast = new Date(c.endDate) < new Date()
                  const budget = confTotalBudget(c)
                  const clr = confColorMap.get(c.id) || CONF_COLORS[0]
                  return (
                    <div
                      key={c.id}
                      onClick={() => router.push(`/conferences/${c.id}`)}
                      style={{
                        ...cardStyle,
                        padding: "14px 16px",
                        cursor: "pointer",
                        opacity: isPast ? 0.5 : 1,
                        transition: "all 0.15s",
                        borderLeft: `3px solid ${isPast ? TEXT_TERTIARY : clr.solid}`,
                        position: "relative",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.opacity = "1"; const del = e.currentTarget.querySelector("[data-del]") as HTMLElement; if (del) del.style.opacity = "1" }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = CARD_BG; e.currentTarget.style.opacity = isPast ? "0.5" : "1"; const del = e.currentTarget.querySelector("[data-del]") as HTMLElement; if (del) del.style.opacity = "0" }}
                    >
                      <button
                        data-del=""
                        onClick={(e) => { e.stopPropagation(); deleteConference(c.id, c.name) }}
                        style={{
                          position: "absolute", top: 8, right: 8, opacity: 0,
                          background: "rgba(239,68,68,0.12)", border: "none", borderRadius: 4,
                          padding: "3px 6px", cursor: "pointer", color: "#EF4444", fontSize: 10,
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 600, transition: "opacity 0.15s",
                        }}
                        title="Delete conference"
                      >
                        ✕
                      </button>
                      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 20 }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>
                        {c.location && `${c.location} · `}{formatDateRange(c.startDate, c.endDate)}
                      </div>
                      <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                          {c.attendees?.length || 0} attendee{(c.attendees?.length || 0) !== 1 ? "s" : ""}
                        </span>
                        {budget > 0 && (
                          <span style={{ fontSize: 10, color: clr.solid, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                            €{budget.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right — calendar area */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Filter pills */}
              {teamMembers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginRight: 4 }}>
                    Filter:
                  </span>
                  {teamMembers.map((m) => {
                    const active = filterMembers.has(m.id)
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 20,
                          border: `1px solid ${active ? ROSE : CARD_BORDER}`,
                          background: active ? ROSE_DIM : "transparent",
                          color: active ? ROSE_HOVER : TEXT_TERTIARY,
                          fontSize: 12,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* View toggle + navigation */}
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div className="flex items-center gap-3">
                  <button onClick={navPrev} style={btnSecondary}>&#8592;</button>
                  <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", minWidth: 220, textAlign: "center" }}>
                    {headerLabel}
                  </span>
                  <button onClick={navNext} style={btnSecondary}>&#8594;</button>
                </div>
                <div className="flex items-center gap-2">
                  {(["day", "week", "month", "year"] as CalView[]).map((v) => (
                    <button key={v} onClick={() => setCalView(v)} style={viewBtn(calView === v)}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                  <button onClick={goToday} style={{ ...btnSecondary, marginLeft: 8 }}>Today</button>
                </div>
              </div>

              {/* ─── MONTH VIEW ─── */}
              {calView === "month" && (
                <div style={cardStyle}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${CARD_BORDER}` }}>
                    {DAYS.map((d) => (
                      <div key={d} style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {d}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`e-${i}`} style={{ minHeight: 100, borderRight: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.01)" }} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const confs = getConfsForDay(day)
                      const isToday = isSameDay(new Date(calYear, calMonth, day), new Date())
                      return (
                        <div
                          key={day}
                          style={{
                            minHeight: 100,
                            padding: "6px 6px 4px",
                            borderRight: `1px solid ${CARD_BORDER}`,
                            borderBottom: `1px solid ${CARD_BORDER}`,
                            background: isToday ? "rgba(192,139,136,0.04)" : "transparent",
                            position: "relative",
                          }}
                          onClick={() => { setCalDay(day); setCalView("day") }}
                        >
                          <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? ROSE : TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 4, cursor: "pointer" }}>
                            {day}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {confs.map((conf) => {
                              const clr = confColorMap.get(conf.id) || CONF_COLORS[0]
                              const show = isConfStart(conf, day)
                              const cs = new Date(conf.startDate); cs.setHours(0, 0, 0, 0)
                              const ce = new Date(conf.endDate); ce.setHours(23, 59, 59, 999)
                              const thisDate = new Date(calYear, calMonth, day)
                              const isStart = isSameDay(cs, thisDate) || (day === 1 && cs < monthStart)
                              const isEnd = isSameDay(ce, thisDate) || (day === daysInMonth && ce > monthEnd)
                              const dayOfWeek = (firstDay + day - 1) % 7
                              const isWeekStart = dayOfWeek === 0

                              return (
                                <div
                                  key={conf.id}
                                  onClick={(e) => { e.stopPropagation(); router.push(`/conferences/${conf.id}`) }}
                                  style={{
                                    background: clr.bg,
                                    borderLeft: (isStart || isWeekStart) ? `3px solid ${clr.solid}` : "none",
                                    borderTopLeftRadius: (isStart || isWeekStart) ? 4 : 0,
                                    borderBottomLeftRadius: (isStart || isWeekStart) ? 4 : 0,
                                    borderTopRightRadius: isEnd ? 4 : 0,
                                    borderBottomRightRadius: isEnd ? 4 : 0,
                                    padding: "3px 6px",
                                    cursor: "pointer",
                                    transition: "background 0.15s",
                                    overflow: "hidden",
                                    whiteSpace: "nowrap",
                                    marginLeft: (isStart || isWeekStart) ? 0 : -6,
                                    marginRight: isEnd ? 0 : -6,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = clr.dim)}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = clr.bg)}
                                >
                                  {(show || isWeekStart) ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <span style={{ fontSize: 10, fontWeight: 600, color: clr.solid, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {conf.name}
                                      </span>
                                      {conf.location && (
                                        <span style={{ fontSize: 9, color: TEXT_TERTIARY, overflow: "hidden", textOverflow: "ellipsis" }}>
                                          {conf.location}
                                        </span>
                                      )}
                                      {conf.attendees && conf.attendees.length > 0 && (
                                        <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
                                          {conf.attendees.slice(0, 3).map((a, idx) => (
                                            <div key={idx} style={{
                                              width: 14, height: 14, borderRadius: "50%", background: clr.solid,
                                              display: "flex", alignItems: "center", justifyContent: "center",
                                              fontSize: 7, fontWeight: 700, color: "#fff",
                                            }}>
                                              {attName(a).charAt(0)}
                                            </div>
                                          ))}
                                          {conf.attendees.length > 3 && (
                                            <span style={{ fontSize: 8, color: TEXT_TERTIARY, marginLeft: 2 }}>+{conf.attendees.length - 3}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ height: 14 }} />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ─── YEAR VIEW ─── */}
              {calView === "year" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  {Array.from({ length: 12 }).map((_, mi) => {
                    const dim = getDaysInMonth(calYear, mi)
                    const fd = getFirstDayOfWeek(calYear, mi)
                    const mStart = new Date(calYear, mi, 1)
                    const mEnd = new Date(calYear, mi, dim, 23, 59, 59)
                    const mConfs = conferences.filter((c) => {
                      const cs = new Date(c.startDate)
                      const ce = new Date(c.endDate)
                      return !(cs > mEnd || ce < mStart)
                    })
                    return (
                      <div key={mi} style={{ ...cardStyle, padding: 12 }}>
                        <div
                          onClick={() => { setCalMonth(mi); setCalView("month") }}
                          style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 8, cursor: "pointer" }}
                        >
                          {MONTH_NAMES[mi]}
                        </div>
                        {/* Mini month grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 6 }}>
                          {DAYS.map((d) => (
                            <div key={d} style={{ fontSize: 8, color: TEXT_TERTIARY, textAlign: "center" }}>{d.charAt(0)}</div>
                          ))}
                          {Array.from({ length: fd }).map((_, i) => <div key={`ye-${i}`} />)}
                          {Array.from({ length: dim }).map((_, di) => {
                            const d = di + 1
                            const matchedConf = mConfs.find((c) => {
                              const cs = new Date(c.startDate); cs.setHours(0, 0, 0, 0)
                              const ce = new Date(c.endDate); ce.setHours(23, 59, 59, 999)
                              const date = new Date(calYear, mi, d)
                              return date >= cs && date <= ce
                            })
                            const hasConf = !!matchedConf
                            const dayClr = matchedConf ? (confColorMap.get(matchedConf.id) || CONF_COLORS[0]).solid : ROSE
                            const today = isSameDay(new Date(calYear, mi, d), new Date())
                            return (
                              <div
                                key={d}
                                style={{
                                  fontSize: 8,
                                  textAlign: "center",
                                  padding: "1px 0",
                                  borderRadius: 2,
                                  color: hasConf ? "#fff" : today ? ROSE : TEXT_TERTIARY,
                                  background: hasConf ? dayClr : today ? "rgba(192,139,136,0.15)" : "transparent",
                                  cursor: hasConf ? "pointer" : "default",
                                  fontWeight: today || hasConf ? 700 : 400,
                                }}
                                onClick={() => {
                                  if (hasConf) {
                                    setCalMonth(mi)
                                    setCalDay(d)
                                    setCalView("day")
                                  }
                                }}
                              >
                                {d}
                              </div>
                            )
                          })}
                        </div>
                        {/* Conference bars for this month */}
                        {mConfs.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                            {mConfs.slice(0, 3).map((c) => {
                              const clr = confColorMap.get(c.id) || CONF_COLORS[0]
                              return (
                              <div
                                key={c.id}
                                onClick={() => router.push(`/conferences/${c.id}`)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 4,
                                  padding: "3px 6px", borderRadius: 4,
                                  background: clr.bg, borderLeft: `2px solid ${clr.solid}`,
                                  cursor: "pointer", overflow: "hidden",
                                }}
                                title={`${c.name} — ${c.location || ""} — ${formatDateRange(c.startDate, c.endDate)}`}
                              >
                                <span style={{ fontSize: 9, fontWeight: 600, color: clr.solid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {c.name}
                                </span>
                                {c.attendees && c.attendees.length > 0 && (
                                  <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
                                    {c.attendees.slice(0, 2).map((a, idx) => (
                                      <div key={idx} style={{ width: 10, height: 10, borderRadius: "50%", background: clr.solid, fontSize: 6, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        {attName(a).charAt(0)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              )
                            })}
                            {mConfs.length > 3 && (
                              <span style={{ fontSize: 9, color: TEXT_TERTIARY, paddingLeft: 6 }}>+{mConfs.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ─── WEEK VIEW ─── */}
              {calView === "week" && (() => {
                const ws = getWeekStart(new Date(calYear, calMonth, calDay))
                const weekDays = Array.from({ length: 7 }).map((_, i) => {
                  const d = new Date(ws)
                  d.setDate(d.getDate() + i)
                  return d
                })
                return (
                  <div style={cardStyle}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {weekDays.map((d, i) => {
                        const today = isSameDay(d, new Date())
                        return (
                          <div key={i} style={{ padding: "10px 8px", textAlign: "center", borderRight: i < 6 ? `1px solid ${CARD_BORDER}` : "none" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {DAYS[i]}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: today ? 700 : 400, color: today ? ROSE : TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
                              {d.getDate()}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* All-day conference blocks */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: 140, borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {weekDays.map((d, i) => {
                        const dayConfs = getConfsForDay(d.getDate(), d.getMonth(), d.getFullYear())
                        return (
                          <div key={i} style={{ padding: 6, borderRight: i < 6 ? `1px solid ${CARD_BORDER}` : "none", display: "flex", flexDirection: "column", gap: 4 }}>
                            {dayConfs.map((c) => {
                              const clr = confColorMap.get(c.id) || CONF_COLORS[0]
                              const cs = new Date(c.startDate); cs.setHours(0, 0, 0, 0)
                              const isStart = isSameDay(cs, d) || i === 0
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => router.push(`/conferences/${c.id}`)}
                                  style={{
                                    background: clr.bg,
                                    borderLeft: isStart ? `3px solid ${clr.solid}` : "none",
                                    borderRadius: isStart ? 4 : 0,
                                    padding: "4px 6px",
                                    cursor: "pointer",
                                    overflow: "hidden",
                                    whiteSpace: "nowrap",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = clr.dim)}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = clr.bg)}
                                >
                                  {isStart ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, color: clr.solid, fontFamily: "'DM Sans', sans-serif" }}>
                                      {c.name}
                                    </span>
                                  ) : (
                                    <div style={{ height: 14 }} />
                                  )}
                                </div>
                              )
                            })}
                            {dayConfs.length === 0 && (
                              <div style={{ fontSize: 10, color: TEXT_TERTIARY, textAlign: "center", paddingTop: 20 }}>—</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Time slots placeholder */}
                    <div style={{ padding: "20px 16px", textAlign: "center", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                      Team calendar events will appear here when Google Calendar sync is enabled
                    </div>
                  </div>
                )
              })()}

              {/* ─── DAY VIEW ─── */}
              {calView === "day" && (() => {
                const dayDate = new Date(calYear, calMonth, calDay)
                const dayConfs = getConfsForDay(calDay)
                return (
                  <div style={cardStyle}>
                    {/* All-day conference banners */}
                    {dayConfs.length > 0 && (
                      <div style={{ padding: 12, borderBottom: `1px solid ${CARD_BORDER}` }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                          Conferences
                        </div>
                        {dayConfs.map((c) => {
                          const clr = confColorMap.get(c.id) || CONF_COLORS[0]
                          return (
                          <div
                            key={c.id}
                            onClick={() => router.push(`/conferences/${c.id}`)}
                            style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "10px 14px", borderRadius: 8,
                              background: clr.bg, borderLeft: `3px solid ${clr.solid}`,
                              cursor: "pointer", marginBottom: 6,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = clr.dim)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = clr.bg)}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: clr.solid, fontFamily: "'DM Sans', sans-serif" }}>
                                {c.name}
                              </div>
                              <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}>
                                {c.location && `${c.location} · `}{formatDateRange(c.startDate, c.endDate)}
                              </div>
                            </div>
                            {c.attendees && c.attendees.length > 0 && (
                              <div style={{ display: "flex", gap: 2 }}>
                                {c.attendees.slice(0, 4).map((a, idx) => (
                                  <div key={idx} style={{
                                    width: 24, height: 24, borderRadius: "50%", background: clr.solid,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 10, fontWeight: 700, color: "#fff",
                                  }}>
                                    {attName(a).charAt(0)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          )
                        })}
                      </div>
                    )}
                    {dayConfs.length === 0 && (
                      <div style={{ padding: "40px 20px", textAlign: "center" }}>
                        <div style={{ fontSize: 14, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                          No conferences on {dayDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </div>
                      </div>
                    )}
                    {/* Time slots */}
                    <div style={{ padding: "12px 16px" }}>
                      {Array.from({ length: 12 }).map((_, i) => {
                        const hour = i + 8
                        return (
                          <div key={hour} style={{ display: "flex", borderTop: `1px solid ${CARD_BORDER}`, minHeight: 48 }}>
                            <div style={{ width: 60, padding: "8px 8px 8px 0", fontSize: 11, color: TEXT_TERTIARY, textAlign: "right", fontFamily: "'DM Sans', sans-serif" }}>
                              {hour.toString().padStart(2, "0")}:00
                            </div>
                            <div style={{ flex: 1, padding: "8px 12px" }} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* ═══════ TAB 2: VEILLE / INTEL ═══════ */}
        {activeTab === "intel" && (
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 400, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY, margin: 0 }}>
                Suggested Conferences
              </h2>
              <button onClick={() => setShowRejected((v) => !v)} style={{ ...btnSecondary, fontSize: 11 }}>
                {showRejected ? "Hide Rejected" : "Show Rejected"}
              </button>
            </div>

            {intelResults.length === 0 && (
              <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
                <p style={{ color: TEXT_TERTIARY, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                  No conference suggestions found. Run an intel scan with the &quot;Conferences&quot; category to discover events.
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {intelResults
                .filter((item) => showRejected || !rejectedIds.has(item.id))
                .map((item) => {
                  const isAccepted = acceptedIds.has(item.id)
                  const isRejected = rejectedIds.has(item.id)
                  const isExpanded = expandedIntel.has(item.id)
                  return (
                    <div key={item.id} style={{ ...cardStyle, opacity: isRejected ? 0.45 : 1, transition: "opacity 0.2s" }}>
                      <div style={{ padding: "16px 20px" }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3" style={{ marginBottom: 6 }}>
                              <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{item.title}</h3>
                              {isAccepted && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 4, background: "rgba(34,197,94,0.12)", color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.04em" }}>Accepted</span>}
                              {isRejected && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 4, background: "rgba(239,68,68,0.12)", color: "#EF4444", textTransform: "uppercase", letterSpacing: "0.04em" }}>Rejected</span>}
                            </div>
                            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, margin: 0 }}>
                              {isExpanded ? (item.description || item.summary || "No description.") : (item.description || item.summary || "No description.").slice(0, 180) + ((item.description || item.summary || "").length > 180 ? "..." : "")}
                            </p>
                            {item.url && isExpanded && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: ROSE, fontFamily: "'DM Sans', sans-serif", marginTop: 8, display: "inline-block" }}>
                                {item.url}
                              </a>
                            )}
                          </div>
                          {!isAccepted && !isRejected && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => openAcceptModal(item)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", color: "#22C55E", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Accept</button>
                              <button onClick={() => setRejectedIds((prev) => new Set(prev).add(item.id))} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#EF4444", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Reject</button>
                              <button onClick={() => setExpandedIntel((prev) => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n })} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11 }}>
                                {isExpanded ? "Less" : "More Info"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ═══════ TAB 3: REPORTS ═══════ */}
        {activeTab === "reports" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 400, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY, margin: 0, marginBottom: 20 }}>Conference Reports</h2>
            {pastConferences.length === 0 && (
              <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
                <p style={{ color: TEXT_TERTIARY, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No past conferences found.</p>
              </div>
            )}
            {pastConferences.length > 0 && (
              <div style={cardStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 160px", gap: 12, padding: "12px 20px", borderBottom: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.02)" }}>
                  {["Conference", "Dates", "Location", "Team", "Status"].map((h) => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                  ))}
                </div>
                {pastConferences.map((conf) => {
                  const status = getReportStatus(conf)
                  return (
                    <div
                      key={conf.id}
                      onClick={() => router.push(`/conferences/${conf.id}`)}
                      style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 160px", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${CARD_BORDER}`, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conf.name}</span>
                      <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>{formatDateRange(conf.startDate, conf.endDate)}</span>
                      <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conf.location || "—"}</span>
                      <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>{conf.attendees?.length ?? 0}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6, background: status.bg, color: status.color, fontFamily: "'DM Sans', sans-serif", display: "inline-block", textAlign: "center", width: "fit-content" }}>{status.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════ ACCEPT INTEL MODAL ═══════ */}
      {acceptModalItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setAcceptModalItem(null)}>
          <div style={{ ...cardStyle, width: "100%", maxWidth: 520, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}` }}>
              <h3 style={{ fontSize: 16, fontWeight: 400, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY, margin: 0 }}>Accept Conference</h3>
              <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>{acceptModalItem.title}</p>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" value={acceptDates.start} onChange={(e) => setAcceptDates((d) => ({ ...d, start: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input type="date" value={acceptDates.end} onChange={(e) => setAcceptDates((d) => ({ ...d, end: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input type="text" value={acceptLocation} onChange={(e) => setAcceptLocation(e.target.value)} placeholder="City, Country" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Attendees</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {teamMembers.map((m) => {
                    const selected = acceptAttendees.find((a) => a.id === m.id)
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <label className="flex items-center gap-2" style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
                          <input type="checkbox" checked={!!selected} onChange={() => setAcceptAttendees((prev) => selected ? prev.filter((a) => a.id !== m.id) : [...prev, { id: m.id, role: "Attendee" }])} style={{ accentColor: ROSE }} />
                          <span style={{ fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>{m.name}</span>
                        </label>
                        {selected && (
                          <select value={selected.role} onChange={(e) => setAcceptAttendees((prev) => prev.map((a) => (a.id === m.id ? { ...a, role: e.target.value } : a)))} style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }}>
                            {ATTENDEE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3" style={{ marginTop: 8 }}>
                <button onClick={() => setAcceptModalItem(null)} style={btnSecondary}>Cancel</button>
                <button onClick={submitAccept} disabled={!acceptDates.start || !acceptDates.end} style={{ ...btnPrimary, opacity: (!acceptDates.start || !acceptDates.end) ? 0.5 : 1, cursor: (!acceptDates.start || !acceptDates.end) ? "not-allowed" : "pointer" }}>
                  Create Conference
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ADD CONFERENCE MODAL ═══════ */}
      {showAddModal && <AddConferenceModal teamMembers={teamMembers} onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); fetchConferences() }} />}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   ADD CONFERENCE MODAL
   ══════════════════════════════════════════════════════════════════ */
function AddConferenceModal({
  teamMembers,
  onClose,
  onSuccess,
}: {
  teamMembers: TeamMember[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [country, setCountry] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [website, setWebsite] = useState("")
  const [description, setDescription] = useState("")
  const [attendees, setAttendees] = useState<{ id: string; role: string }[]>([])
  const [color, setColor] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillMsg, setAutoFillMsg] = useState("")

  const toggleAttendee = (id: string) => {
    setAttendees((prev) => {
      const exists = prev.find((a) => a.id === id)
      return exists ? prev.filter((a) => a.id !== id) : [...prev, { id, role: "Attendee" }]
    })
  }

  const updateRole = (id: string, role: string) => {
    setAttendees((prev) => prev.map((a) => (a.id === id ? { ...a, role } : a)))
  }

  /* ── Auto-fill from website ── */
  const handleAutoFill = async () => {
    if (!website || autoFilling) return
    setAutoFilling(true)
    setAutoFillMsg("Sentinel is reading the conference website...")
    try {
      const res = await fetch("/api/conferences/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: website }),
      })
      if (!res.ok) throw new Error("Failed")
      const { extracted } = await res.json()
      if (extracted) {
        if (extracted.name && !name) setName(extracted.name)
        if (extracted.location && !location) setLocation(extracted.location)
        if (extracted.country && !country) setCountry(extracted.country)
        if (extracted.startDate && !startDate) setStartDate(extracted.startDate)
        if (extracted.endDate && !endDate) setEndDate(extracted.endDate)
        if (extracted.description) {
          if (!description) setDescription(extracted.description)
          else if (!description.includes(extracted.description)) setDescription(description + "\n\n" + extracted.description)
        }
        setAutoFillMsg("Auto-filled from website — review and adjust if needed")
      }
    } catch {
      setAutoFillMsg("Could not extract data from this website")
    }
    setAutoFilling(false)
    setTimeout(() => setAutoFillMsg(""), 5000)
  }

  const handleSubmit = async () => {
    if (!name || !startDate || !endDate) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name,
        location,
        country,
        startDate,
        endDate,
        website,
        description,
        color: color || undefined,
        attendees: attendees.map((a) => ({ id: a.id, role: a.role })),
      }
      const res = await fetch("/api/conferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) onSuccess()
    } catch { /* silent */ }
    setSubmitting(false)
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}`, background: "rgba(192,139,136,0.03)", position: "sticky", top: 0, zIndex: 10 }}>
          <h3 style={{ fontSize: 18, fontWeight: 400, fontFamily: "'Bellfair', serif", color: "#fff", margin: 0 }}>Add Conference</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, fontSize: 18, cursor: "pointer", padding: 4 }}>&#x2715;</button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Conference name" style={inputStyle} />
          </div>

          {/* Location + Country */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" style={inputStyle} />
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
            <div>
              <label style={labelStyle}>End Date *</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
          </div>

          {/* Website + Auto-fill */}
          <div>
            <label style={labelStyle}>Website</label>
            <div className="flex items-center gap-2">
              <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." style={{ ...inputStyle, flex: 1 }} />
              {website && (
                <button
                  onClick={handleAutoFill}
                  disabled={autoFilling}
                  style={{
                    padding: "9px 14px",
                    background: autoFilling ? "rgba(192,139,136,0.1)" : "rgba(192,139,136,0.08)",
                    border: `1px solid ${ROSE}`,
                    borderRadius: 8,
                    color: ROSE_HOVER,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: autoFilling ? "wait" : "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {autoFilling ? "Reading..." : "🤖 Auto-fill"}
                </button>
              )}
            </div>
            {autoFillMsg && (
              <div style={{ marginTop: 6, fontSize: 11, color: autoFillMsg.includes("Could not") ? "#EF4444" : "#22C55E", fontFamily: "'DM Sans', sans-serif" }}>
                {autoFillMsg}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Conference details, goals, notes..." rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {/* Color picker */}
          <div>
            <label style={labelStyle}>Color</label>
            <div className="flex items-center gap-2">
              {CONF_COLORS.map((c) => (
                <button
                  key={c.solid}
                  onClick={() => setColor(color === c.solid ? "" : c.solid)}
                  style={{
                    width: 28, height: 28, borderRadius: 8, background: c.solid, border: color === c.solid ? "2px solid #fff" : "2px solid transparent",
                    cursor: "pointer", transition: "all 0.15s", opacity: color && color !== c.solid ? 0.4 : 1,
                    boxShadow: color === c.solid ? `0 0 8px ${c.solid}50` : "none",
                  }}
                  title={c.solid}
                />
              ))}
              {color && (
                <button
                  onClick={() => setColor("")}
                  style={{ fontSize: 11, color: TEXT_TERTIARY, background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginLeft: 4 }}
                >
                  Auto
                </button>
              )}
            </div>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
              {color ? "Manual color selected" : "Color will be auto-assigned"}
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label style={labelStyle}>Attendees</label>
            <div style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: 12, maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {teamMembers.length === 0 && (
                <span style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>No team members loaded.</span>
              )}
              {teamMembers.map((m) => {
                const selected = attendees.find((a) => a.id === m.id)
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <label className="flex items-center gap-2" style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
                      <input type="checkbox" checked={!!selected} onChange={() => toggleAttendee(m.id)} style={{ accentColor: ROSE }} />
                      <span style={{ fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>{m.name}</span>
                    </label>
                    {selected && (
                      <select value={selected.role} onChange={(e) => updateRole(m.id, e.target.value)} style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }}>
                        {ATTENDEE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Budget toggle */}
          {/* Submit */}
          <div className="flex items-center justify-end gap-3" style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${CARD_BORDER}` }}>
            <button onClick={onClose} style={btnSecondary}>Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!name || !startDate || !endDate || submitting}
              style={{ ...btnPrimary, opacity: (!name || !startDate || !endDate || submitting) ? 0.5 : 1, cursor: (!name || !startDate || !endDate || submitting) ? "not-allowed" : "pointer" }}
              onMouseEnter={(e) => { if (name && startDate && endDate && !submitting) e.currentTarget.style.background = ROSE_HOVER }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ROSE }}
            >
              {submitting ? "Creating..." : "Create Conference"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
