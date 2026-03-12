"use client"

import { useState, useEffect, useCallback } from "react"

/* ── Design Tokens ── */
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#E8E6E3"
const TEXT_SECONDARY = "rgba(232,230,227,0.7)"
const TEXT_TERTIARY = "rgba(232,230,227,0.4)"
const FROST = "#F5F0EB"
const GREEN = "#4ade80"
const RED = "#f87171"
const AMBER = "#fbbf24"
const INDIGO = "#818cf8"
const ROSE_GOLD = "#C08B88"

const LEAVE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  vacation: { bg: "rgba(74,222,128,0.12)", text: GREEN, dot: GREEN },
  sick: { bg: "rgba(248,113,113,0.12)", text: RED, dot: RED },
  ooo: { bg: "rgba(129,140,248,0.12)", text: INDIGO, dot: INDIGO },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "rgba(251,191,36,0.12)", text: AMBER },
  approved: { bg: "rgba(74,222,128,0.12)", text: GREEN },
  rejected: { bg: "rgba(248,113,113,0.12)", text: RED },
}

const LEAVE_LABELS: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick Leave",
  ooo: "Out of Office",
}

interface Employee {
  id: string
  name: string
  initials: string
  avatarColor: string
  department?: string
  isAdmin?: boolean
}

interface LeaveRequest {
  id: string
  employeeId: string
  employee: Employee
  type: string
  startDate: string
  endDate: string
  halfDay: boolean
  halfDayPeriod: string | null
  reason: string | null
  status: string
  reviewedBy: { name: string } | null
  reviewedAt: string | null
  reviewNote: string | null
  totalDays: number
  createdAt: string
}

interface LeaveBalance {
  id: string
  employeeId: string
  year: number
  vacationTotal: number
  vacationUsed: number
  vacationPending: number
  sickTotal: number
  sickUsed: number
  oooTotal: number
  oooUsed: number
}

interface WhoIsOut {
  id: string
  employee: Employee
  type: string
  startDate: string
  endDate: string
  halfDay: boolean
  halfDayPeriod: string | null
}

/* ── Helper: business days ── */
function calculateBusinessDays(start: Date, end: Date, halfDay: boolean): number {
  if (halfDay) return 0.5
  let days = 0
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(0, 0, 0, 0)
  while (current <= endDate) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) days++
    current.setDate(current.getDate() + 1)
  }
  return days
}

const TABS = [
  { id: "calendar", label: "Calendar View", icon: "\uD83D\uDCC5" },
  { id: "my-leaves", label: "My Leaves", icon: "\uD83C\uDFD6\uFE0F" },
  { id: "admin", label: "Admin", icon: "\u2699\uFE0F" },
] as const

type TabId = typeof TABS[number]["id"]

const formatDate = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
const formatShortDate = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

export default function AbsencesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("calendar")
  const [me, setMe] = useState<Employee & { isAdmin?: boolean } | null>(null)
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([])
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [whoIsOut, setWhoIsOut] = useState<{ today: WhoIsOut[]; thisWeek: WhoIsOut[] }>({ today: [], thisWeek: [] })
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarLeaves, setCalendarLeaves] = useState<LeaveRequest[]>([])
  const [allBalances, setAllBalances] = useState<Array<LeaveBalance & { employee?: Employee }>>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  // Admin filter states
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterEmployee, setFilterEmployee] = useState("all")

  // Review note state
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")

  // Quota edit modal
  const [editingQuota, setEditingQuota] = useState<(LeaveBalance & { employee?: Employee }) | null>(null)
  const [quotaForm, setQuotaForm] = useState({ vacationTotal: 25, sickTotal: 10, oooTotal: 15 })

  /* ── Fetch current user ── */
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setMe(data.employee ?? null))
      .catch(() => {})
  }, [])

  /* ── Fetch data ── */
  const fetchMyRequests = useCallback(() => {
    if (!me) return
    fetch(`/api/leaves?employeeId=${me.id}`)
      .then((r) => r.json())
      .then((data) => setMyRequests(data.requests ?? []))
      .catch(() => {})
  }, [me])

  const fetchBalance = useCallback(() => {
    if (!me) return
    fetch(`/api/leaves/balance/${me.id}`)
      .then((r) => r.json())
      .then((data) => setBalance(data.balance ?? null))
      .catch(() => {})
  }, [me])

  const fetchWhoIsOut = useCallback(() => {
    fetch("/api/leaves/who-is-out")
      .then((r) => r.json())
      .then((data) => setWhoIsOut(data))
      .catch(() => {})
  }, [])

  const fetchAllRequests = useCallback(() => {
    if (!me?.isAdmin) return
    fetch("/api/leaves?all=true")
      .then((r) => r.json())
      .then((data) => setAllRequests(data.requests ?? []))
      .catch(() => {})
  }, [me])

  const fetchCalendarLeaves = useCallback(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0).toISOString()
    fetch(`/api/leaves?all=true&status=approved&startDate=${start}&endDate=${end}`)
      .then((r) => r.json())
      .then((data) => setCalendarLeaves(data.requests ?? []))
      .catch(() => {})
  }, [currentMonth])

  const fetchAllBalances = useCallback(() => {
    if (!me?.isAdmin) return
    fetch("/api/employees")
      .then((r) => r.json())
      .then(async (data) => {
        const emps = data.employees ?? []
        setEmployees(emps)
        const balances: Array<LeaveBalance & { employee?: Employee }> = []
        for (const emp of emps) {
          try {
            const res = await fetch(`/api/leaves/balance/${emp.id}`)
            const bData = await res.json()
            if (bData.balance) balances.push({ ...bData.balance, employee: emp })
          } catch { /* silent */ }
        }
        setAllBalances(balances)
      })
      .catch(() => {})
  }, [me])

  useEffect(() => {
    fetchWhoIsOut()
  }, [fetchWhoIsOut])

  useEffect(() => {
    if (!me) return
    fetchMyRequests()
    fetchBalance()
    if (me.isAdmin) {
      fetchAllRequests()
      fetchAllBalances()
    }
  }, [me, fetchMyRequests, fetchBalance, fetchAllRequests, fetchAllBalances])

  useEffect(() => {
    fetchCalendarLeaves()
  }, [fetchCalendarLeaves])

  /* ── Actions ── */
  const handleApprove = async (id: string) => {
    await fetch(`/api/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved", reviewNote: reviewNote || null }),
    })
    setReviewingId(null)
    setReviewNote("")
    fetchAllRequests()
    fetchWhoIsOut()
    fetchCalendarLeaves()
    fetchAllBalances()
  }

  const handleReject = async (id: string) => {
    await fetch(`/api/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", reviewNote: reviewNote || null }),
    })
    setReviewingId(null)
    setReviewNote("")
    fetchAllRequests()
    fetchAllBalances()
  }

  const handleCancel = async (id: string) => {
    await fetch(`/api/leaves/${id}`, { method: "DELETE" })
    fetchMyRequests()
    fetchBalance()
  }

  const handleSaveQuota = async () => {
    if (!editingQuota?.employee) return
    await fetch(`/api/leaves/balance/${editingQuota.employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quotaForm),
    })
    setEditingQuota(null)
    fetchAllBalances()
  }

  const exportCSV = () => {
    const filtered = getFilteredRequests()
    const header = "Employee,Type,Start,End,Days,Status,Reviewed By,Review Date\n"
    const rows = filtered.map((r) =>
      `"${r.employee.name}","${r.type}","${formatDate(r.startDate)}","${formatDate(r.endDate)}",${r.totalDays},"${r.status}","${r.reviewedBy?.name || ""}","${r.reviewedAt ? formatDate(r.reviewedAt) : ""}"`
    ).join("\n")
    const blob = new Blob([header + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `leave-requests-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getFilteredRequests = () => {
    return allRequests.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false
      if (filterType !== "all" && r.type !== filterType) return false
      if (filterEmployee !== "all" && r.employeeId !== filterEmployee) return false
      return true
    })
  }

  /* ── Calendar helpers ── */
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    return day === 0 ? 6 : day - 1 // Monday = 0
  }

  const getLeavesForDay = (day: number) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    dateStr.setHours(12, 0, 0, 0)
    return calendarLeaves.filter((l) => {
      const start = new Date(l.startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(l.endDate)
      end.setHours(23, 59, 59, 999)
      return dateStr >= start && dateStr <= end
    })
  }

  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() && currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()
  }

  /* ── Progress Ring Component ── */
  const ProgressRing = ({ used, pending, total, color, pendingColor, size = 100 }: { used: number; pending: number; total: number; color: string; pendingColor: string; size?: number }) => {
    const strokeWidth = 8
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const usedPct = total > 0 ? (used / total) : 0
    const pendingPct = total > 0 ? (pending / total) : 0
    const usedOffset = circumference * (1 - usedPct)
    const pendingOffset = circumference * (1 - pendingPct)
    const remaining = Math.max(0, total - used - pending)

    return (
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Background track */}
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
          {/* Pending arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={pendingColor} strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - usedPct - pendingPct)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
          {/* Used arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={usedOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: "'Bellfair', serif", fontSize: 24, color: FROST, lineHeight: 1 }}>{remaining}</span>
          <span style={{ fontSize: 8, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1 }}>left</span>
        </div>
      </div>
    )
  }

  /* ── Pending requests (for admin sidebar) ── */
  const pendingRequests = allRequests.filter((r) => r.status === "pending")

  const tabsToShow = me?.isAdmin ? TABS : TABS.filter((t) => t.id !== "admin")

  return (
    <div className="page-content" style={{ padding: 0 }}>
      {/* ── Header ── */}
      <div
        className="sticky-header"
        style={{
          padding: "24px 32px 0",
          background: "rgba(6,7,9,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${CARD_BORDER}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 28, fontWeight: 400, color: FROST, margin: 0, lineHeight: 1.2 }}>
              {"\uD83C\uDFD6\uFE0F"} Absences
            </h1>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
              Manage time off requests and team availability
            </p>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="btn-primary"
            style={{ padding: "8px 20px", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
          >
            + Request Leave
          </button>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 0, margin: "0 -32px", padding: "0 32px" }}>
          {tabsToShow.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 18px", fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? ROSE_GOLD : TEXT_TERTIARY,
                  background: "none", border: "none",
                  borderBottom: isActive ? `2px solid ${ROSE_GOLD}` : "2px solid transparent",
                  cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
                }}
              >
                {tab.icon} {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ padding: "28px 32px" }}>
        {/* ══════════ CALENDAR TAB ══════════ */}
        {activeTab === "calendar" && (
          <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
            {/* Monthly Calendar Grid */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  style={{ background: "none", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
                >
                  {"\u2190"}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: FROST, margin: 0 }}>
                    {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </h2>
                  <button
                    onClick={() => setCurrentMonth(new Date())}
                    style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_TERTIARY, padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Today
                  </button>
                </div>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  style={{ background: "none", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
                >
                  {"\u2192"}
                </button>
              </div>

              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 4 }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "4px 0", textTransform: "uppercase", letterSpacing: 1 }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
                {/* Empty cells before first day */}
                {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ minHeight: 80, background: "rgba(255,255,255,0.01)", borderRadius: 4 }} />
                ))}
                {/* Day cells */}
                {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, i) => {
                  const day = i + 1
                  const leaves = getLeavesForDay(day)
                  const today = isToday(day)
                  const isWeekend = (() => {
                    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                    return d.getDay() === 0 || d.getDay() === 6
                  })()

                  return (
                    <div
                      key={day}
                      style={{
                        minHeight: 80, padding: 4,
                        background: today ? "rgba(192,139,136,0.08)" : isWeekend ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)",
                        borderRadius: 4,
                        border: today ? `1px solid rgba(192,139,136,0.2)` : `1px solid transparent`,
                      }}
                    >
                      <div style={{
                        fontSize: 11, fontWeight: today ? 600 : 400,
                        color: today ? ROSE_GOLD : isWeekend ? TEXT_TERTIARY : TEXT_SECONDARY,
                        fontFamily: "'DM Sans', sans-serif", marginBottom: 4,
                      }}>
                        {day}
                      </div>
                      {leaves.slice(0, 3).map((l) => {
                        const lc = LEAVE_COLORS[l.type] || LEAVE_COLORS.vacation
                        return (
                          <div
                            key={l.id}
                            style={{
                              fontSize: 8, padding: "1px 4px", borderRadius: 3,
                              background: lc.bg, color: lc.text,
                              marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              height: l.halfDay ? 10 : "auto",
                              fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                            }}
                            title={`${l.employee.name} - ${LEAVE_LABELS[l.type]}${l.halfDay ? ` (${l.halfDayPeriod})` : ""}`}
                          >
                            {l.employee.initials} {l.halfDay ? (l.halfDayPeriod === "morning" ? "AM" : "PM") : ""}
                          </div>
                        )
                      })}
                      {leaves.length > 3 && (
                        <div style={{ fontSize: 8, color: TEXT_TERTIARY }}>+{leaves.length - 3}</div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
                {Object.entries(LEAVE_COLORS).map(([type, colors]) => (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.dot }} />
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>{LEAVE_LABELS[type]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Who's Out Today */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: FROST, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
                  {"\uD83D\uDD34"} Who{"'"}s Out Today
                </div>
                {whoIsOut.today.length === 0 ? (
                  <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                    {"\u2705"} Everyone{"'"}s in today
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {whoIsOut.today.map((w) => {
                      const lc = LEAVE_COLORS[w.type] || LEAVE_COLORS.vacation
                      return (
                        <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: w.employee.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
                            {w.employee.initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{w.employee.name}</div>
                          </div>
                          <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 8, background: lc.bg, color: lc.text, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {w.type}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Who's Out This Week */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: FROST, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
                  {"\uD83D\uDCC5"} This Week
                </div>
                {whoIsOut.thisWeek.length === 0 ? (
                  <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                    No absences this week
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {whoIsOut.thisWeek.map((w) => {
                      const lc = LEAVE_COLORS[w.type] || LEAVE_COLORS.vacation
                      return (
                        <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: w.employee.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
                            {w.employee.initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                              {w.employee.name}
                            </div>
                            <div style={{ fontSize: 9, color: TEXT_TERTIARY }}>
                              {formatShortDate(w.startDate)} - {formatShortDate(w.endDate)}
                            </div>
                          </div>
                          <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: lc.bg, color: lc.text, fontWeight: 500 }}>
                            {w.type}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Pending Requests (admin) */}
              {me?.isAdmin && pendingRequests.length > 0 && (
                <div className="card" style={{ padding: 16, border: `1px solid rgba(251,191,36,0.15)` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: AMBER, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
                    {"\u23F3"} Pending Requests ({pendingRequests.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {pendingRequests.slice(0, 5).map((r) => {
                      const lc = LEAVE_COLORS[r.type] || LEAVE_COLORS.vacation
                      return (
                        <div key={r.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, color: TEXT_PRIMARY, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{r.employee.name}</span>
                            <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: lc.bg, color: lc.text, fontWeight: 500 }}>{r.type}</span>
                          </div>
                          <div style={{ fontSize: 9, color: TEXT_TERTIARY, marginBottom: 6 }}>
                            {formatShortDate(r.startDate)} - {formatShortDate(r.endDate)} ({r.totalDays}d)
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => handleApprove(r.id)} style={{ background: "rgba(74,222,128,0.12)", border: "none", color: GREEN, fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer", fontWeight: 500 }}>
                              {"\u2713"} Approve
                            </button>
                            <button onClick={() => { setReviewingId(r.id); setActiveTab("admin") }} style={{ background: "rgba(248,113,113,0.08)", border: "none", color: RED, fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer", fontWeight: 500 }}>
                              {"\u2717"} Reject
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ MY LEAVES TAB ══════════ */}
        {activeTab === "my-leaves" && (
          <div className="fade-in">
            {/* Balance Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
              {balance && (
                <>
                  {/* Vacation */}
                  <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
                    <ProgressRing
                      used={balance.vacationUsed}
                      pending={balance.vacationPending}
                      total={balance.vacationTotal}
                      color={GREEN}
                      pendingColor="rgba(74,222,128,0.35)"
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: GREEN, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Vacation</div>
                      <div style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.8 }}>
                        Total: {balance.vacationTotal}<br />
                        Used: {balance.vacationUsed}<br />
                        Pending: {balance.vacationPending}<br />
                        Remaining: {Math.max(0, balance.vacationTotal - balance.vacationUsed - balance.vacationPending)}
                      </div>
                    </div>
                  </div>

                  {/* Sick */}
                  <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
                    <ProgressRing
                      used={balance.sickUsed}
                      pending={0}
                      total={balance.sickTotal}
                      color={RED}
                      pendingColor="rgba(248,113,113,0.35)"
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: RED, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Sick Leave</div>
                      <div style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.8 }}>
                        Total: {balance.sickTotal}<br />
                        Used: {balance.sickUsed}<br />
                        Remaining: {Math.max(0, balance.sickTotal - balance.sickUsed)}
                      </div>
                    </div>
                  </div>

                  {/* OOO */}
                  <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
                    <ProgressRing
                      used={balance.oooUsed}
                      pending={0}
                      total={balance.oooTotal}
                      color={INDIGO}
                      pendingColor="rgba(129,140,248,0.35)"
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INDIGO, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Out of Office</div>
                      <div style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.8 }}>
                        Total: {balance.oooTotal}<br />
                        Used: {balance.oooUsed}<br />
                        Remaining: {Math.max(0, balance.oooTotal - balance.oooUsed)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* My Requests List */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: 0 }}>My Requests</h3>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="btn-primary"
                  style={{ padding: "6px 14px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}
                >
                  + Request Leave
                </button>
              </div>

              {myRequests.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                  No leave requests yet. Click &quot;+ Request Leave&quot; to get started.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {myRequests.map((r, i) => {
                    const lc = LEAVE_COLORS[r.type] || LEAVE_COLORS.vacation
                    const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
                          borderBottom: i < myRequests.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                        }}
                      >
                        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: lc.bg, color: lc.text, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>
                          {r.type}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                            {formatDate(r.startDate)} - {formatDate(r.endDate)}
                          </div>
                          <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 2 }}>
                            {r.totalDays} day{r.totalDays !== 1 ? "s" : ""}{r.halfDay ? ` (${r.halfDayPeriod})` : ""}{r.reason ? ` \u00B7 ${r.reason}` : ""}
                          </div>
                        </div>
                        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: sc.bg, color: sc.text, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>
                          {r.status}
                        </span>
                        {r.status === "pending" && (
                          <button
                            onClick={() => handleCancel(r.id)}
                            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", color: RED, fontSize: 10, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                          >
                            Cancel
                          </button>
                        )}
                        {r.reviewedBy && (
                          <div style={{ fontSize: 9, color: TEXT_TERTIARY, flexShrink: 0 }}>
                            by {r.reviewedBy.name}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ ADMIN TAB ══════════ */}
        {activeTab === "admin" && me?.isAdmin && (
          <div className="fade-in">
            {/* Pending Approvals */}
            <div className="card" style={{ padding: 20, marginBottom: 24, border: `1px solid rgba(251,191,36,0.1)` }}>
              <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: AMBER, margin: "0 0 16px" }}>
                {"\u23F3"} Pending Approvals ({pendingRequests.length})
              </h3>
              {pendingRequests.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: TEXT_TERTIARY, fontSize: 12 }}>
                  {"\u2705"} No pending requests
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {pendingRequests.map((r, i) => {
                    const lc = LEAVE_COLORS[r.type] || LEAVE_COLORS.vacation
                    const isReviewing = reviewingId === r.id
                    return (
                      <div key={r.id} style={{ padding: "14px 0", borderBottom: i < pendingRequests.length - 1 ? `1px solid ${CARD_BORDER}` : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: r.employee.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
                            {r.employee.initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{r.employee.name}</div>
                            <div style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                              {formatShortDate(r.startDate)} - {formatShortDate(r.endDate)} ({r.totalDays}d){r.reason ? ` \u00B7 ${r.reason}` : ""}
                            </div>
                          </div>
                          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: lc.bg, color: lc.text, fontWeight: 500, textTransform: "uppercase" }}>{r.type}</span>
                          {!isReviewing && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => handleApprove(r.id)} style={{ background: "rgba(74,222,128,0.12)", border: "none", color: GREEN, fontSize: 10, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
                                {"\u2713"} Approve
                              </button>
                              <button onClick={() => setReviewingId(r.id)} style={{ background: "rgba(248,113,113,0.08)", border: "none", color: RED, fontSize: 10, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
                                {"\u2717"} Reject
                              </button>
                            </div>
                          )}
                        </div>
                        {isReviewing && (
                          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              className="oxen-input"
                              placeholder="Review note (optional)"
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              style={{ flex: 1, fontSize: 11, padding: "6px 10px" }}
                            />
                            <button onClick={() => handleReject(r.id)} style={{ background: RED, border: "none", color: FROST, fontSize: 10, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
                              Confirm Reject
                            </button>
                            <button onClick={() => { setReviewingId(null); setReviewNote("") }} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_TERTIARY, fontSize: 10, padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* All Requests Table */}
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: 0 }}>All Requests</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <select className="oxen-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ fontSize: 10, padding: "4px 8px", width: "auto" }}>
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select className="oxen-input" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ fontSize: 10, padding: "4px 8px", width: "auto" }}>
                    <option value="all">All Types</option>
                    <option value="vacation">Vacation</option>
                    <option value="sick">Sick</option>
                    <option value="ooo">OOO</option>
                  </select>
                  <select className="oxen-input" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} style={{ fontSize: 10, padding: "4px 8px", width: "auto" }}>
                    <option value="all">All Employees</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <button onClick={exportCSV} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    {"\uD83D\uDCE5"} Export CSV
                  </button>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Employee", "Type", "Start", "End", "Days", "Status", "Reviewed By", "Date"].map((h) => (
                        <th key={h} style={{ textAlign: "left", fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}`, textTransform: "uppercase", letterSpacing: 1 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredRequests().map((r) => {
                      const lc = LEAVE_COLORS[r.type] || LEAVE_COLORS.vacation
                      const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending
                      return (
                        <tr key={r.id}>
                          <td style={{ fontSize: 11, color: TEXT_PRIMARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}`, fontFamily: "'DM Sans', sans-serif" }}>{r.employee.name}</td>
                          <td style={{ padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                            <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 6, background: lc.bg, color: lc.text, fontWeight: 500, textTransform: "uppercase" }}>{r.type}</span>
                          </td>
                          <td style={{ fontSize: 10, color: TEXT_SECONDARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{formatShortDate(r.startDate)}</td>
                          <td style={{ fontSize: 10, color: TEXT_SECONDARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{formatShortDate(r.endDate)}</td>
                          <td style={{ fontSize: 11, color: TEXT_PRIMARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}`, fontVariantNumeric: "tabular-nums" }}>{r.totalDays}</td>
                          <td style={{ padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                            <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 6, background: sc.bg, color: sc.text, fontWeight: 500, textTransform: "uppercase" }}>{r.status}</span>
                          </td>
                          <td style={{ fontSize: 10, color: TEXT_TERTIARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{r.reviewedBy?.name || "-"}</td>
                          <td style={{ fontSize: 10, color: TEXT_TERTIARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{r.reviewedAt ? formatShortDate(r.reviewedAt) : "-"}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Team Balance Overview */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: "0 0 16px" }}>Team Balances</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {allBalances.map((b) => {
                  const vacRemaining = Math.max(0, b.vacationTotal - b.vacationUsed - b.vacationPending)
                  const sickRemaining = Math.max(0, b.sickTotal - b.sickUsed)
                  const oooRemaining = Math.max(0, b.oooTotal - b.oooUsed)
                  return (
                    <div key={b.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 14, border: `1px solid ${CARD_BORDER}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: b.employee?.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#fff" }}>
                            {b.employee?.initials}
                          </div>
                          <span style={{ fontSize: 11, color: TEXT_PRIMARY, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{b.employee?.name}</span>
                        </div>
                        <button
                          onClick={() => { setEditingQuota(b); setQuotaForm({ vacationTotal: b.vacationTotal, sickTotal: b.sickTotal, oooTotal: b.oooTotal }) }}
                          style={{ background: "none", border: "none", color: TEXT_TERTIARY, fontSize: 10, cursor: "pointer", padding: "2px 6px" }}
                        >
                          {"\u270F\uFE0F"}
                        </button>
                      </div>
                      {/* Progress bars */}
                      {[
                        { label: "Vacation", used: b.vacationUsed, pending: b.vacationPending, total: b.vacationTotal, remaining: vacRemaining, color: GREEN },
                        { label: "Sick", used: b.sickUsed, pending: 0, total: b.sickTotal, remaining: sickRemaining, color: RED },
                        { label: "OOO", used: b.oooUsed, pending: 0, total: b.oooTotal, remaining: oooRemaining, color: INDIGO },
                      ].map((item) => (
                        <div key={item.label} style={{ marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 9, color: TEXT_TERTIARY }}>{item.label}</span>
                            <span style={{ fontSize: 9, color: TEXT_TERTIARY }}>{item.remaining}/{item.total}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 2, background: item.color,
                              width: `${item.total > 0 ? ((item.used + item.pending) / item.total) * 100 : 0}%`,
                              transition: "width 0.4s ease",
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ REQUEST LEAVE MODAL ══════════ */}
      {showRequestModal && (
        <RequestLeaveModal
          onClose={() => setShowRequestModal(false)}
          onSaved={() => {
            setShowRequestModal(false)
            fetchMyRequests()
            fetchBalance()
            if (me?.isAdmin) fetchAllRequests()
          }}
          balance={balance}
        />
      )}

      {/* ══════════ EDIT QUOTAS MODAL ══════════ */}
      {editingQuota && (
        <div
          onClick={() => setEditingQuota(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-slideUp"
            style={{ background: CARD_BG, borderRadius: 16, border: `1px solid ${CARD_BORDER}`, width: 360, padding: 24 }}
          >
            <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST, margin: "0 0 20px" }}>
              Edit Quotas - {editingQuota.employee?.name}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Vacation Days", key: "vacationTotal" as const, color: GREEN },
                { label: "Sick Days", key: "sickTotal" as const, color: RED },
                { label: "OOO Days", key: "oooTotal" as const, color: INDIGO },
              ].map((item) => (
                <div key={item.key}>
                  <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                    {item.label}
                  </label>
                  <input
                    className="oxen-input"
                    type="number"
                    value={quotaForm[item.key]}
                    onChange={(e) => setQuotaForm({ ...quotaForm, [item.key]: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", fontSize: 13 }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingQuota(null)} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>Cancel</button>
              <button onClick={handleSaveQuota} className="btn-primary" style={{ padding: "8px 16px", fontSize: 11 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════
   REQUEST LEAVE MODAL
   ══════════════════════════════════════════════ */

function RequestLeaveModal({ onClose, onSaved, balance }: { onClose: () => void; onSaved: () => void; balance: LeaveBalance | null }) {
  const [type, setType] = useState("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [halfDay, setHalfDay] = useState(false)
  const [halfDayPeriod, setHalfDayPeriod] = useState("morning")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const calculatedDays = startDate && endDate
    ? calculateBusinessDays(new Date(startDate), new Date(endDate), halfDay)
    : 0

  const remaining = balance
    ? type === "vacation" ? balance.vacationTotal - balance.vacationUsed - balance.vacationPending
    : type === "sick" ? balance.sickTotal - balance.sickUsed
    : balance.oooTotal - balance.oooUsed
    : 0

  const isOverLimit = calculatedDays > remaining

  const handleSubmit = async () => {
    if (!startDate || !endDate) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, startDate, endDate, halfDay, halfDayPeriod: halfDay ? halfDayPeriod : null, reason: reason || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to submit request")
        setSubmitting(false)
        return
      }
      onSaved()
    } catch {
      setError("Failed to submit request")
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slideUp"
        style={{ background: CARD_BG, borderRadius: 16, border: `1px solid ${CARD_BORDER}`, width: 440, maxHeight: "80vh", overflow: "auto" }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: FROST, margin: 0 }}>Request Leave</h3>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Type selector */}
          <div>
            <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
              Leave Type
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["vacation", "sick", "ooo"] as const).map((t) => {
                const lc = LEAVE_COLORS[t]
                const active = type === t
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 11, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                      background: active ? lc.bg : "rgba(255,255,255,0.02)",
                      border: active ? `1px solid ${lc.text}30` : `1px solid ${CARD_BORDER}`,
                      color: active ? lc.text : TEXT_TERTIARY,
                      transition: "all 0.15s",
                    }}
                  >
                    {LEAVE_LABELS[t]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date pickers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                Start Date
              </label>
              <input
                className="oxen-input"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
                style={{ width: "100%", fontSize: 12, colorScheme: "dark" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                End Date
              </label>
              <input
                className="oxen-input"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%", fontSize: 12, colorScheme: "dark" }}
              />
            </div>
          </div>

          {/* Half day toggle */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={halfDay}
                onChange={(e) => setHalfDay(e.target.checked)}
                style={{ accentColor: ROSE_GOLD }}
              />
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>Half day</span>
            </label>
            {halfDay && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, marginLeft: 24 }}>
                {(["morning", "afternoon"] as const).map((p) => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="radio"
                      checked={halfDayPeriod === p}
                      onChange={() => setHalfDayPeriod(p)}
                      style={{ accentColor: ROSE_GOLD }}
                    />
                    <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>{p}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Duration display */}
          {calculatedDays > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>Duration</span>
              <span style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST }}>
                {calculatedDays} day{calculatedDays !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Balance warning */}
          {isOverLimit && (
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "10px 14px" }}>
              <span style={{ fontSize: 11, color: AMBER, fontFamily: "'DM Sans', sans-serif" }}>
                {"\u26A0\uFE0F"} Insufficient balance. You have {remaining} {type} day{remaining !== 1 ? "s" : ""} remaining.
              </span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
              Reason (optional)
            </label>
            <textarea
              className="oxen-input"
              placeholder="Brief reason for your leave..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={{ width: "100%", fontSize: 12, resize: "vertical" }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 11, color: RED, fontFamily: "'DM Sans', sans-serif" }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 18px", fontSize: 11 }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!startDate || !endDate || submitting || isOverLimit}
            className="btn-primary"
            style={{ padding: "8px 18px", fontSize: 11, opacity: (!startDate || !endDate || submitting || isOverLimit) ? 0.5 : 1 }}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  )
}
