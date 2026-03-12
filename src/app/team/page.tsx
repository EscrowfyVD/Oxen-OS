"use client"

import { useEffect, useState, useMemo } from "react"
import PageHeader from "@/components/layout/PageHeader"

/* ── Design tokens ── */
const FROST = "#FFFFFF"
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const RED = "#F87171"
const AMBER = "#FBBF24"

/* ── Types ── */
interface Employee {
  id: string
  name: string
  initials: string
  role: string
  department: string
  location: string | null
  email: string | null
  phone: string | null
  telegram: string | null
  telegramChatId: string | null
  whatsapp: string | null
  timezone: string | null
  workHours: string | null
  entity: string | null
  country: string | null
  startDate: string | null
  bio: string | null
  avatarColor: string
  managerId: string | null
  order: number
  isActive: boolean
}

interface MemberForm {
  name: string
  role: string
  department: string
  entity: string
  location: string
  email: string
  phone: string
  telegram: string
  telegramChatId: string
  whatsapp: string
  timezone: string
  workHours: string
  country: string
  startDate: string
  bio: string
}

const emptyForm = (): MemberForm => ({
  name: "",
  role: "",
  department: "Operations",
  entity: "",
  location: "",
  email: "",
  phone: "",
  telegram: "",
  telegramChatId: "",
  whatsapp: "",
  timezone: "",
  workHours: "",
  country: "",
  startDate: "",
  bio: "",
})

const ENTITIES = ["All", "Oxen", "Escrowfy", "Galaktika", "Lapki"]
const DEPARTMENTS = ["All", "Management", "Sales", "Operations", "Compliance", "Tech", "Finance", "Support"]

const DEPT_OPTIONS = ["Management", "Sales", "Operations", "Compliance", "Tech", "Finance", "Support"]
const ENTITY_OPTIONS = ["Oxen", "Escrowfy", "Galaktika", "Lapki"]

/* ── Timezone offsets (hours from UTC) ── */
const TZ_OFFSETS: Record<string, number> = {
  GST: 4,
  CET: 1,
  CEST: 2,
  EET: 2,
  EEST: 3,
  EST: -5,
  EDT: -4,
  CST: -6,
  CDT: -5,
  MST: -7,
  MDT: -6,
  PST: -8,
  PDT: -7,
  GMT: 0,
  UTC: 0,
  IST: 5.5,
  JST: 9,
  AEST: 10,
  AEDT: 11,
  WET: 0,
  BST: 1,
}

const getInitials = (name: string): string =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

/* ── Availability check ── */
function isAvailable(timezone: string | null, workHours: string | null): boolean {
  if (!timezone || !workHours) return false

  const offset = TZ_OFFSETS[timezone.toUpperCase().trim()]
  if (offset === undefined) return false

  // Parse "09:00 - 18:00"
  const match = workHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
  if (!match) return false

  const startH = parseInt(match[1])
  const startM = parseInt(match[2])
  const endH = parseInt(match[3])
  const endM = parseInt(match[4])

  // Get current time in that timezone
  const now = new Date()
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60
  let localH = utcH + offset
  if (localH < 0) localH += 24
  if (localH >= 24) localH -= 24

  const startTime = startH + startM / 60
  const endTime = endH + endM / 60

  // Check if it's a weekday (Mon-Fri)
  const utcDay = now.getUTCDay()
  if (utcDay === 0 || utcDay === 6) return false

  return localH >= startTime && localH < endTime
}

function getCurrentTime(timezone: string | null): string {
  if (!timezone) return ""
  const offset = TZ_OFFSETS[timezone.toUpperCase().trim()]
  if (offset === undefined) return ""

  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  const localMs = utcMs + offset * 3600000
  const local = new Date(localMs)

  return local.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export default function TeamPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState("")
  const [entityFilter, setEntityFilter] = useState("All")
  const [deptFilter, setDeptFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [form, setForm] = useState<MemberForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [, setTick] = useState(0)

  const fetchEmployees = () => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  // Update availability every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      // Entity filter
      if (entityFilter !== "All" && (emp.entity ?? "") !== entityFilter) return false
      // Department filter
      if (deptFilter !== "All" && emp.department !== deptFilter) return false
      // Search
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          emp.name.toLowerCase().includes(q) ||
          emp.role.toLowerCase().includes(q) ||
          (emp.entity ?? "").toLowerCase().includes(q) ||
          emp.department.toLowerCase().includes(q) ||
          (emp.country ?? "").toLowerCase().includes(q) ||
          (emp.email ?? "").toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [employees, search, entityFilter, deptFilter])

  /* ── CRUD handlers ── */
  const openNew = () => {
    setEditingEmployee(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp)
    setForm({
      name: emp.name,
      role: emp.role,
      department: emp.department,
      entity: emp.entity ?? "",
      location: emp.location ?? "",
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      telegram: emp.telegram ?? "",
      telegramChatId: emp.telegramChatId ?? "",
      whatsapp: emp.whatsapp ?? "",
      timezone: emp.timezone ?? "",
      workHours: emp.workHours ?? "",
      country: emp.country ?? "",
      startDate: emp.startDate ? emp.startDate.substring(0, 10) : "",
      bio: emp.bio ?? "",
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.role.trim()) return
    setSaving(true)

    try {
      if (editingEmployee) {
        await fetch(`/api/employees/${editingEmployee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            initials: getInitials(form.name.trim()),
            role: form.role.trim(),
            department: form.department,
            entity: form.entity || null,
            location: form.location || null,
            email: form.email || null,
            phone: form.phone || null,
            telegram: form.telegram || null,
            telegramChatId: form.telegramChatId || null,
            whatsapp: form.whatsapp || null,
            timezone: form.timezone || null,
            workHours: form.workHours || null,
            country: form.country || null,
            startDate: form.startDate || null,
            bio: form.bio.trim() || null,
          }),
        })
      } else {
        await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            initials: getInitials(form.name.trim()),
            role: form.role.trim(),
            department: form.department,
            entity: form.entity || null,
            location: form.location || null,
            email: form.email || null,
            phone: form.phone || null,
            telegram: form.telegram || null,
            telegramChatId: form.telegramChatId || null,
            whatsapp: form.whatsapp || null,
            timezone: form.timezone || null,
            workHours: form.workHours || null,
            country: form.country || null,
            startDate: form.startDate || null,
            bio: form.bio.trim() || null,
            avatarColor: "rgba(192,139,136,0.4)",
          }),
        })
      }
      setShowModal(false)
      fetchEmployees()
    } catch {
      /* silent */
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingEmployee) return
    setSaving(true)
    try {
      await fetch(`/api/employees/${editingEmployee.id}`, { method: "DELETE" })
      setShowModal(false)
      fetchEmployees()
    } catch {
      /* silent */
    } finally {
      setSaving(false)
    }
  }

  /* ── Tenure calc ── */
  const getTenure = (startDate: string | null): string => {
    if (!startDate) return ""
    const start = new Date(startDate)
    const now = new Date()
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    if (months < 1) return "< 1 month"
    if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`
    const years = Math.floor(months / 12)
    const rem = months % 12
    return rem > 0 ? `${years}y ${rem}m` : `${years} year${years !== 1 ? "s" : ""}`
  }

  return (
    <div className="page-content" style={{ padding: 0 }}>
      <PageHeader
        title="Team"
        description={`Internal directory — ${employees.length} member${employees.length !== 1 ? "s" : ""}`}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: "rgba(255,255,255,0.04)",
                color: TEXT_PRIMARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                width: 180,
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(192,139,136,0.25)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = CARD_BORDER
              }}
            />
            <button className="header-btn" onClick={openNew}>
              + Add Member
            </button>
          </div>
        }
      />

      <div style={{ padding: "0 32px 20px" }}>
        {/* ── Filter Buttons ── */}
        <div className="fade-in" style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 20, animationDelay: "0.05s" }}>
          {/* Entity filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginRight: 4 }}>
              Entity
            </span>
            {ENTITIES.map((e) => (
              <button
                key={e}
                onClick={() => setEntityFilter(e)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: `1px solid ${entityFilter === e ? "rgba(192,139,136,0.4)" : CARD_BORDER}`,
                  background: entityFilter === e ? "rgba(192,139,136,0.1)" : "transparent",
                  color: entityFilter === e ? ROSE_GOLD : TEXT_SECONDARY,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Department filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginRight: 4 }}>
              Dept
            </span>
            {DEPARTMENTS.map((d) => (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: `1px solid ${deptFilter === d ? "rgba(192,139,136,0.4)" : CARD_BORDER}`,
                  background: deptFilter === d ? "rgba(192,139,136,0.1)" : "transparent",
                  color: deptFilter === d ? ROSE_GOLD : TEXT_SECONDARY,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* ── Member Cards ── */}
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 8, animationDelay: "0.1s" }}>
          {filtered.map((emp) => {
            const available = isAvailable(emp.timezone, emp.workHours)
            const currentTime = getCurrentTime(emp.timezone)

            return (
              <div
                key={emp.id}
                onClick={() => openEdit(emp)}
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 12,
                  transition: "all 0.25s ease",
                  position: "relative",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const row = e.currentTarget
                  row.style.borderColor = "rgba(192,139,136,0.15)"
                  const actions = row.querySelector("[data-row-actions]") as HTMLElement | null
                  if (actions) actions.style.opacity = "1"
                }}
                onMouseLeave={(e) => {
                  const row = e.currentTarget
                  row.style.borderColor = CARD_BORDER
                  const actions = row.querySelector("[data-row-actions]") as HTMLElement | null
                  if (actions) actions.style.opacity = "0"
                }}
              >
                {/* Bottom gradient line */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    background: "linear-gradient(90deg, transparent 0%, rgba(192,139,136,0.15) 50%, transparent 100%)",
                  }}
                />

                {/* Avatar + availability dot */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #C08B88, #8B6B68)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Bellfair', serif",
                        fontSize: 14,
                        color: FROST,
                        fontWeight: 400,
                        lineHeight: 1,
                      }}
                    >
                      {emp.initials || getInitials(emp.name)}
                    </span>
                  </div>
                  {/* Availability dot */}
                  {emp.timezone && emp.workHours && (
                    <div
                      title={available ? "Currently available" : "Outside working hours"}
                      style={{
                        position: "absolute",
                        bottom: -1,
                        right: -1,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: available ? GREEN : "rgba(255,255,255,0.15)",
                        border: `2px solid ${CARD_BG}`,
                        boxShadow: available ? `0 0 6px ${GREEN}40` : "none",
                      }}
                    />
                  )}
                </div>

                {/* Name + Role */}
                <div style={{ minWidth: 0, flex: "0 0 180px" }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: TEXT_PRIMARY,
                      fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif",
                      lineHeight: 1.3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {emp.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: TEXT_TERTIARY,
                      fontFamily: "'DM Sans', sans-serif",
                      lineHeight: 1.3,
                      marginTop: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {emp.role}
                  </div>
                </div>

                {/* Entity badge */}
                {emp.entity && (
                  <div
                    style={{
                      fontSize: 9,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: "rgba(192,139,136,0.1)",
                      color: ROSE_GOLD,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                      letterSpacing: 0.3,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {emp.entity}
                  </div>
                )}

                {/* Contact icons */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 10,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {emp.email && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(`mailto:${emp.email}`)
                      }}
                      title={emp.email}
                      style={{
                        fontSize: 13,
                        color: TEXT_SECONDARY,
                        cursor: "pointer",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = ROSE_GOLD }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_SECONDARY }}
                    >
                      {"\u2709"}
                    </span>
                  )}
                  {emp.phone && (
                    <span
                      title={emp.phone}
                      style={{ fontSize: 13, color: TEXT_SECONDARY }}
                    >
                      {"\u260E"}
                    </span>
                  )}
                  {emp.telegram && (
                    <span
                      title={emp.telegram}
                      style={{ fontSize: 13, color: TEXT_SECONDARY }}
                    >
                      {"\u2708"}
                    </span>
                  )}
                  {emp.whatsapp && (
                    <span
                      title={emp.whatsapp}
                      style={{ fontSize: 13, color: TEXT_SECONDARY }}
                    >
                      {"\u25C6"}
                    </span>
                  )}
                </div>

                {/* Country + Tenure */}
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
                  {emp.country && (
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {emp.country}
                    </div>
                  )}
                  {emp.startDate && (
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 1 }}>
                      {getTenure(emp.startDate)}
                    </div>
                  )}
                </div>

                {/* Timezone + hours + local time */}
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 90 }}>
                  {emp.timezone && (
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {emp.timezone} {currentTime && <span style={{ color: available ? GREEN : TEXT_TERTIARY }}>({currentTime})</span>}
                    </div>
                  )}
                  {emp.workHours && (
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 1 }}>
                      {emp.workHours}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div
                  data-row-actions=""
                  style={{
                    display: "flex",
                    gap: 6,
                    opacity: 0,
                    transition: "opacity 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(emp)
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${CARD_BORDER}`,
                      background: "rgba(255,255,255,0.04)",
                      color: TEXT_SECONDARY,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(192,139,136,0.4)"
                      e.currentTarget.style.color = ROSE_GOLD
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = CARD_BORDER
                      e.currentTarget.style.color = TEXT_SECONDARY
                    }}
                    title="Edit member"
                  >
                    {"\u270E"}
                  </button>
                </div>
              </div>
            )
          })}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 12 }}>{"\u2687"}</div>
              <div style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                {search.trim() || entityFilter !== "All" || deptFilter !== "All"
                  ? "No team members match your filters"
                  : "No team members yet"}
              </div>
              <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
                {search.trim() || entityFilter !== "All" || deptFilter !== "All"
                  ? "Try adjusting your filters"
                  : "Click + Add Member to get started"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div
            className="animate-slideUp"
            style={{
              width: 560,
              maxHeight: "85vh",
              overflowY: "auto",
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                position: "sticky",
                top: 0,
                background: CARD_BG,
                zIndex: 1,
              }}
            >
              <span style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST }}>
                {editingEmployee ? "Edit Member" : "New Member"}
              </span>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: TEXT_TERTIARY,
                  fontSize: 18,
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Row 1: Name, Role */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name *</label>
                  <input
                    className="oxen-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Full name"
                    autoFocus
                  />
                </div>
                <div>
                  <label style={labelStyle}>Role *</label>
                  <input
                    className="oxen-input"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Job title"
                  />
                </div>
              </div>

              {/* Row 2: Department, Entity */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Department</label>
                  <select
                    className="oxen-input"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    style={{ appearance: "none" }}
                  >
                    {DEPT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Entity</label>
                  <select
                    className="oxen-input"
                    value={form.entity}
                    onChange={(e) => setForm({ ...form, entity: e.target.value })}
                    style={{ appearance: "none" }}
                  >
                    <option value="">None</option>
                    {ENTITY_OPTIONS.map((ent) => (
                      <option key={ent} value={ent}>{ent}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Location, Country */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Location</label>
                  <input
                    className="oxen-input"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="City, Country"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <input
                    className="oxen-input"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="UAE"
                  />
                </div>
              </div>

              {/* Row 4: Email, Phone */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    className="oxen-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                    type="email"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input
                    className="oxen-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+971 50 123 4567"
                  />
                </div>
              </div>

              {/* Row 5: Telegram, WhatsApp */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Telegram</label>
                  <input
                    className="oxen-input"
                    value={form.telegram}
                    onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                    placeholder="@username"
                  />
                </div>
                <div>
                  <label style={labelStyle}>WhatsApp</label>
                  <input
                    className="oxen-input"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="+971 50 123 4567"
                  />
                </div>
              </div>

              {/* Row 5b: Telegram Chat ID */}
              <div>
                <label style={labelStyle}>Telegram Chat ID</label>
                <input
                  className="oxen-input"
                  value={form.telegramChatId}
                  onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                  placeholder="Numeric chat ID"
                />
                <span style={{ fontSize: 9, color: TEXT_TERTIARY, marginTop: 2, display: "block" }}>
                  Send /start to @Oxen_deal_info_bot on Telegram to get your ID
                </span>
              </div>

              {/* Row 6: Timezone, Working Hours */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Timezone</label>
                  <input
                    className="oxen-input"
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    placeholder="CET / GST / EST"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Working Hours</label>
                  <input
                    className="oxen-input"
                    value={form.workHours}
                    onChange={(e) => setForm({ ...form, workHours: e.target.value })}
                    placeholder="09:00 - 18:00"
                  />
                </div>
              </div>

              {/* Row 7: Start Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input
                    className="oxen-input"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div />
              </div>

              {/* Row 8: Bio */}
              <div>
                <label style={labelStyle}>Bio</label>
                <textarea
                  className="oxen-input"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Short bio..."
                  rows={3}
                  style={{ resize: "vertical", minHeight: 60, fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px 20px",
              }}
            >
              <div>
                {editingEmployee && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    style={{
                      background: "rgba(248,113,113,0.08)",
                      border: "1px solid rgba(248,113,113,0.2)",
                      color: RED,
                      fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                      padding: "8px 16px",
                      borderRadius: 6,
                      cursor: saving ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.15)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.08)" }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-secondary" onClick={() => setShowModal(false)} style={{ padding: "8px 18px" }}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!form.name.trim() || !form.role.trim() || saving}
                  style={{ padding: "8px 18px" }}
                >
                  {saving ? "Saving..." : editingEmployee ? "Save Changes" : "Add Member"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "rgba(240,240,242,0.3)",
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 4,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
}
