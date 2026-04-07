"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  STAGE_COLORS, STAGE_LABELS, ACTIVITY_ICONS, ACTIVITY_TYPES,
  ICP_FITS, RELATIONSHIP_STRENGTHS, OWNER_COLORS, KYC_STATUSES,
  VERTICALS, SUB_VERTICALS, GEO_ZONES, DEAL_OWNERS,
  ACQUISITION_SOURCES, CRM_COLORS, fmtCurrency,
  OUTREACH_GROUPS, OUTREACH_GROUP_COLORS, LIFECYCLE_STAGES,
} from "@/lib/crm-config"
import SupportTab from "@/components/crm/SupportTab"

/* ── Design Tokens ── */
const BG = "#060709"
const CARD_BG = CRM_COLORS.card_bg
const CARD_BORDER = CRM_COLORS.card_border
const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const GLASS = { background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, backdropFilter: CRM_COLORS.glass_blur, WebkitBackdropFilter: CRM_COLORS.glass_blur, boxShadow: CRM_COLORS.glass_shadow }

/* ── Helpers ── */
function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

/* ── Badge Component ── */
function Badge({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", fontSize: 11, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", borderRadius: 20, background: bg || `${color}18`, color, letterSpacing: 0.2, whiteSpace: "nowrap" }}>
      {label}
    </span>
  )
}

/* ── Glass Card ── */
function GlassCard({ children, style, roseLeft }: { children: React.ReactNode; style?: React.CSSProperties; roseLeft?: boolean }) {
  return (
    <div style={{ ...GLASS, padding: 20, ...(roseLeft ? { borderLeft: `3px solid ${ROSE}` } : {}), ...style }}>
      {children}
    </div>
  )
}

/* ── Section Header ── */
function SectionHeader({ label }: { label: string }) {
  return (
    <h4 style={{ fontSize: 12, color: ROSE, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{label}</h4>
  )
}

/* ══════════════════════════════════════════════════════════════
   EDITABLE FIELD COMPONENTS
   ══════════════════════════════════════════════════════════════ */

const fieldLabelStyle: React.CSSProperties = { fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }
const fieldInputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${ROSE}40`, borderRadius: 6, color: TEXT, padding: "6px 8px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }
const fieldValueStyle: React.CSSProperties = { fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "5px 0", borderBottom: `1px dashed ${CARD_BORDER}`, minHeight: 24 }

/* ── Inline Text Field with save flash ── */
function EditableText({ label, value, onSave, type = "text", isUrl }: { label: string; value: string; onSave: (v: string) => Promise<void>; type?: string; isUrl?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setVal(value) }, [value])

  const doSave = async () => {
    setEditing(false)
    if (val === value) return
    setSaving(true)
    try {
      await onSave(val)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    } catch { setVal(value) }
    setSaving(false)
  }

  return (
    <div style={{ marginBottom: 12, transition: "background 0.3s", background: flash ? "rgba(52,211,153,0.08)" : "transparent", borderRadius: 6, padding: flash ? "2px 4px" : 0 }}>
      <div style={fieldLabelStyle}>{label} {saving && <span style={{ color: ROSE, fontSize: 9 }}>saving...</span>}</div>
      {editing ? (
        <input
          ref={ref}
          type={type}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={doSave}
          onKeyDown={(e) => { if (e.key === "Enter") doSave(); if (e.key === "Escape") { setEditing(false); setVal(value) } }}
          autoFocus
          style={fieldInputStyle}
        />
      ) : (
        <div onClick={() => setEditing(true)} style={{ ...fieldValueStyle, color: value ? TEXT : TEXT3, display: "flex", alignItems: "center", gap: 6 }}>
          {value || "Click to add"}
          {isUrl && value && (
            <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: ROSE, fontSize: 12, flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Inline Select Field ── */
function EditableSelect({ label, value, options, onSave, placeholder }: { label: string; value: string; options: { value: string; label: string }[]; onSave: (v: string) => Promise<void>; placeholder?: string }) {
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)

  const handleChange = async (newVal: string) => {
    if (newVal === value) return
    setSaving(true)
    try {
      await onSave(newVal)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <div style={{ marginBottom: 12, transition: "background 0.3s", background: flash ? "rgba(52,211,153,0.08)" : "transparent", borderRadius: 6, padding: flash ? "2px 4px" : 0 }}>
      <div style={fieldLabelStyle}>{label} {saving && <span style={{ color: ROSE, fontSize: 9 }}>saving...</span>}</div>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: value ? TEXT : TEXT3, padding: "6px 8px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
      >
        <option value="">{placeholder || "Select..."}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

/* ── Multi-Select Pills ── */
function EditableMultiSelect({ label, values, options, onSave, color }: { label: string; values: string[]; options: readonly string[]; onSave: (v: string[]) => Promise<void>; color: string }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)

  const toggle = async (item: string) => {
    const next = values.includes(item) ? values.filter((v) => v !== item) : [...values, item]
    setSaving(true)
    try {
      await onSave(next)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <div style={{ marginBottom: 12, transition: "background 0.3s", background: flash ? "rgba(52,211,153,0.08)" : "transparent", borderRadius: 6, padding: flash ? "2px 4px" : 0 }}>
      <div style={{ ...fieldLabelStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{label} {saving && <span style={{ color: ROSE, fontSize: 9 }}>saving...</span>}</span>
        <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: ROSE, fontSize: 10, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>
          {open ? "Done" : "Edit"}
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, minHeight: 24 }}>
        {values.length > 0 ? values.map((v) => (
          <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", fontSize: 10, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", borderRadius: 12, background: `${color}18`, color }}>
            {v}
            {open && <span onClick={() => toggle(v)} style={{ cursor: "pointer", marginLeft: 2, fontSize: 12, lineHeight: 1 }}>&times;</span>}
          </span>
        )) : <span style={{ fontSize: 11, color: TEXT3, padding: "3px 0" }}>None selected</span>}
      </div>
      {open && (
        <div style={{ marginTop: 8, maxHeight: 180, overflowY: "auto", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, padding: 6 }}>
          {options.map((o) => (
            <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", cursor: "pointer", borderRadius: 4, fontSize: 12, color: values.includes(o) ? TEXT : TEXT2, fontFamily: "'DM Sans', sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <input type="checkbox" checked={values.includes(o)} onChange={() => toggle(o)} style={{ accentColor: color }} />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}


/* ── Add Activity Modal ── */
const LOGGABLE_TYPES = ["call_outbound", "meeting_manual", "note_added", "whatsapp_message", "file_attached"] as const

function AddActivityModal({ contactId, onClose, onSaved }: { contactId: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<string>("note_added")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!description.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/crm/contacts/${contactId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description }),
      })
      onSaved()
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...GLASS, padding: 28, width: 440, maxWidth: "90vw" }}>
        <h3 style={{ fontSize: 18, fontFamily: "'Bellfair', serif", color: TEXT, margin: "0 0 16px" }}>Log Activity</h3>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 4 }}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, color: TEXT, padding: "8px 10px", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
            {LOGGABLE_TYPES.map((t) => {
              const at = ACTIVITY_TYPES.find((a) => a.id === t)
              return <option key={t} value={t}>{at ? `${at.icon} ${at.label}` : t}</option>
            })}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 4 }}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, color: TEXT, padding: "8px 10px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "vertical" }} placeholder="What happened?" />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT2, fontSize: 12, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !description.trim()} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: saving || !description.trim() ? 0.5 : 1 }}>{saving ? "Saving..." : "Log Activity"}</button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   TAB TYPES
   ════════════════════════════════════════════════════════════════ */
type TabId = "details" | "activity" | "deals" | "emails" | "files" | "signals" | "support"
const TAB_LIST: { id: TabId; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "activity", label: "Activity" },
  { id: "deals", label: "Deals" },
  { id: "emails", label: "Emails" },
  { id: "files", label: "Files" },
  { id: "signals", label: "Signals" },
  { id: "support", label: "Support" },
]

/* ════════════════════════════════════════════════════════════════
   CONTACT DETAIL PAGE
   ════════════════════════════════════════════════════════════════ */
export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contact, setContact] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>("details")

  // Activity state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activities, setActivities] = useState<any[]>([])
  const [activityFilter, setActivityFilter] = useState("all")
  const [showAddActivity, setShowAddActivity] = useState(false)

  // Deals state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deals, setDeals] = useState<any[]>([])

  // Emails state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emails, setEmails] = useState<any[]>([])

  // Files state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [files, setFiles] = useState<any[]>([])

  // Signals state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [signals, setSignals] = useState<any[]>([])

  // Pinned note
  const [editingNote, setEditingNote] = useState(false)
  const [noteVal, setNoteVal] = useState("")

  // Lemlist state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lemlistCampaigns, setLemlistCampaigns] = useState<any[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState("")
  const [enrolling, setEnrolling] = useState(false)
  const [showSequenceDropdown, setShowSequenceDropdown] = useState(false)

  /* ── Fetchers ── */
  const fetchContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/contacts/${id}`)
      const data = await res.json()
      setContact(data.contact)
      setNoteVal(data.contact?.pinnedNote || "")
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/contacts/${id}/activities?limit=50`)
      const data = await res.json()
      setActivities(data.activities ?? [])
    } catch { /* ignore */ }
  }, [id])

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/deals?contactId=${id}`)
      const data = await res.json()
      setDeals(data.deals ?? [])
    } catch { /* ignore */ }
  }, [id])

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts/${id}/emails`)
      const data = await res.json()
      setEmails(data.emails ?? [])
    } catch { /* ignore */ }
  }, [id])

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/drive/links?contactId=${id}`)
      const data = await res.json()
      setFiles(data.links ?? [])
    } catch { /* ignore */ }
  }, [id])

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts/${id}/signals`)
      const data = await res.json()
      setSignals(data.signals ?? [])
    } catch { /* ignore */ }
  }, [id])

  const fetchLemlistCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/lemlist/campaigns")
      const data = await res.json()
      setLemlistCampaigns(data.campaigns ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchContact(); fetchLemlistCampaigns() }, [fetchContact, fetchLemlistCampaigns])

  useEffect(() => {
    if (activeTab === "activity") fetchActivities()
    else if (activeTab === "deals") fetchDeals()
    else if (activeTab === "emails") fetchEmails()
    else if (activeTab === "files") fetchFiles()
    else if (activeTab === "signals") fetchSignals()
  }, [activeTab, fetchActivities, fetchDeals, fetchEmails, fetchFiles, fetchSignals])

  /* ── Patch helper (returns promise for editable fields) ── */
  const patchContact = async (fields: Record<string, unknown>) => {
    const res = await fetch(`/api/crm/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
    const data = await res.json()
    if (data.contact) setContact((prev: typeof contact) => ({ ...prev, ...data.contact }))
  }

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to permanently delete this contact?")) return
    try {
      await fetch(`/api/crm/contacts/${id}`, { method: "DELETE" })
      router.push("/crm/contacts")
    } catch { /* ignore */ }
  }

  /* ── Lemlist enroll ── */
  const handleEnroll = async () => {
    if (!selectedCampaign || enrolling) return
    setEnrolling(true)
    try {
      const res = await fetch("/api/lemlist/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: id, campaignId: selectedCampaign }),
      })
      const data = await res.json()
      if (data.ok) {
        setShowSequenceDropdown(false)
        setSelectedCampaign("")
        fetchActivities()
        fetchContact()
      } else {
        alert(data.error || "Failed to enroll")
      }
    } catch { alert("Network error") }
    setEnrolling(false)
  }

  const handleRemoveFromLemlist = async (campaignId?: string) => {
    try {
      const res = await fetch("/api/lemlist/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: id, campaignId }),
      })
      const data = await res.json()
      if (data.ok) { fetchActivities(); fetchContact() }
    } catch { /* ignore */ }
  }

  /* ── Do Not Contact with Lemlist removal ── */
  const handleDoNotContactToggle = async () => {
    const newVal = !contact.doNotContact
    patchContact({ doNotContact: newVal })
    if (newVal) {
      handleRemoveFromLemlist()
    }
  }

  /* ── Loading / Not Found ── */
  if (loading) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Loading contact...</div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ color: TEXT, fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}>Contact not found</div>
        <button onClick={() => router.push("/crm/contacts")} style={{ padding: "8px 20px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: ROSE, fontSize: 13, cursor: "pointer" }}>Back to Contacts</button>
      </div>
    )
  }

  /* ── Derived data ── */
  const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
  const companyName = contact.company?.name || ""
  const stageColor = STAGE_COLORS[contact.lifecycleStage] || "#9CA3AF"
  const stageLabel = STAGE_LABELS[contact.lifecycleStage] || contact.lifecycleStage || "—"
  const icpObj = ICP_FITS.find((f) => f.id === contact.icpFit)
  const relObj = RELATIONSHIP_STRENGTHS.find((r) => r.id === contact.relationshipStrength)
  const ownerColor = OWNER_COLORS[contact.dealOwner] || "#9CA3AF"
  const daysSince = contact.daysSinceLastContact

  const filteredActivities = activityFilter === "all" ? activities : activities.filter((a: { type: string }) => a.type === activityFilter)

  /* ── Render ── */
  return (
    <div className="page-content" style={{ padding: 0, background: BG, minHeight: "100vh" }}>
      {/* ════ HEADER ════ */}
      <div style={{ padding: "20px 32px 18px", borderBottom: `1px solid ${CARD_BORDER}`, background: "rgba(6,7,9,0.88)", backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 100 }}>
        {/* Back link */}
        <button onClick={() => router.push("/crm/contacts")} style={{ background: "none", border: "none", color: TEXT3, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 10, padding: 0 }}>
          &larr; All Contacts
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
          <div style={{ flex: 1 }}>
            {/* Name */}
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 32, fontWeight: 400, color: "#fff", margin: 0, lineHeight: 1.2 }}>
              {fullName || "Unnamed Contact"}
            </h1>
            {/* Company + Title */}
            <div style={{ fontSize: 13, color: TEXT2, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
              {companyName && <span>{companyName}</span>}
              {companyName && contact.jobTitle && <span style={{ margin: "0 6px", color: TEXT3 }}>/</span>}
              {contact.jobTitle && <span>{contact.jobTitle}</span>}
            </div>

            {/* Badges row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
              {(() => { const gObj = contact.outreachGroup ? OUTREACH_GROUPS.find((g) => g.id === contact.outreachGroup) : null; return gObj ? <Badge label={gObj.short} color={gObj.color} /> : null })()}
              <Badge label={stageLabel} color={stageColor} />
              {icpObj && <Badge label={icpObj.label} color={icpObj.color} bg={icpObj.bg} />}
              {relObj && <Badge label={relObj.label} color={relObj.color} bg={relObj.bg} />}
              {contact.geoZone && <Badge label={contact.geoZone} color="#22D3EE" bg="rgba(34,211,238,0.12)" />}
              {contact.contactType && <Badge label={contact.contactType} color="#A78BFA" bg="rgba(167,139,250,0.12)" />}
            </div>

            {/* Deal owner */}
            {contact.dealOwner && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: ownerColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                  {contact.dealOwner.charAt(0)}
                </div>
                <span style={{ fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif" }}>{contact.dealOwner}</span>
              </div>
            )}
          </div>

          {/* Right actions */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDelete} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#F87171", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Delete
              </button>
            </div>
            {/* Do Not Contact toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 11, color: contact.doNotContact ? "#F87171" : TEXT3, fontFamily: "'DM Sans', sans-serif" }}>Do Not Contact</span>
              <div
                onClick={handleDoNotContactToggle}
                style={{
                  width: 36, height: 20, borderRadius: 10, position: "relative", cursor: "pointer", transition: "background 0.2s",
                  background: contact.doNotContact ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.1)",
                }}
              >
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: contact.doNotContact ? "#F87171" : "rgba(255,255,255,0.3)", position: "absolute", top: 2, left: contact.doNotContact ? 18 : 2, transition: "left 0.2s" }} />
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* ════ BODY: Full Width with Tabs ════ */}
      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Pinned Note */}
        {(contact.pinnedNote || editingNote) && (
          <GlassCard roseLeft>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: ROSE, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Pinned Note</span>
              <button onClick={() => { if (editingNote) { patchContact({ pinnedNote: noteVal }); setEditingNote(false) } else { setEditingNote(true) } }} style={{ background: "none", border: "none", color: ROSE, fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {editingNote ? "Save" : "Edit"}
              </button>
            </div>
            {editingNote ? (
              <textarea value={noteVal} onChange={(e) => setNoteVal(e.target.value)} rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${ROSE}30`, borderRadius: 8, color: TEXT, padding: "8px 10px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none" }} />
            ) : (
              <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, margin: 0, fontFamily: "'DM Sans', sans-serif", whiteSpace: "pre-wrap" }}>{contact.pinnedNote}</p>
            )}
          </GlassCard>
        )}

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3 }}>
          {TAB_LIST.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "7px 16px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, border: "none", borderRadius: 6, cursor: "pointer", transition: "all 0.15s", background: activeTab === tab.id ? `${ROSE}22` : "transparent", color: activeTab === tab.id ? TEXT : TEXT2 }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════ TAB: DETAILS ══════════════════ */}
        {activeTab === "details" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* ── LEFT COLUMN ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Contact Info */}
              <GlassCard>
                <SectionHeader label="Contact Info" />
                <EditableText label="Email" value={contact.email || ""} onSave={(v) => patchContact({ email: v })} type="email" />
                <EditableText label="Phone" value={contact.phone || ""} onSave={(v) => patchContact({ phone: v })} type="tel" />
                <EditableText label="LinkedIn" value={contact.linkedinUrl || ""} onSave={(v) => patchContact({ linkedinUrl: v })} isUrl />
                <EditableText label="Company" value={companyName} onSave={() => Promise.resolve()} />
                <EditableText label="Job Title" value={contact.jobTitle || ""} onSave={(v) => patchContact({ jobTitle: v })} />
              </GlassCard>

              {/* Classification */}
              <GlassCard>
                <SectionHeader label="Classification" />

                <EditableSelect
                  label="Outreach Group"
                  value={contact.outreachGroup || ""}
                  options={OUTREACH_GROUPS.map((g) => ({ value: g.id, label: g.label }))}
                  onSave={(v) => patchContact({ outreachGroup: v || null })}
                  placeholder="No Group"
                />

                <EditableMultiSelect
                  label="Verticals"
                  values={contact.vertical || []}
                  options={VERTICALS}
                  onSave={(v) => patchContact({ vertical: v })}
                  color={ROSE}
                />

                <EditableMultiSelect
                  label="Sub-Verticals"
                  values={contact.subVertical || []}
                  options={SUB_VERTICALS}
                  onSave={(v) => patchContact({ subVertical: v })}
                  color="#818CF8"
                />

                <EditableSelect
                  label="Geo Zone"
                  value={contact.geoZone || ""}
                  options={GEO_ZONES.map((g) => ({ value: g, label: g }))}
                  onSave={(v) => patchContact({ geoZone: v || null })}
                  placeholder="Select zone..."
                />

                <EditableSelect
                  label="Acquisition Source"
                  value={contact.acquisitionSource || ""}
                  options={ACQUISITION_SOURCES.map((s) => ({ value: s, label: s }))}
                  onSave={(v) => patchContact({ acquisitionSource: v || null })}
                  placeholder="Select source..."
                />

                <EditableSelect
                  label="Deal Owner"
                  value={contact.dealOwner || ""}
                  options={DEAL_OWNERS.map((o) => ({ value: o, label: o }))}
                  onSave={(v) => patchContact({ dealOwner: v || null })}
                  placeholder="Unassigned"
                />

                <EditableSelect
                  label="ICP Fit"
                  value={contact.icpFit || ""}
                  options={ICP_FITS.map((f) => ({ value: f.id, label: f.label }))}
                  onSave={(v) => patchContact({ icpFit: v || null })}
                  placeholder="Not scored"
                />

                <EditableSelect
                  label="Lifecycle Stage"
                  value={contact.lifecycleStage || ""}
                  options={LIFECYCLE_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] || s }))}
                  onSave={(v) => patchContact({ lifecycleStage: v })}
                  placeholder="Select stage..."
                />
              </GlassCard>

              {/* Lemlist */}
              <GlassCard>
                <SectionHeader label="Lemlist Sequences" />
                {contact.lifecycleStage === "sequence_active" && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34D399" }} />
                      <span style={{ fontSize: 13, color: "#34D399", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>Active in Lemlist</span>
                    </div>
                    <button
                      onClick={() => handleRemoveFromLemlist()}
                      style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#F87171", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                    >
                      Remove from All Sequences
                    </button>
                  </div>
                )}
                {contact.lifecycleStage !== "sequence_active" && (
                  <div style={{ fontSize: 12, color: TEXT3, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>Not enrolled in any sequence.</div>
                )}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => { if (!contact.doNotContact) setShowSequenceDropdown(!showSequenceDropdown) }}
                    disabled={contact.doNotContact}
                    style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${ROSE}40`, background: `${ROSE}12`, color: contact.doNotContact ? TEXT3 : ROSE, fontSize: 12, cursor: contact.doNotContact ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, opacity: contact.doNotContact ? 0.4 : 1 }}
                  >
                    Add to Sequence
                  </button>
                  {showSequenceDropdown && (
                    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, ...GLASS, padding: 14, width: 300, zIndex: 200 }}>
                      <div style={{ fontSize: 11, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>Select Campaign</div>
                      {lemlistCampaigns.length === 0 ? (
                        <div style={{ fontSize: 12, color: TEXT3, fontFamily: "'DM Sans', sans-serif", padding: "8px 0" }}>No campaigns available</div>
                      ) : (
                        <>
                          <select
                            value={selectedCampaign}
                            onChange={(e) => setSelectedCampaign(e.target.value)}
                            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, color: TEXT, padding: "8px 10px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}
                          >
                            <option value="">Choose a campaign...</option>
                            {lemlistCampaigns.map((c: { id: string; name: string }) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button onClick={() => { setShowSequenceDropdown(false); setSelectedCampaign("") }} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT2, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                            <button onClick={handleEnroll} disabled={!selectedCampaign || enrolling} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: !selectedCampaign || enrolling ? 0.5 : 1 }}>{enrolling ? "Enrolling..." : "Enroll"}</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Enrichment */}
              <GlassCard>
                <SectionHeader label="Enrichment" />
                <EditableText label="Company Size" value={contact.companySize || ""} onSave={(v) => patchContact({ companySize: v })} />
                <EditableText label="Funding Stage" value={contact.fundingStage || ""} onSave={(v) => patchContact({ fundingStage: v })} />
                <EditableMultiSelect
                  label="Tech Stack"
                  values={contact.techStack || []}
                  options={contact.techStack || []}
                  onSave={(v) => patchContact({ techStack: v })}
                  color="#22D3EE"
                />
                <EditableText label="Revenue Range" value={contact.annualRevenueRange || ""} onSave={(v) => patchContact({ annualRevenueRange: v })} />
                <EditableText label="Country" value={contact.country || ""} onSave={(v) => patchContact({ country: v })} />
                <EditableText label="City" value={contact.city || ""} onSave={(v) => patchContact({ city: v })} />
              </GlassCard>

              {/* Smart Fields */}
              <GlassCard>
                <SectionHeader label="Smart Fields" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
                  <div>
                    <div style={fieldLabelStyle}>Last Interaction</div>
                    <div style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{fmtDate(contact.lastInteraction)}</div>
                    <div style={{ fontSize: 10, color: TEXT3 }}>{relativeTime(contact.lastInteraction)}</div>
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Days Since Contact</div>
                    <div style={{ fontSize: 22, fontFamily: "'Bellfair', serif", color: daysSince != null && daysSince > 14 ? "#F87171" : daysSince != null && daysSince > 7 ? "#FBBF24" : "#34D399" }}>
                      {daysSince != null ? daysSince : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Next Meeting</div>
                    <div style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{fmtDate(contact.nextScheduledMeeting)}</div>
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Total Interactions</div>
                    <div style={{ fontSize: 22, fontFamily: "'Bellfair', serif", color: TEXT }}>{contact.totalInteractions ?? 0}</div>
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Avg Response Time</div>
                    <div style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>
                      {contact.avgResponseTimeHours != null ? `${contact.avgResponseTimeHours}h` : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>Relationship</div>
                    {relObj ? <Badge label={relObj.label} color={relObj.color} bg={relObj.bg} /> : <span style={{ fontSize: 11, color: TEXT3 }}>—</span>}
                  </div>
                </div>

                {/* Relationship score progress bar */}
                {contact.relationshipScore != null && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8 }}>Score</span>
                      <span style={{ fontSize: 12, color: TEXT, fontFamily: "'Bellfair', serif" }}>{contact.relationshipScore}/100</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, contact.relationshipScore)}%`, background: `linear-gradient(90deg, ${ROSE}, #34D399)`, transition: "width 0.5s" }} />
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* AI Summary */}
              <GlassCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <SectionHeader label="AI Summary" />
                  <button onClick={() => patchContact({ aiSummary: null })} style={{ background: "none", border: "none", color: TEXT3, fontSize: 10, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Regenerate</button>
                </div>
                <p style={{ fontSize: 13, color: contact.aiSummary ? TEXT : TEXT3, margin: 0, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                  {contact.aiSummary || "No AI summary available. Click Regenerate to create one."}
                </p>
              </GlassCard>

              {/* Introducer Info (conditional) */}
              {contact.contactType === "introducer" && (
                <GlassCard>
                  <SectionHeader label="Introducer Info" />
                  {(() => {
                    const referred = contact.referredContacts || []
                    const total = referred.length
                    const successful = referred.filter((r: { lifecycleStage?: string }) => r.lifecycleStage === "closed_won").length
                    const rate = total > 0 ? Math.round((successful / total) * 100) : 0
                    return (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 22, fontFamily: "'Bellfair', serif", color: TEXT }}>{total}</div>
                            <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase" }}>Total</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 22, fontFamily: "'Bellfair', serif", color: "#34D399" }}>{successful}</div>
                            <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase" }}>Won</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 22, fontFamily: "'Bellfair', serif", color: ROSE }}>{rate}%</div>
                            <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase" }}>Rate</div>
                          </div>
                        </div>
                        {referred.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Referred Contacts</div>
                            {referred.map((r: { id: string; firstName: string; lastName: string; email: string }) => (
                              <div key={r.id} onClick={() => router.push(`/crm/contacts/${r.id}`)} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${CARD_BORDER}`, cursor: "pointer" }}>
                                <span style={{ fontSize: 12, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{r.firstName} {r.lastName}</span>
                                <span style={{ fontSize: 11, color: TEXT3 }}>{r.email}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </GlassCard>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: ACTIVITY ══════════════════ */}
        {activeTab === "activity" && (
          <GlassCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ fontSize: 15, color: TEXT, margin: 0, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Activity Timeline</h3>
                <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: TEXT2, padding: "4px 8px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                  <option value="all">All Types</option>
                  {ACTIVITY_TYPES.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
                </select>
              </div>
              <button onClick={() => setShowAddActivity(true)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                + Add Activity
              </button>
            </div>

            {filteredActivities.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: TEXT3, fontSize: 13 }}>No activities yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {filteredActivities.map((a: { id: string; type: string; description: string | null; createdAt: string; dealId: string | null; performedBy: string | null }, i: number) => (
                  <div key={a.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : "none" }}>
                    <div style={{ fontSize: 18, width: 32, textAlign: "center", lineHeight: "24px", flexShrink: 0 }}>
                      {ACTIVITY_ICONS[a.type] || "📌"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                          {ACTIVITY_TYPES.find((t) => t.id === a.type)?.label || a.type}
                        </span>
                        <span style={{ fontSize: 11, color: TEXT3, whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif" }}>{fmtDateTime(a.createdAt)}</span>
                      </div>
                      {a.description && <p style={{ fontSize: 12, color: TEXT2, margin: "4px 0 0", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{a.description}</p>}
                      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                        {a.dealId && <span style={{ fontSize: 10, color: ROSE, fontFamily: "'DM Sans', sans-serif" }}>Deal linked</span>}
                        {a.performedBy && <span style={{ fontSize: 10, color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>by {a.performedBy}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {/* ══════════════════ TAB: DEALS ══════════════════ */}
        {activeTab === "deals" && (
          <GlassCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, color: TEXT, margin: 0, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Deals</h3>
              <button onClick={() => router.push(`/crm?tab=pipeline&newDeal=true`)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + New Deal
              </button>
            </div>
            {deals.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: TEXT3, fontSize: 13 }}>No deals found</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {deals.map((d: { id: string; dealName: string; stage: string; dealValue: number | null; dealOwner: string | null; kycStatus?: string }, i: number) => {
                  const dStageColor = STAGE_COLORS[d.stage] || "#9CA3AF"
                  const dStageLabel = STAGE_LABELS[d.stage] || d.stage
                  const kycObj = KYC_STATUSES.find((k) => k.id === d.kycStatus)
                  return (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : "none", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: TEXT, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{d.dealName}</div>
                        {d.dealOwner && <div style={{ fontSize: 11, color: TEXT3, marginTop: 2 }}>{d.dealOwner}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {kycObj && <Badge label={kycObj.label} color={kycObj.color} />}
                        <Badge label={dStageLabel} color={dStageColor} />
                        {d.dealValue != null && (
                          <span style={{ fontSize: 13, fontFamily: "'Bellfair', serif", color: TEXT, whiteSpace: "nowrap" }}>{fmtCurrency(d.dealValue)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </GlassCard>
        )}

        {/* ══════════════════ TAB: EMAILS ══════════════════ */}
        {activeTab === "emails" && (
          <GlassCard>
            <h3 style={{ fontSize: 15, color: TEXT, margin: "0 0 16px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Emails</h3>
            {emails.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: TEXT3, fontSize: 13 }}>No emails found</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {emails.map((e: { id: string; subject: string; snippet: string | null; direction: string; date: string }, i: number) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : "none" }}>
                    <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{e.direction === "inbound" ? "📨" : "📧"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: TEXT, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subject || "(No subject)"}</div>
                      {e.snippet && <div style={{ fontSize: 11, color: TEXT3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.snippet}</div>}
                    </div>
                    <span style={{ fontSize: 11, color: TEXT3, whiteSpace: "nowrap" }}>{fmtDate(e.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {/* ══════════════════ TAB: FILES ══════════════════ */}
        {activeTab === "files" && (
          <GlassCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, color: TEXT, margin: 0, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Files</h3>
              <button style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + Link from Drive
              </button>
            </div>
            {files.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: TEXT3, fontSize: 13 }}>No files linked</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {files.map((f: { id: string; name: string; url: string; createdAt: string }, i: number) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : "none", textDecoration: "none" }}>
                    <span style={{ fontSize: 16 }}>📎</span>
                    <span style={{ fontSize: 13, color: ROSE, flex: 1 }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: TEXT3 }}>{fmtDate(f.createdAt)}</span>
                  </a>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {/* ══════════════════ TAB: SUPPORT ══════════════════ */}
        {activeTab === "support" && <SupportTab contactId={id} />}

        {/* ══════════════════ TAB: SIGNALS ══════════════════ */}
        {activeTab === "signals" && (
          <GlassCard>
            <h3 style={{ fontSize: 15, color: TEXT, margin: "0 0 16px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Intent Signals</h3>
            {signals.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: TEXT3, fontSize: 13 }}>No signals detected</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {signals.map((s: { id: string; signalType: string; title: string; detail: string | null; score: number; source: string; createdAt: string }, i: number) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : "none" }}>
                    <div style={{ fontSize: 16, width: 24, textAlign: "center" }}>🔔</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: TEXT, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{s.title}</span>
                        <Badge label={`Score: ${s.score}`} color={s.score >= 70 ? "#34D399" : s.score >= 40 ? "#FBBF24" : "#9CA3AF"} />
                      </div>
                      {s.detail && <div style={{ fontSize: 12, color: TEXT2, marginTop: 3 }}>{s.detail}</div>}
                      <div style={{ fontSize: 10, color: TEXT3, marginTop: 4 }}>{s.source} &middot; {fmtDate(s.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}
      </div>

      {/* ── Add Activity Modal ── */}
      {showAddActivity && (
        <AddActivityModal
          contactId={id}
          onClose={() => setShowAddActivity(false)}
          onSaved={() => { setShowAddActivity(false); fetchActivities(); fetchContact() }}
        />
      )}
    </div>
  )
}
