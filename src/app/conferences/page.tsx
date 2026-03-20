"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import PageHeader from "@/components/layout/PageHeader"

/* ── Design tokens ── */
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "rgba(240,240,242,0.92)"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.35)"
const ROSE = "#C08B88"
const ROSE_HOVER = "#D4A5A2"
const ROSE_DIM = "rgba(192,139,136,0.15)"

type TabKey = "calendar" | "intel" | "reports"

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
  attendees?: { employeeId: string; name: string; role: string }[]
  budget?: {
    ticketCost?: number
    hotelCost?: number
    flightCost?: number
    mealsCost?: number
    otherCost?: number
    currency?: string
    notes?: string
  }
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
const ATTENDEE_ROLES = ["Speaker", "Attendee", "Booth", "Networking"]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Mon=0
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
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

/* ── Styles ── */
const cardStyle: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 12,
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

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function ConferencesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>("calendar")
  const [showAddModal, setShowAddModal] = useState(false)

  // Data
  const [conferences, setConferences] = useState<Conference[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [intelResults, setIntelResults] = useState<IntelResult[]>([])
  const [loading, setLoading] = useState(true)

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
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
      .then((r) => r.json())
      .then((data) => setConferences(data.conferences ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fetchTeam = useCallback(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data) => {
        const members: TeamMember[] = data.employees ?? data.members ?? data ?? []
        setTeamMembers(members)
        setFilterMembers(new Set(members.map((m) => m.id)))
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

  /* ── Calendar helpers ── */
  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1) }
    else setCalMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1) }
    else setCalMonth((m) => m + 1)
  }

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfWeek(calYear, calMonth)

  // Filter conferences for current month view
  const monthStart = new Date(calYear, calMonth, 1)
  const monthEnd = new Date(calYear, calMonth, daysInMonth, 23, 59, 59)

  const visibleConferences = conferences.filter((c) => {
    const cs = new Date(c.startDate)
    const ce = new Date(c.endDate)
    if (cs > monthEnd || ce < monthStart) return false
    // Attendee filter
    if (filterMembers.size < teamMembers.length && c.attendees) {
      const hasMatch = c.attendees.some((a) => filterMembers.has(a.employeeId))
      if (!hasMatch) return false
    }
    return true
  })

  // Get conferences for a specific day
  const getConfsForDay = (day: number) => {
    const date = new Date(calYear, calMonth, day)
    return visibleConferences.filter((c) => {
      const cs = new Date(c.startDate)
      const ce = new Date(c.endDate)
      cs.setHours(0, 0, 0, 0)
      ce.setHours(23, 59, 59, 999)
      return date >= cs && date <= ce
    })
  }

  // Check if day is start of conference (for rendering bar start)
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
          attendees: acceptAttendees,
        }),
      })
      setAcceptedIds((prev) => new Set(prev).add(acceptModalItem.id))
      setAcceptModalItem(null)
      fetchConferences()
    } catch { /* silent */ }
  }

  /* ── Reports helpers ── */
  const getReportStatus = (conf: Conference) => {
    if (conf.reportStatus === "submitted") return { label: "Report submitted", color: "#22C55E", bg: "rgba(34,197,94,0.1)" }
    const endPlusSeven = new Date(conf.endDate)
    endPlusSeven.setDate(endPlusSeven.getDate() + 7)
    if (new Date() > endPlusSeven) return { label: "Overdue", color: "#EF4444", bg: "rgba(239,68,68,0.1)" }
    return { label: "Awaiting report", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" }
  }

  const pastConferences = conferences.filter((c) => new Date(c.endDate) < new Date())

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
          <div>
            {/* Team member filter pills */}
            {teamMembers.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 20 }}>
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

            {/* Month header */}
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} style={btnSecondary}>&#8592;</button>
                <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", minWidth: 180, textAlign: "center" }}>
                  {monthLabel}
                </span>
                <button onClick={nextMonth} style={btnSecondary}>&#8594;</button>
              </div>
              <button
                onClick={() => { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()) }}
                style={btnSecondary}
              >
                Today
              </button>
            </div>

            {/* Calendar grid */}
            <div style={cardStyle}>
              {/* Day headers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  borderBottom: `1px solid ${CARD_BORDER}`,
                }}
              >
                {DAYS.map((d) => (
                  <div
                    key={d}
                    style={{
                      padding: "10px 8px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: TEXT_TERTIARY,
                      fontFamily: "'DM Sans', sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                }}
              >
                {/* Empty cells for offset */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    style={{
                      minHeight: 90,
                      borderRight: `1px solid ${CARD_BORDER}`,
                      borderBottom: `1px solid ${CARD_BORDER}`,
                      background: "rgba(255,255,255,0.01)",
                    }}
                  />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const confs = getConfsForDay(day)
                  const isToday = isSameDay(new Date(calYear, calMonth, day), new Date())

                  return (
                    <div
                      key={day}
                      style={{
                        minHeight: 90,
                        padding: "6px 6px 4px",
                        borderRight: `1px solid ${CARD_BORDER}`,
                        borderBottom: `1px solid ${CARD_BORDER}`,
                        background: isToday ? "rgba(192,139,136,0.04)" : "transparent",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: isToday ? 700 : 400,
                          color: isToday ? ROSE : TEXT_SECONDARY,
                          fontFamily: "'DM Sans', sans-serif",
                          marginBottom: 4,
                        }}
                      >
                        {day}
                      </div>

                      {/* Conference bars */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {confs.map((conf) => {
                          const showLabel = isConfStart(conf, day)
                          return (
                            <div
                              key={conf.id}
                              onClick={() => router.push(`/conferences/${conf.id}`)}
                              style={{
                                background: ROSE_DIM,
                                borderRadius: showLabel ? 4 : 0,
                                borderTopLeftRadius: showLabel ? 4 : 0,
                                borderBottomLeftRadius: showLabel ? 4 : 0,
                                padding: "3px 6px",
                                cursor: "pointer",
                                transition: "background 0.15s",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(192,139,136,0.25)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = ROSE_DIM)}
                            >
                              {showLabel && (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: ROSE_HOVER, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {conf.name}
                                  </span>
                                  {conf.location && (
                                    <span style={{ fontSize: 9, color: TEXT_TERTIARY, overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {conf.location}
                                    </span>
                                  )}
                                  {conf.attendees && conf.attendees.length > 0 && (
                                    <span style={{ fontSize: 9, color: TEXT_TERTIARY, flexShrink: 0 }}>
                                      ({conf.attendees.length})
                                    </span>
                                  )}
                                </div>
                              )}
                              {!showLabel && (
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
          </div>
        )}

        {/* ═══════ TAB 2: VEILLE / INTEL ═══════ */}
        {activeTab === "intel" && (
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 400, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY, margin: 0 }}>
                Suggested Conferences
              </h2>
              <button
                onClick={() => setShowRejected((v) => !v)}
                style={{ ...btnSecondary, fontSize: 11 }}
              >
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
                    <div
                      key={item.id}
                      style={{
                        ...cardStyle,
                        opacity: isRejected ? 0.45 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <div style={{ padding: "16px 20px" }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3" style={{ marginBottom: 6 }}>
                              <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
                                {item.title}
                              </h3>
                              {isAccepted && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 4, background: "rgba(34,197,94,0.12)", color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                  Accepted
                                </span>
                              )}
                              {isRejected && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 4, background: "rgba(239,68,68,0.12)", color: "#EF4444", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                  Rejected
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, margin: 0 }}>
                              {isExpanded
                                ? (item.description || item.summary || "No description available.")
                                : (item.description || item.summary || "No description available.").slice(0, 180) + ((item.description || item.summary || "").length > 180 ? "..." : "")
                              }
                            </p>
                            {item.url && isExpanded && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: 11, color: ROSE, fontFamily: "'DM Sans', sans-serif", marginTop: 8, display: "inline-block" }}
                              >
                                {item.url}
                              </a>
                            )}
                          </div>

                          {/* Action buttons */}
                          {!isAccepted && !isRejected && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => openAcceptModal(item)}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(34,197,94,0.3)",
                                  background: "rgba(34,197,94,0.08)",
                                  color: "#22C55E",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  fontFamily: "'DM Sans', sans-serif",
                                  cursor: "pointer",
                                }}
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => setRejectedIds((prev) => new Set(prev).add(item.id))}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(239,68,68,0.3)",
                                  background: "rgba(239,68,68,0.08)",
                                  color: "#EF4444",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  fontFamily: "'DM Sans', sans-serif",
                                  cursor: "pointer",
                                }}
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => setExpandedIntel((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(item.id)) next.delete(item.id)
                                  else next.add(item.id)
                                  return next
                                })}
                                style={{
                                  ...btnSecondary,
                                  padding: "6px 12px",
                                  fontSize: 11,
                                }}
                              >
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
            <h2 style={{ fontSize: 18, fontWeight: 400, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY, margin: 0, marginBottom: 20 }}>
              Conference Reports
            </h2>

            {pastConferences.length === 0 && (
              <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
                <p style={{ color: TEXT_TERTIARY, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                  No past conferences found. Completed conferences will appear here for reporting.
                </p>
              </div>
            )}

            {pastConferences.length > 0 && (
              <div style={cardStyle}>
                {/* Table header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 80px 160px",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom: `1px solid ${CARD_BORDER}`,
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  {["Conference", "Dates", "Location", "Team", "Status"].map((h) => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Table rows */}
                {pastConferences.map((conf) => {
                  const status = getReportStatus(conf)
                  return (
                    <div
                      key={conf.id}
                      onClick={() => router.push(`/conferences/${conf.id}`)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 80px 160px",
                        gap: 12,
                        padding: "14px 20px",
                        borderBottom: `1px solid ${CARD_BORDER}`,
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conf.name}
                      </span>
                      <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {formatDateRange(conf.startDate, conf.endDate)}
                      </span>
                      <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conf.location || "—"}
                      </span>
                      <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {conf.attendees?.length ?? 0}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 12px",
                          borderRadius: 6,
                          background: status.bg,
                          color: status.color,
                          fontFamily: "'DM Sans', sans-serif",
                          display: "inline-block",
                          textAlign: "center",
                          width: "fit-content",
                        }}
                      >
                        {status.label}
                      </span>
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setAcceptModalItem(null)}
        >
          <div
            style={{
              ...cardStyle,
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}` }}>
              <h3 style={{ fontSize: 16, fontWeight: 400, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY, margin: 0 }}>
                Accept Conference
              </h3>
              <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
                {acceptModalItem.title}
              </p>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input
                    type="date"
                    value={acceptDates.start}
                    onChange={(e) => setAcceptDates((d) => ({ ...d, start: e.target.value }))}
                    style={{ ...inputStyle, colorScheme: "dark" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input
                    type="date"
                    value={acceptDates.end}
                    onChange={(e) => setAcceptDates((d) => ({ ...d, end: e.target.value }))}
                    style={{ ...inputStyle, colorScheme: "dark" }}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label style={labelStyle}>Location</label>
                <input
                  type="text"
                  value={acceptLocation}
                  onChange={(e) => setAcceptLocation(e.target.value)}
                  placeholder="City, Country"
                  style={inputStyle}
                />
              </div>

              {/* Attendees */}
              <div>
                <label style={labelStyle}>Attendees</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {teamMembers.map((m) => {
                    const selected = acceptAttendees.find((a) => a.id === m.id)
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <label className="flex items-center gap-2" style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={() => {
                              setAcceptAttendees((prev) =>
                                selected
                                  ? prev.filter((a) => a.id !== m.id)
                                  : [...prev, { id: m.id, role: "Attendee" }]
                              )
                            }}
                            style={{ accentColor: ROSE }}
                          />
                          <span style={{ fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                            {m.name}
                          </span>
                        </label>
                        {selected && (
                          <select
                            value={selected.role}
                            onChange={(e) =>
                              setAcceptAttendees((prev) =>
                                prev.map((a) => (a.id === m.id ? { ...a, role: e.target.value } : a))
                              )
                            }
                            style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }}
                          >
                            {ATTENDEE_ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3" style={{ marginTop: 8 }}>
                <button onClick={() => setAcceptModalItem(null)} style={btnSecondary}>Cancel</button>
                <button
                  onClick={submitAccept}
                  disabled={!acceptDates.start || !acceptDates.end}
                  style={{
                    ...btnPrimary,
                    opacity: (!acceptDates.start || !acceptDates.end) ? 0.5 : 1,
                    cursor: (!acceptDates.start || !acceptDates.end) ? "not-allowed" : "pointer",
                  }}
                >
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
   ADD CONFERENCE MODAL (extracted to keep main component cleaner)
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
  const [showBudget, setShowBudget] = useState(false)
  const [budget, setBudget] = useState({
    ticketCost: "",
    hotelCost: "",
    flightCost: "",
    mealsCost: "",
    otherCost: "",
    currency: "EUR",
    notes: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const toggleAttendee = (id: string) => {
    setAttendees((prev) => {
      const exists = prev.find((a) => a.id === id)
      return exists ? prev.filter((a) => a.id !== id) : [...prev, { id, role: "Attendee" }]
    })
  }

  const updateRole = (id: string, role: string) => {
    setAttendees((prev) => prev.map((a) => (a.id === id ? { ...a, role } : a)))
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
        attendees,
      }
      if (showBudget) {
        body.budget = {
          ticketCost: budget.ticketCost ? Number(budget.ticketCost) : undefined,
          hotelCost: budget.hotelCost ? Number(budget.hotelCost) : undefined,
          flightCost: budget.flightCost ? Number(budget.flightCost) : undefined,
          mealsCost: budget.mealsCost ? Number(budget.mealsCost) : undefined,
          otherCost: budget.otherCost ? Number(budget.otherCost) : undefined,
          currency: budget.currency,
          notes: budget.notes,
        }
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 16,
          width: "100%",
          maxWidth: 620,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${CARD_BORDER}`,
            background: "rgba(192,139,136,0.03)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 400, fontFamily: "'Bellfair', serif", color: "#fff", margin: 0 }}>
            Add Conference
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: TEXT_TERTIARY,
              fontSize: 18,
              cursor: "pointer",
              padding: 4,
            }}
          >
            &#x2715;
          </button>
        </div>

        {/* Form body */}
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

          {/* Website */}
          <div>
            <label style={labelStyle}>Website</label>
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Conference details, goals, notes..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Attendees */}
          <div>
            <label style={labelStyle}>Attendees</label>
            <div
              style={{
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 8,
                padding: 12,
                maxHeight: 200,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {teamMembers.length === 0 && (
                <span style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                  No team members loaded.
                </span>
              )}
              {teamMembers.map((m) => {
                const selected = attendees.find((a) => a.id === m.id)
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <label className="flex items-center gap-2" style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleAttendee(m.id)}
                        style={{ accentColor: ROSE }}
                      />
                      <span style={{ fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {m.name}
                      </span>
                    </label>
                    {selected && (
                      <select
                        value={selected.role}
                        onChange={(e) => updateRole(m.id, e.target.value)}
                        style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }}
                      >
                        {ATTENDEE_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Budget toggle */}
          <div>
            <button
              onClick={() => setShowBudget((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: ROSE,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ transform: showBudget ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>
                &#9654;
              </span>
              Budget Details
            </button>
          </div>

          {showBudget && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 0 0 12px", borderLeft: `2px solid ${CARD_BORDER}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Ticket Cost</label>
                  <input type="number" value={budget.ticketCost} onChange={(e) => setBudget((b) => ({ ...b, ticketCost: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hotel Cost</label>
                  <input type="number" value={budget.hotelCost} onChange={(e) => setBudget((b) => ({ ...b, hotelCost: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Flight Cost</label>
                  <input type="number" value={budget.flightCost} onChange={(e) => setBudget((b) => ({ ...b, flightCost: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Meals Cost</label>
                  <input type="number" value={budget.mealsCost} onChange={(e) => setBudget((b) => ({ ...b, mealsCost: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Other Cost</label>
                  <input type="number" value={budget.otherCost} onChange={(e) => setBudget((b) => ({ ...b, otherCost: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={budget.currency} onChange={(e) => setBudget((b) => ({ ...b, currency: e.target.value }))} style={inputStyle}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Budget Notes</label>
                <textarea
                  value={budget.notes}
                  onChange={(e) => setBudget((b) => ({ ...b, notes: e.target.value }))}
                  placeholder="Additional budget notes..."
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-3" style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${CARD_BORDER}` }}>
            <button onClick={onClose} style={btnSecondary}>Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!name || !startDate || !endDate || submitting}
              style={{
                ...btnPrimary,
                opacity: (!name || !startDate || !endDate || submitting) ? 0.5 : 1,
                cursor: (!name || !startDate || !endDate || submitting) ? "not-allowed" : "pointer",
              }}
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
