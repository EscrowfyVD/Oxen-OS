"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  ArrowLeft, Edit2, ExternalLink, Plus, X, Loader2, Copy, Trash2,
  Star, Users, FileText, BarChart3, DollarSign, ClipboardList,
} from "lucide-react"

/* ── Design tokens ── */
const VOID = "var(--void)"
const CARD_BG = "var(--card-bg-solid)"
const CARD_BORDER = "var(--card-border)"
const TEXT_PRIMARY = "var(--text-primary)"
const TEXT_SECONDARY = "var(--text-secondary)"
const TEXT_TERTIARY = "var(--text-tertiary)"
const ROSE_GOLD = "#C08B88"
const ROSE_GOLD_HOVER = "#D4A5A2"

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  planned: { bg: "rgba(59,130,246,0.15)", text: "#3B82F6" },
  ongoing: { bg: "rgba(34,197,94,0.15)", text: "#22C55E" },
  completed: { bg: "rgba(156,163,175,0.15)", text: "#9CA3AF" },
  cancelled: { bg: "rgba(239,68,68,0.15)", text: "#EF4444" },
  suggested: { bg: "rgba(245,158,11,0.15)", text: "#F59E0B" },
  rejected: { bg: "rgba(239,68,68,0.10)", text: "#F87171" },
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  Speaker: { bg: "rgba(168,85,247,0.15)", text: "#A855F7" },
  Attendee: { bg: "rgba(59,130,246,0.15)", text: "#3B82F6" },
  Booth: { bg: "rgba(34,197,94,0.15)", text: "#22C55E" },
  Networking: { bg: "rgba(245,158,11,0.15)", text: "#F59E0B" },
}

const INTEREST_OPTIONS = [
  { value: "hot", label: "Hot", emoji: "🔥" },
  { value: "warm", label: "Warm", emoji: "🟡" },
  { value: "cold", label: "Cold", emoji: "🔵" },
]

const FOLLOWUP_OPTIONS = [
  { value: "none", label: "None" },
  { value: "send_proposal", label: "Send Proposal" },
  { value: "schedule_call", label: "Schedule Call" },
  { value: "add_to_sequence", label: "Add to Sequence" },
]

const CONF_COLORS = [
  "#C08B88", "#818CF8", "#5CB868", "#E5C453",
  "#5BB8A8", "#9B7FD4", "#5B9BBF", "#D4885B",
]

const TAB_LIST = [
  { key: "overview", label: "Overview", icon: <ClipboardList size={15} /> },
  { key: "budget", label: "Budget", icon: <DollarSign size={15} /> },
  { key: "contacts", label: "Contacts", icon: <Users size={15} /> },
  { key: "documents", label: "Documents", icon: <FileText size={15} /> },
  { key: "report", label: "Report", icon: <Star size={15} /> },
  { key: "roi", label: "ROI", icon: <BarChart3 size={15} /> },
]

type Conference = {
  id: string
  name: string
  location: string | null
  startDate: string | null
  endDate: string | null
  website: string | null
  description: string | null
  source: string | null
  status: string
  color: string | null
  currency: string
  attendees: Attendee[]
  contacts: Contact[]
  documents: Doc[]
  report: Report | null
}

type Attendee = {
  id: string
  employeeId: string
  employeeName?: string
  role: string
  employee?: { id: string; name: string }
  ticketCost?: number
  hotelCost?: number
  flightCost?: number
  taxiCost?: number
  mealsCost?: number
  otherCost?: number
  budgetNotes?: string | null
}

type Contact = {
  id: string
  name: string
  company: string | null
  roleTitle: string | null
  email: string | null
  phone: string | null
  linkedin: string | null
  telegram: string | null
  notes: string | null
  interestLevel: string | null
  followUp: string | null
  pushedToCrm: boolean
}

type Doc = {
  id: string
  name: string
  link: string
  type: string | null
}

type Report = {
  id: string
  summary: string
  keyTakeaways: { title: string; detail: string }[]
  marketInsights: string | null
  competitorSightings: string | null
  opportunities: string | null
  recommendations: string | null
  rating: number
  wikiPageId: string | null
}

type ROIData = {
  totalCost: number
  contactsCollected: number
  leadsInCrm: number
  dealsCreated: number
  pipelineValue: number
  wonRevenue: number
  roiPercent: number | null
}

type Employee = { id: string; name: string }

/* ── Helpers ── */
function formatDate(d: string | null) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "Dates TBD"
  const s = formatDate(start)
  if (!end) return s
  return `${s} - ${formatDate(end)}`
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

function avatarColor(name: string) {
  const colors = ["#C08B88", "#818CF8", "#22C55E", "#F59E0B", "#A855F7", "#3B82F6", "#EF4444", "#5BB8A8"]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

/* ── Shared styles ── */
const cardStyle: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 10,
  padding: 20,
}

const btnPrimary: React.CSSProperties = {
  background: ROSE_GOLD,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
  fontWeight: 500,
}

const btnGhost: React.CSSProperties = {
  background: "var(--surface-hover)",
  color: TEXT_SECONDARY,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 6,
  padding: "8px 14px",
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer",
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface-input)",
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
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 28,
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  resize: "vertical" as const,
}

/* ═══════════════════════════════════════════ */
export default function ConferenceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [conf, setConf] = useState<Conference | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [roi, setRoi] = useState<ROIData | null>(null)
  const [roiLoading, setRoiLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const deleteConference = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/conferences/${id}`, { method: "DELETE" })
      if (res.ok) router.push("/conferences")
    } catch { /* ignore */ } finally { setDeleting(false) }
  }

  /* ── Fetch conference ── */
  const fetchConference = useCallback(async () => {
    try {
      const res = await fetch(`/api/conferences/${id}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setConf(data.conference ?? data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchConference() }, [fetchConference])

  /* ── Fetch employees for attendee dropdown ── */
  useEffect(() => {
    fetch("/api/employees").then(r => r.json()).then(data => setEmployees(data.employees ?? [])).catch(() => {})
  }, [])

  /* ── Fetch ROI when tab switches ── */
  useEffect(() => {
    if (activeTab === "roi" && conf?.status === "completed" && !roi) {
      setRoiLoading(true)
      fetch(`/api/conferences/${id}/roi`)
        .then(r => r.json())
        .then(setRoi)
        .catch(() => {})
        .finally(() => setRoiLoading(false))
    }
  }, [activeTab, conf?.status, id, roi])

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: VOID }}>
        <Loader2 size={28} color={ROSE_GOLD} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!conf) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: VOID, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
        <p style={{ fontSize: 16, marginBottom: 12 }}>Conference not found</p>
        <button style={btnGhost} onClick={() => router.push("/conferences")}>Back to Conferences</button>
      </div>
    )
  }

  const statusColor = STATUS_COLORS[conf.status] || STATUS_COLORS.planned
  const accentColor = conf.color || ROSE_GOLD

  return (
    <div style={{ background: VOID, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Header ── */}
      <div style={{
        padding: "16px 32px",
        background: "var(--header-bg)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: `1px solid ${CARD_BORDER}`,
        borderTop: `3px solid ${accentColor}`,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => router.push("/conferences")}
              style={{ background: "none", border: "none", color: TEXT_SECONDARY, cursor: "pointer", padding: 4, display: "flex" }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 32, fontWeight: 400, color: TEXT_PRIMARY, margin: 0, lineHeight: 1.2 }}>
                  {conf.name}
                </h1>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20,
                  background: statusColor.bg, color: statusColor.text, textTransform: "capitalize",
                }}>
                  {conf.status}
                </span>
              </div>
              <p style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 4, lineHeight: 1.4 }}>
                {conf.location && `${conf.location}  ·  `}{formatDateRange(conf.startDate, conf.endDate)}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6 }}
              onClick={async () => {
                if (!confirm("Duplicate this conference? All details except dates will be copied.")) return
                try {
                  const res = await fetch("/api/conferences", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: `${conf.name} (Copy)`,
                      location: conf.location,
                      website: conf.website,
                      description: conf.description,
                      source: conf.source,
                      status: "planned",
                    }),
                  })
                  if (!res.ok) throw new Error("Failed to duplicate")
                  const data = await res.json()
                  const newId = data.conference?.id ?? data.id
                  if (newId) router.push(`/conferences/${newId}`)
                } catch { /* ignore */ }
              }}
            >
              <Copy size={14} /> Duplicate
            </button>
            <button
              style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setShowEditModal(true)}
            >
              <Edit2 size={14} /> Edit
            </button>
            <button
              style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6, color: "#EF4444", borderColor: "rgba(239,68,68,0.25)" }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 2, marginTop: 16 }}>
          {TAB_LIST.filter(t => t.key !== "roi" || conf.status === "completed").map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: activeTab === tab.key ? "var(--card-border)" : "transparent",
                border: "none",
                borderBottom: activeTab === tab.key ? `2px solid ${accentColor}` : "2px solid transparent",
                color: activeTab === tab.key ? TEXT_PRIMARY : TEXT_TERTIARY,
                padding: "8px 16px",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderRadius: "6px 6px 0 0",
                transition: "all 0.15s ease",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
        {activeTab === "overview" && <OverviewTab conf={conf} employees={employees} onUpdate={fetchConference} />}
        {activeTab === "budget" && <BudgetTab conf={conf} onUpdate={fetchConference} />}
        {activeTab === "contacts" && <ContactsTab conf={conf} onUpdate={fetchConference} />}
        {activeTab === "documents" && <DocumentsTab conf={conf} />}
        {activeTab === "report" && <ReportTab conf={conf} onUpdate={fetchConference} />}
        {activeTab === "roi" && <ROITab roi={roi} loading={roiLoading} />}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && conf && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, width: "100%", maxWidth: 440, padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 20, fontWeight: 400, color: TEXT_PRIMARY, margin: "0 0 12px" }}>
              Delete Conference
            </h3>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6, margin: "0 0 24px" }}>
              Delete <strong style={{ color: TEXT_PRIMARY }}>{conf.name}</strong> and all associated data?
              This includes attendees, contacts, reports, and linked calendar events.
              <br /><br />
              <span style={{ color: "#EF4444", fontWeight: 500 }}>This cannot be undone.</span>
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={btnGhost}>Cancel</button>
              <button
                onClick={deleteConference}
                disabled={deleting}
                style={{
                  background: "#EF4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 20px",
                  fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: deleting ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  opacity: deleting ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete Conference"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && conf && (
        <EditConferenceModal
          conf={conf}
          employees={employees}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => { setShowEditModal(false); fetchConference() }}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   EDIT CONFERENCE MODAL
   ═══════════════════════════════════════════ */
function EditConferenceModal({
  conf,
  employees,
  onClose,
  onSuccess,
}: {
  conf: Conference
  employees: Employee[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(conf.name)
  const [location, setLocation] = useState(conf.location || "")
  const [startDate, setStartDate] = useState(conf.startDate ? new Date(conf.startDate).toISOString().split("T")[0] : "")
  const [endDate, setEndDate] = useState(conf.endDate ? new Date(conf.endDate).toISOString().split("T")[0] : "")
  const [website, setWebsite] = useState(conf.website || "")
  const [description, setDescription] = useState(conf.description || "")
  const [status, setStatus] = useState(conf.status || "planned")
  const [selectedColor, setSelectedColor] = useState(conf.color || CONF_COLORS[0])
  const [saving, setSaving] = useState(false)

  // Attendee management
  const currentAttendees = conf.attendees || []
  const [attendeeIds, setAttendeeIds] = useState<Set<string>>(
    new Set(currentAttendees.map((a) => a.employeeId))
  )
  const [attendeeRoles, setAttendeeRoles] = useState<Record<string, string>>(
    Object.fromEntries(currentAttendees.map((a) => [a.employeeId, a.role || "Attendee"]))
  )

  const toggleAttendee = (empId: string) => {
    setAttendeeIds((prev) => {
      const next = new Set(prev)
      if (next.has(empId)) next.delete(empId)
      else { next.add(empId); setAttendeeRoles((r) => ({ ...r, [empId]: r[empId] || "Attendee" })) }
      return next
    })
  }

  const handleSave = async () => {
    if (!name || !startDate || !endDate) return
    setSaving(true)
    try {
      const attendees = Array.from(attendeeIds).map((empId) => ({
        employeeId: empId,
        role: attendeeRoles[empId] || "Attendee",
      }))

      const body: Record<string, unknown> = {
        name,
        location,
        startDate,
        endDate,
        website: website || null,
        description: description || null,
        status,
        color: selectedColor,
        attendees,
      }

      const res = await fetch(`/api/conferences/${conf.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) onSuccess()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const STATUSES = ["suggested", "planned", "ongoing", "completed", "cancelled", "rejected"]
  const ROLES = ["Speaker", "Attendee", "Booth", "Networking"]

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}`, background: "rgba(192,139,136,0.03)", position: "sticky", top: 0, zIndex: 10 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, fontWeight: 400, color: TEXT_PRIMARY, margin: 0 }}>Edit Conference</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, fontSize: 18, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>

          {/* Location + Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...selectStyle }}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Start Date *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>End Date *</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
          </div>

          {/* Website */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Website</label>
            <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." style={inputStyle} />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...textareaStyle }} />
          </div>

          {/* Color Picker */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Color</label>
            <div style={{ display: "flex", gap: 8 }}>
              {CONF_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: c,
                    border: selectedColor === c ? "3px solid #fff" : "3px solid transparent",
                    cursor: "pointer",
                    outline: selectedColor === c ? `2px solid ${c}` : "none",
                    outlineOffset: 1,
                    transition: "all 0.15s ease",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Attendees</label>
            <div style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: 12, maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {employees.length === 0 && (
                <span style={{ fontSize: 12, color: TEXT_TERTIARY }}>No team members loaded.</span>
              )}
              {employees.map((emp) => {
                const checked = attendeeIds.has(emp.id)
                return (
                  <div key={emp.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleAttendee(emp.id)} style={{ accentColor: ROSE_GOLD }} />
                      <span style={{ fontSize: 13, color: TEXT_PRIMARY }}>{emp.name}</span>
                    </label>
                    {checked && (
                      <select
                        value={attendeeRoles[emp.id] || "Attendee"}
                        onChange={(e) => setAttendeeRoles((r) => ({ ...r, [emp.id]: e.target.value }))}
                        style={{ ...selectStyle, width: 130, padding: "4px 8px", fontSize: 12 }}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, paddingTop: 16, borderTop: `1px solid ${CARD_BORDER}` }}>
            <button onClick={onClose} style={btnGhost}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={!name || !startDate || !endDate || saving}
              style={{
                ...btnPrimary,
                opacity: (!name || !startDate || !endDate || saving) ? 0.5 : 1,
                cursor: (!name || !startDate || !endDate || saving) ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════ */
function OverviewTab({ conf, employees, onUpdate }: { conf: Conference; employees: Employee[]; onUpdate: () => void }) {
  const [showAddAttendee, setShowAddAttendee] = useState(false)
  const [newEmployeeId, setNewEmployeeId] = useState("")
  const [newRole, setNewRole] = useState("Attendee")
  const [saving, setSaving] = useState(false)

  const addAttendee = async () => {
    if (!newEmployeeId) return
    setSaving(true)
    try {
      await fetch(`/api/conferences/${conf.id}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: newEmployeeId, role: newRole }),
      })
      setShowAddAttendee(false)
      setNewEmployeeId("")
      setNewRole("Attendee")
      onUpdate()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const removeAttendee = async (attendeeId: string) => {
    await fetch(`/api/conferences/${conf.id}/attendees/${attendeeId}`, { method: "DELETE" })
    onUpdate()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Conference Info */}
      <div style={cardStyle}>
        <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: "0 0 16px" }}>Conference Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 32px" }}>
          <div>
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5 }}>Name</span>
            <p style={{ fontSize: 14, color: TEXT_PRIMARY, margin: "4px 0 0" }}>{conf.name}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5 }}>Location</span>
            <p style={{ fontSize: 14, color: TEXT_PRIMARY, margin: "4px 0 0" }}>{conf.location || "TBD"}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5 }}>Dates</span>
            <p style={{ fontSize: 14, color: TEXT_PRIMARY, margin: "4px 0 0" }}>{formatDateRange(conf.startDate, conf.endDate)}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5 }}>Source</span>
            <p style={{ fontSize: 14, color: TEXT_SECONDARY, margin: "4px 0 0" }}>{conf.source || "Manual"}</p>
          </div>
          {conf.website && (
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5 }}>Website</span>
              <p style={{ margin: "4px 0 0" }}>
                <a href={conf.website} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 14, color: ROSE_GOLD, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {conf.website} <ExternalLink size={12} />
                </a>
              </p>
            </div>
          )}
          {conf.description && (
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5 }}>Description</span>
              <p style={{ fontSize: 14, color: TEXT_SECONDARY, margin: "4px 0 0", lineHeight: 1.6 }}>{conf.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Attendees */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: 0 }}>
            Attendees ({conf.attendees?.length || 0})
          </h3>
          <button style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }} onClick={() => setShowAddAttendee(!showAddAttendee)}>
            <Plus size={14} /> Add Attendee
          </button>
        </div>

        {showAddAttendee && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", padding: 12, background: "var(--surface-subtle)", borderRadius: 8 }}>
            <select style={{ ...selectStyle, flex: 1 }} value={newEmployeeId} onChange={e => setNewEmployeeId(e.target.value)}>
              <option value="">Select employee...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select style={{ ...selectStyle, width: 140 }} value={newRole} onChange={e => setNewRole(e.target.value)}>
              {["Attendee", "Speaker", "Booth", "Networking"].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button style={{ ...btnPrimary, whiteSpace: "nowrap" }} onClick={addAttendee} disabled={saving}>
              {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : "Add"}
            </button>
            <button style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer" }} onClick={() => setShowAddAttendee(false)}>
              <X size={16} />
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(!conf.attendees || conf.attendees.length === 0) && (
            <p style={{ fontSize: 13, color: TEXT_TERTIARY, textAlign: "center", padding: 20 }}>No attendees yet</p>
          )}
          {conf.attendees?.map(att => {
            const roleColor = ROLE_COLORS[att.role] || ROLE_COLORS.Attendee
            return (
              <div key={att.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 8, background: "var(--surface-subtle)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", background: avatarColor(att.employee?.name || att.employeeName || ""),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600, color: "#fff",
                  }}>
                    {initials(att.employee?.name || att.employeeName || "")}
                  </div>
                  <span style={{ fontSize: 14, color: TEXT_PRIMARY }}>{att.employee?.name || att.employeeName}</span>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 12,
                    background: roleColor.bg, color: roleColor.text,
                  }}>
                    {att.role}
                  </span>
                </div>
                <button
                  onClick={() => removeAttendee(att.id)}
                  style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", padding: 4 }}
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   BUDGET TAB
   ═══════════════════════════════════════════ */
function BudgetTab({ conf, onUpdate }: { conf: Conference; onUpdate: () => void }) {
  type CostField = "ticketCost" | "hotelCost" | "flightCost" | "taxiCost" | "mealsCost" | "otherCost"
  const FIELDS: { key: CostField; label: string; emoji: string }[] = [
    { key: "ticketCost", label: "Tickets", emoji: "🎫" },
    { key: "hotelCost", label: "Hotel", emoji: "🏨" },
    { key: "flightCost", label: "Flights", emoji: "✈️" },
    { key: "taxiCost", label: "Taxi", emoji: "🚕" },
    { key: "mealsCost", label: "Meals", emoji: "🍽" },
    { key: "otherCost", label: "Other", emoji: "📦" },
  ]

  const attendees = conf.attendees || []
  const currency = conf.currency || "EUR"
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : currency

  // Local editable state: map of attendeeId -> { field -> value }
  const [budgets, setBudgets] = useState<Record<string, Record<CostField, number>>>(() => {
    const m: Record<string, Record<CostField, number>> = {}
    attendees.forEach(a => {
      m[a.id] = {
        ticketCost: a.ticketCost ?? 0,
        hotelCost: a.hotelCost ?? 0,
        flightCost: a.flightCost ?? 0,
        taxiCost: a.taxiCost ?? 0,
        mealsCost: a.mealsCost ?? 0,
        otherCost: a.otherCost ?? 0,
      }
    })
    return m
  })

  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [applyAllField, setApplyAllField] = useState<CostField | null>(null)
  const [applyAllValue, setApplyAllValue] = useState("")
  const [copyFrom, setCopyFrom] = useState("")

  // Column totals
  const colTotal = (key: CostField) => attendees.reduce((s, a) => s + (budgets[a.id]?.[key] ?? 0), 0)
  const rowTotal = (id: string) => FIELDS.reduce((s, f) => s + (budgets[id]?.[f.key] ?? 0), 0)
  const grandTotal = FIELDS.reduce((s, f) => s + colTotal(f.key), 0)
  const avg = attendees.length > 0 ? Math.round(grandTotal / attendees.length) : 0

  const saveCell = async (attendeeId: string, field: CostField, value: number) => {
    setBudgets(prev => ({
      ...prev,
      [attendeeId]: { ...prev[attendeeId], [field]: value },
    }))
    await fetch(`/api/conferences/${conf.id}/attendees/${attendeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    })
  }

  const applyToAll = async (field: CostField, value: number) => {
    setSaving(true)
    const updates = attendees.map(a => ({ attendeeId: a.id, [field]: value }))
    await fetch(`/api/conferences/${conf.id}/attendees`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    })
    setBudgets(prev => {
      const next = { ...prev }
      attendees.forEach(a => { next[a.id] = { ...next[a.id], [field]: value } })
      return next
    })
    setApplyAllField(null)
    setApplyAllValue("")
    setSaving(false)
  }

  const copyBudget = async (fromId: string, toId: string) => {
    const src = budgets[fromId]
    if (!src) return
    setSaving(true)
    await fetch(`/api/conferences/${conf.id}/attendees/${toId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(src),
    })
    setBudgets(prev => ({ ...prev, [toId]: { ...src } }))
    setSaving(false)
  }

  const getName = (a: Attendee) => a.employee?.name || a.employeeName || "Unknown"

  if (attendees.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}>
        <p style={{ fontSize: 14, color: TEXT_SECONDARY, margin: 0 }}>
          No attendees yet. Add attendees in the Overview tab to set per-person budgets.
        </p>
      </div>
    )
  }

  const thStyle: React.CSSProperties = {
    padding: "10px 12px", fontSize: 11, fontWeight: 600, color: TEXT_TERTIARY,
    textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right",
    borderBottom: `1px solid ${CARD_BORDER}`, whiteSpace: "nowrap",
  }

  const tdStyle: React.CSSProperties = {
    padding: "8px 12px", fontSize: 13, color: TEXT_PRIMARY,
    borderBottom: `1px solid ${CARD_BORDER}`, textAlign: "right",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {FIELDS.map(f => (
          <div key={f.key} style={cardStyle}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{f.emoji}</div>
            <div style={{ fontSize: 11, color: TEXT_TERTIARY, marginBottom: 4, textTransform: "uppercase" }}>Total {f.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>{sym}{colTotal(f.key).toLocaleString()}</div>
          </div>
        ))}
        <div style={{ ...cardStyle, borderColor: ROSE_GOLD, borderWidth: 1 }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>💰</div>
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, marginBottom: 4, textTransform: "uppercase" }}>GRAND TOTAL</div>
          <div style={{ fontFamily: "'Bellfair', serif", fontSize: 32, color: ROSE_GOLD, fontWeight: 400 }}>{sym}{grandTotal.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, marginTop: 4 }}>{sym}{avg.toLocaleString()} per person avg</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontWeight: 600 }}>Quick actions:</span>
        {applyAllField ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: TEXT_PRIMARY }}>{FIELDS.find(f => f.key === applyAllField)?.emoji} Apply {sym}</span>
            <input
              autoFocus
              type="number"
              value={applyAllValue}
              onChange={e => setApplyAllValue(e.target.value)}
              style={{ ...inputStyle, width: 100, padding: "4px 8px", fontSize: 13 }}
              onKeyDown={e => { if (e.key === "Enter") applyToAll(applyAllField, Number(applyAllValue) || 0) }}
            />
            <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>to all attendees</span>
            <button
              style={{ ...btnPrimary, padding: "4px 12px", fontSize: 12 }}
              onClick={() => applyToAll(applyAllField, Number(applyAllValue) || 0)}
              disabled={saving}
            >Apply</button>
            <button style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", fontSize: 12 }} onClick={() => setApplyAllField(null)}>Cancel</button>
          </div>
        ) : (
          FIELDS.map(f => (
            <button
              key={f.key}
              style={{ ...btnGhost, padding: "4px 10px", fontSize: 11 }}
              onClick={() => setApplyAllField(f.key)}
            >{f.emoji} Same {f.label} for all</button>
          ))
        )}
      </div>

      {/* Per-Attendee Budget Table */}
      <div style={{ ...cardStyle, padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", width: 180 }}>Attendee</th>
              {FIELDS.map(f => (
                <th key={f.key} style={thStyle}>{f.emoji} {f.label}</th>
              ))}
              <th style={{ ...thStyle, color: TEXT_PRIMARY }}>TOTAL</th>
              <th style={{ ...thStyle, width: 120 }}>Copy from</th>
            </tr>
          </thead>
          <tbody>
            {attendees.map(a => {
              const total = rowTotal(a.id)
              return (
                <tr key={a.id} style={{ transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-subtle)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: avatarColor(getName(a)),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 600, color: "#fff", flexShrink: 0,
                      }}>{initials(getName(a))}</div>
                      {getName(a)}
                    </div>
                  </td>
                  {FIELDS.map(f => {
                    const cellKey = `${a.id}-${f.key}`
                    const val = budgets[a.id]?.[f.key] ?? 0
                    const isEditing = editingCell === cellKey
                    return (
                      <td key={f.key} style={{ ...tdStyle, padding: 0 }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => { saveCell(a.id, f.key, Number(editValue) || 0); setEditingCell(null) }}
                            onKeyDown={e => { if (e.key === "Enter") { saveCell(a.id, f.key, Number(editValue) || 0); setEditingCell(null) } if (e.key === "Escape") setEditingCell(null) }}
                            style={{
                              background: "rgba(192,139,136,0.08)", border: `1px solid ${ROSE_GOLD}`,
                              borderRadius: 4, padding: "6px 10px", color: TEXT_PRIMARY, fontSize: 13,
                              fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%",
                              textAlign: "right",
                            }}
                          />
                        ) : (
                          <div
                            onClick={() => { setEditingCell(cellKey); setEditValue(String(val)) }}
                            style={{
                              padding: "8px 12px", cursor: "pointer", textAlign: "right",
                              borderRadius: 4, transition: "background 0.1s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            {val > 0 ? `${sym}${val.toLocaleString()}` : <span style={{ color: TEXT_TERTIARY }}>—</span>}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td style={{ ...tdStyle, fontWeight: 600, color: TEXT_PRIMARY }}>
                    {sym}{total.toLocaleString()}
                  </td>
                  <td style={{ ...tdStyle, padding: "4px 8px" }}>
                    <select
                      value={copyFrom}
                      onChange={e => { if (e.target.value) { copyBudget(e.target.value, a.id); e.target.value = "" } }}
                      style={{ ...selectStyle, padding: "4px 24px 4px 8px", fontSize: 11, width: "100%" }}
                    >
                      <option value="">Copy...</option>
                      {attendees.filter(o => o.id !== a.id).map(o => (
                        <option key={o.id} value={o.id}>{getName(o)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
            {/* Totals row */}
            <tr style={{ background: "var(--surface-subtle)" }}>
              <td style={{ ...tdStyle, textAlign: "left", fontWeight: 700, color: TEXT_PRIMARY, borderBottom: "none" }}>TOTAL</td>
              {FIELDS.map(f => (
                <td key={f.key} style={{ ...tdStyle, fontWeight: 700, color: TEXT_PRIMARY, borderBottom: "none" }}>
                  {sym}{colTotal(f.key).toLocaleString()}
                </td>
              ))}
              <td style={{ ...tdStyle, fontWeight: 700, borderBottom: "none" }}>
                <span style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: ROSE_GOLD }}>{sym}{grandTotal.toLocaleString()}</span>
              </td>
              <td style={{ ...tdStyle, borderBottom: "none" }} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   CONTACTS TAB
   ═══════════════════════════════════════════ */
function ContactsTab({ conf, onUpdate }: { conf: Conference; onUpdate: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pushingAll, setPushingAll] = useState(false)
  const [pushingId, setPushingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "", company: "", roleTitle: "", email: "", phone: "",
    linkedin: "", telegram: "", notes: "", interestLevel: "warm", followUp: "none",
  })

  const updateForm = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  const addContact = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/conferences/${conf.id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      setForm({ name: "", company: "", roleTitle: "", email: "", phone: "", linkedin: "", telegram: "", notes: "", interestLevel: "warm", followUp: "none" })
      setShowForm(false)
      onUpdate()
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const pushToCrm = async (contactId: string) => {
    setPushingId(contactId)
    try {
      await fetch(`/api/conferences/${conf.id}/contacts/${contactId}/push-crm`, { method: "POST" })
      onUpdate()
    } catch { /* ignore */ } finally { setPushingId(null) }
  }

  const pushAllToCrm = async () => {
    setPushingAll(true)
    try {
      await fetch(`/api/conferences/${conf.id}/contacts/push-all`, { method: "POST" })
      onUpdate()
    } catch { /* ignore */ } finally { setPushingAll(false) }
  }

  const interestBadge = (level: string | null) => {
    const opt = INTEREST_OPTIONS.find(o => o.value === level)
    if (!opt) return null
    const colors: Record<string, { bg: string; text: string }> = {
      hot: { bg: "rgba(239,68,68,0.15)", text: "#EF4444" },
      warm: { bg: "rgba(245,158,11,0.15)", text: "#F59E0B" },
      cold: { bg: "rgba(59,130,246,0.15)", text: "#3B82F6" },
    }
    const c = colors[level || "warm"]
    return (
      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: c.bg, color: c.text }}>
        {opt.emoji} {opt.label}
      </span>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: 0 }}>
          Contacts ({conf.contacts?.length || 0})
        </h3>
        <div style={{ display: "flex", gap: 10 }}>
          {conf.contacts?.some(c => !c.pushedToCrm) && (
            <button style={{ ...btnGhost, fontSize: 12 }} onClick={pushAllToCrm} disabled={pushingAll}>
              {pushingAll ? "Pushing..." : "Push All to CRM"}
            </button>
          )}
          <button style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }} onClick={() => setShowForm(!showForm)}>
            <Plus size={14} /> Add Contact
          </button>
        </div>
      </div>

      {/* Add contact form */}
      {showForm && (
        <div style={{ ...cardStyle, background: "var(--surface-subtle)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input style={inputStyle} placeholder="Name *" value={form.name} onChange={e => updateForm("name", e.target.value)} />
            <input style={inputStyle} placeholder="Company" value={form.company} onChange={e => updateForm("company", e.target.value)} />
            <input style={inputStyle} placeholder="Role / Title" value={form.roleTitle} onChange={e => updateForm("roleTitle", e.target.value)} />
            <input style={inputStyle} placeholder="Email" value={form.email} onChange={e => updateForm("email", e.target.value)} />
            <input style={inputStyle} placeholder="Phone" value={form.phone} onChange={e => updateForm("phone", e.target.value)} />
            <input style={inputStyle} placeholder="LinkedIn URL" value={form.linkedin} onChange={e => updateForm("linkedin", e.target.value)} />
            <input style={inputStyle} placeholder="Telegram" value={form.telegram} onChange={e => updateForm("telegram", e.target.value)} />
            <div /> {/* spacer */}
            <div style={{ gridColumn: "1 / -1" }}>
              <textarea style={textareaStyle} placeholder="Notes" value={form.notes} onChange={e => updateForm("notes", e.target.value)} />
            </div>
          </div>

          {/* Interest level */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: TEXT_TERTIARY }}>Interest:</span>
            {INTEREST_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => updateForm("interestLevel", opt.value)} style={{
                background: form.interestLevel === opt.value ? "var(--surface-elevated)" : "var(--surface-subtle)",
                border: form.interestLevel === opt.value ? `1px solid ${ROSE_GOLD}` : `1px solid ${CARD_BORDER}`,
                color: TEXT_PRIMARY, borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>

          {/* Follow-up */}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: TEXT_TERTIARY }}>Follow-up:</span>
            <select style={{ ...selectStyle, width: 200 }} value={form.followUp} onChange={e => updateForm("followUp", e.target.value)}>
              {FOLLOWUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button style={btnPrimary} onClick={addContact} disabled={saving}>
              {saving ? "Adding..." : "Add Contact"}
            </button>
            <button style={btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Contact cards */}
      {(!conf.contacts || conf.contacts.length === 0) && !showForm && (
        <p style={{ fontSize: 13, color: TEXT_TERTIARY, textAlign: "center", padding: 40 }}>No contacts collected yet</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {conf.contacts?.map(contact => (
          <div key={contact.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: TEXT_PRIMARY }}>{contact.name}</span>
                {contact.company && <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{contact.company}</span>}
                {interestBadge(contact.interestLevel)}
              </div>
              {contact.roleTitle && <div style={{ fontSize: 12, color: TEXT_TERTIARY, marginBottom: 4 }}>{contact.roleTitle}</div>}
              {contact.followUp && contact.followUp !== "none" && (
                <div style={{ fontSize: 12, color: ROSE_GOLD }}>
                  Follow-up: {FOLLOWUP_OPTIONS.find(o => o.value === contact.followUp)?.label}
                </div>
              )}
              {contact.notes && (
                <div style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 4, maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {contact.notes}
                </div>
              )}
            </div>
            <div>
              {contact.pushedToCrm ? (
                <span style={{ fontSize: 12, color: "#22C55E" }}>In CRM</span>
              ) : (
                <button
                  style={{ ...btnGhost, fontSize: 11, padding: "5px 10px" }}
                  onClick={() => pushToCrm(contact.id)}
                  disabled={pushingId === contact.id}
                >
                  {pushingId === contact.id ? "Pushing..." : "Push to CRM"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   DOCUMENTS TAB
   ═══════════════════════════════════════════ */
function DocumentsTab({ conf }: { conf: Conference }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: 0 }}>Documents</h3>
        <button
          style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.5, cursor: "not-allowed" }}
          title="Coming soon"
        >
          <Plus size={14} /> Link from Drive
        </button>
      </div>

      {(!conf.documents || conf.documents.length === 0) ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <FileText size={32} color={TEXT_TERTIARY} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: TEXT_TERTIARY }}>No documents linked yet</p>
          <p style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 4 }}>Drive integration coming soon</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {conf.documents.map(doc => (
            <div key={doc.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={16} color={TEXT_SECONDARY} />
                <div>
                  <span style={{ fontSize: 14, color: TEXT_PRIMARY }}>{doc.name}</span>
                  {doc.type && <span style={{ fontSize: 11, color: TEXT_TERTIARY, marginLeft: 8 }}>{doc.type}</span>}
                </div>
              </div>
              <a href={doc.link} target="_blank" rel="noopener noreferrer" style={{ color: ROSE_GOLD, display: "flex", alignItems: "center", gap: 4, fontSize: 12, textDecoration: "none" }}>
                Open <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   REPORT TAB
   ═══════════════════════════════════════════ */
function ReportTab({ conf, onUpdate }: { conf: Conference; onUpdate: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    summary: "",
    keyTakeaways: [{ title: "", detail: "" }],
    marketInsights: "",
    competitorSightings: "",
    opportunities: "",
    recommendations: "",
    rating: 0,
  })

  const updateField = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  const addTakeaway = () => setForm(prev => ({ ...prev, keyTakeaways: [...prev.keyTakeaways, { title: "", detail: "" }] }))

  const removeTakeaway = (idx: number) => setForm(prev => ({
    ...prev, keyTakeaways: prev.keyTakeaways.filter((_, i) => i !== idx),
  }))

  const updateTakeaway = (idx: number, key: string, val: string) => {
    setForm(prev => ({
      ...prev,
      keyTakeaways: prev.keyTakeaways.map((t, i) => i === idx ? { ...t, [key]: val } : t),
    }))
  }

  const submitReport = async () => {
    if (!form.summary.trim()) return
    setSubmitting(true)
    try {
      await fetch(`/api/conferences/${conf.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      onUpdate()
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  // Show existing report
  if (conf.report) {
    const r = conf.report
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Rating */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: TEXT_TERTIARY }}>Rating:</span>
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} size={20} fill={s <= r.rating ? "#F59E0B" : "none"} color={s <= r.rating ? "#F59E0B" : TEXT_TERTIARY} />
          ))}
        </div>

        {/* Summary */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: "0 0 10px" }}>Summary</h3>
          <p style={{ fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{r.summary}</p>
        </div>

        {/* Key Takeaways */}
        {r.keyTakeaways && r.keyTakeaways.length > 0 && (
          <div>
            <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: "0 0 12px" }}>Key Takeaways</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {r.keyTakeaways.map((t, i) => (
                <div key={i} style={{ ...cardStyle, borderLeft: `3px solid ${ROSE_GOLD}` }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, margin: "0 0 6px" }}>{t.title}</h4>
                  <p style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6, margin: 0 }}>{t.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Text sections */}
        {[
          { key: "marketInsights", label: "Market Insights" },
          { key: "competitorSightings", label: "Competitor Sightings" },
          { key: "opportunities", label: "Opportunities" },
          { key: "recommendations", label: "Recommendations" },
        ].map(section => {
          const val = r[section.key as keyof Report] as string | null
          if (!val) return null
          return (
            <div key={section.key} style={cardStyle}>
              <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, margin: "0 0 10px" }}>{section.label}</h3>
              <p style={{ fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{val}</p>
            </div>
          )
        })}

        {r.wikiPageId && (
          <a href={`/wiki/${r.wikiPageId}`} style={{ color: ROSE_GOLD, fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            View in Wiki <ExternalLink size={12} />
          </a>
        )}
      </div>
    )
  }

  // Report submission form
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 800 }}>
      <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_PRIMARY, margin: 0 }}>Submit Conference Report</h3>

      {/* Summary */}
      <div>
        <label style={{ fontSize: 12, color: TEXT_TERTIARY, display: "block", marginBottom: 6 }}>Summary *</label>
        <textarea style={{ ...textareaStyle, minHeight: 100 }} value={form.summary} onChange={e => updateField("summary", e.target.value)} placeholder="Overall summary of the conference..." />
      </div>

      {/* Key Takeaways */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: TEXT_TERTIARY }}>Key Takeaways</label>
          <button style={{ ...btnGhost, fontSize: 11, padding: "4px 10px" }} onClick={addTakeaway}>
            <Plus size={12} style={{ marginRight: 4 }} /> Add Takeaway
          </button>
        </div>
        {form.keyTakeaways.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "start" }}>
            <input style={{ ...inputStyle, flex: "0 0 200px" }} placeholder="Title" value={t.title} onChange={e => updateTakeaway(i, "title", e.target.value)} />
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Detail" value={t.detail} onChange={e => updateTakeaway(i, "detail", e.target.value)} />
            {form.keyTakeaways.length > 1 && (
              <button onClick={() => removeTakeaway(i)} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", padding: 6 }}>
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Other text fields */}
      {[
        { key: "marketInsights", label: "Market Insights", placeholder: "Insights about market trends observed..." },
        { key: "competitorSightings", label: "Competitor Sightings", placeholder: "Competitors seen, their booths, presentations..." },
        { key: "opportunities", label: "Opportunities", placeholder: "Business opportunities identified..." },
        { key: "recommendations", label: "Recommendations", placeholder: "Recommendations for future conferences..." },
      ].map(field => (
        <div key={field.key}>
          <label style={{ fontSize: 12, color: TEXT_TERTIARY, display: "block", marginBottom: 6 }}>{field.label}</label>
          <textarea
            style={textareaStyle}
            value={(form as Record<string, unknown>)[field.key] as string}
            onChange={e => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      ))}

      {/* Rating */}
      <div>
        <label style={{ fontSize: 12, color: TEXT_TERTIARY, display: "block", marginBottom: 8 }}>Rating</label>
        <div style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} onClick={() => setForm(prev => ({ ...prev, rating: s }))} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
              <Star size={24} fill={s <= form.rating ? "#F59E0B" : "none"} color={s <= form.rating ? "#F59E0B" : TEXT_TERTIARY} />
            </button>
          ))}
        </div>
      </div>

      <button style={{ ...btnPrimary, alignSelf: "flex-start", padding: "10px 24px" }} onClick={submitReport} disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Report"}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════
   ROI TAB
   ═══════════════════════════════════════════ */
function ROITab({ roi, loading }: { roi: ROIData | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader2 size={24} color={ROSE_GOLD} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    )
  }

  if (!roi) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: 60 }}>
        <BarChart3 size={36} color={TEXT_TERTIARY} style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 15, color: TEXT_SECONDARY }}>No deal data available yet</p>
        <p style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 6 }}>ROI metrics will appear once deals are linked to this conference</p>
      </div>
    )
  }

  const kpis = [
    { label: "Total Cost", value: `\u20AC${roi.totalCost.toLocaleString()}`, border: "#EF4444" },
    { label: "Contacts Collected", value: String(roi.contactsCollected), border: "#3B82F6" },
    { label: "Leads in CRM", value: String(roi.leadsInCrm), border: "#F59E0B" },
    { label: "Deals Created", value: String(roi.dealsCreated), border: "#A855F7" },
    { label: "Pipeline Value", value: `\u20AC${roi.pipelineValue.toLocaleString()}`, border: ROSE_GOLD },
    { label: "Won Revenue", value: `\u20AC${roi.wonRevenue.toLocaleString()}`, border: "#22C55E" },
  ]

  const roiPositive = (roi.roiPercent ?? 0) >= 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{ ...cardStyle, borderLeft: `3px solid ${kpi.border}` }}>
            <div style={{ fontSize: 12, color: TEXT_TERTIARY, marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: TEXT_PRIMARY }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ROI % highlight */}
      <div style={{
        ...cardStyle,
        textAlign: "center",
        borderColor: roiPositive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
        padding: 32,
      }}>
        <div style={{ fontSize: 12, color: TEXT_TERTIARY, marginBottom: 8 }}>Return on Investment</div>
        <div style={{
          fontFamily: "'Bellfair', serif",
          fontSize: 48,
          color: roiPositive ? "#22C55E" : "#EF4444",
          fontWeight: 400,
        }}>
          {roi.roiPercent !== null ? `${roi.roiPercent > 0 ? "+" : ""}${roi.roiPercent}%` : "N/A"}
        </div>
      </div>

      <a href="/conferences" style={{ color: ROSE_GOLD, fontSize: 13, textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        Compare with other conferences <ExternalLink size={12} />
      </a>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
