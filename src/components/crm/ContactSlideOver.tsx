"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  STAGE_COLORS, STAGE_LABELS, ACTIVITY_ICONS, ACTIVITY_TYPES,
  ICP_FITS, OWNER_COLORS, KYC_STATUSES,
  VERTICALS, SUB_VERTICALS, GEO_ZONES, DEAL_OWNERS,
  ACQUISITION_SOURCES, CRM_COLORS, fmtCurrency,
  OUTREACH_GROUPS, LIFECYCLE_STAGES,
} from "@/lib/crm-config"

/* ── Design Tokens ── */
const CARD_BORDER = CRM_COLORS.card_border
const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold

/* ── Helpers ── */
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}
function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

/* ── Badge ── */
function Badge({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 10, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", borderRadius: 14, background: bg || `${color}18`, color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  )
}

/* ── Avatar Color ── */
function avatarColor(name: string): string {
  const colors = ["#C08B88", "#818CF8", "#34D399", "#FBBF24", "#F87171", "#22D3EE", "#A78BFA", "#60A5FA"]
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

/* ══════════════════════════════════════════════════════════════
   EDITABLE FIELD COMPONENTS (compact for panel)
   ══════════════════════════════════════════════════════════════ */

const lbl: React.CSSProperties = { fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }
const inputS: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${ROSE}40`, borderRadius: 6, color: TEXT, padding: "5px 7px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none" }

function EText({ label, value, onSave, isUrl, isLink }: { label: string; value: string; onSave: (v: string) => Promise<void>; isUrl?: boolean; isLink?: "mailto" | "tel" }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)
  useEffect(() => { setVal(value) }, [value])

  const doSave = async () => {
    setEditing(false)
    if (val === value) return
    setSaving(true)
    try { await onSave(val); setFlash(true); setTimeout(() => setFlash(false), 700) } catch { setVal(value) }
    setSaving(false)
  }

  return (
    <div style={{ marginBottom: 10, transition: "background 0.3s", background: flash ? "rgba(52,211,153,0.08)" : "transparent", borderRadius: 4, padding: "2px 4px", margin: "0 -4px 10px" }}>
      <div style={lbl}>{label} {saving && <span style={{ color: ROSE, fontSize: 8 }}>saving...</span>}</div>
      {editing ? (
        <input value={val} onChange={(e) => setVal(e.target.value)} onBlur={doSave} onKeyDown={(e) => { if (e.key === "Enter") doSave(); if (e.key === "Escape") { setEditing(false); setVal(value) } }} autoFocus style={inputS} />
      ) : (
        <div onClick={() => setEditing(true)} style={{ fontSize: 12, color: value ? TEXT : TEXT3, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "3px 0", minHeight: 20, display: "flex", alignItems: "center", gap: 6 }}>
          {value || "Add a value"}
          {isLink && value && (
            <a href={`${isLink}:${value}`} onClick={(e) => e.stopPropagation()} style={{ color: ROSE, fontSize: 11, flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          )}
          {isUrl && value && (
            <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: ROSE, fontSize: 11, flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function ESelect({ label, value, options, onSave, placeholder }: { label: string; value: string; options: { value: string; label: string }[]; onSave: (v: string) => Promise<void>; placeholder?: string }) {
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)
  const handleChange = async (v: string) => {
    if (v === value) return
    setSaving(true)
    try { await onSave(v); setFlash(true); setTimeout(() => setFlash(false), 700) } catch { /* */ }
    setSaving(false)
  }
  return (
    <div style={{ marginBottom: 10, transition: "background 0.3s", background: flash ? "rgba(52,211,153,0.08)" : "transparent", borderRadius: 4, padding: "2px 4px", margin: "0 -4px 10px" }}>
      <div style={lbl}>{label} {saving && <span style={{ color: ROSE, fontSize: 8 }}>saving...</span>}</div>
      <select value={value} onChange={(e) => handleChange(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: value ? TEXT : TEXT3, padding: "5px 7px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
        <option value="">{placeholder || "Select an option"}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function EMultiPills({ label, values, options, onSave, color }: { label: string; values: string[]; options: readonly string[]; onSave: (v: string[]) => Promise<void>; color: string }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const toggle = async (item: string) => {
    const next = values.includes(item) ? values.filter((v) => v !== item) : [...values, item]
    setSaving(true)
    try { await onSave(next) } catch { /* */ }
    setSaving(false)
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ ...lbl, display: "flex", justifyContent: "space-between" }}>
        <span>{label} {saving && <span style={{ color: ROSE, fontSize: 8 }}>saving...</span>}</span>
        <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: ROSE, fontSize: 9, cursor: "pointer", padding: 0, fontFamily: "'DM Sans', sans-serif" }}>{open ? "Done" : "Edit"}</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, minHeight: 20 }}>
        {values.length > 0 ? values.map((v) => (
          <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", fontSize: 10, fontFamily: "'DM Sans', sans-serif", borderRadius: 10, background: `${color}18`, color }}>
            {v}
            {open && <span onClick={() => toggle(v)} style={{ cursor: "pointer", fontSize: 11, lineHeight: 1 }}>&times;</span>}
          </span>
        )) : <span style={{ fontSize: 11, color: TEXT3 }}>Add a value</span>}
      </div>
      {open && (
        <div style={{ marginTop: 6, maxHeight: 150, overflowY: "auto", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, padding: 4 }}>
          {options.map((o) => (
            <label key={o} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 5px", cursor: "pointer", fontSize: 11, color: values.includes(o) ? TEXT : TEXT2, fontFamily: "'DM Sans', sans-serif" }}>
              <input type="checkbox" checked={values.includes(o)} onChange={() => toggle(o)} style={{ accentColor: color, width: 13, height: 13 }} />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SLIDE-OVER PANEL
   ══════════════════════════════════════════════════════════════ */

type PanelTab = "details" | "activity" | "deals" | "notes" | "support"

interface ContactSlideOverProps {
  contactId: string | null
  onClose: () => void
  onContactUpdated?: () => void
}

export default function ContactSlideOver({ contactId, onClose, onContactUpdated }: ContactSlideOverProps) {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contact, setContact] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<PanelTab>("details")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activities, setActivities] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deals, setDeals] = useState<any[]>([])

  // Pinned note
  const [editingNote, setEditingNote] = useState(false)
  const [noteVal, setNoteVal] = useState("")
  const [noteText, setNoteText] = useState("")
  const [addingNote, setAddingNote] = useState(false)

  // Lemlist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selCampaign, setSelCampaign] = useState("")
  const [enrolling, setEnrolling] = useState(false)
  const [showSeq, setShowSeq] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)

  /* ── Fetch contact ── */
  const fetchContact = useCallback(async () => {
    if (!contactId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`)
      const data = await res.json()
      setContact(data.contact)
      setNoteVal(data.contact?.pinnedNote || "")
    } catch { /* */ }
    setLoading(false)
  }, [contactId])

  const fetchActivities = useCallback(async () => {
    if (!contactId) return
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/activities?limit=30`)
      const data = await res.json()
      setActivities(data.activities ?? [])
    } catch { /* */ }
  }, [contactId])

  const fetchDeals = useCallback(async () => {
    if (!contactId) return
    try {
      const res = await fetch(`/api/crm/deals?contactId=${contactId}`)
      const data = await res.json()
      setDeals(data.deals ?? [])
    } catch { /* */ }
  }, [contactId])

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/lemlist/campaigns")
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
    } catch { /* */ }
  }, [])

  useEffect(() => {
    if (contactId) {
      fetchContact()
      fetchCampaigns()
      setTab("details")
    } else {
      setContact(null)
    }
  }, [contactId, fetchContact, fetchCampaigns])

  useEffect(() => {
    if (tab === "activity" || tab === "notes") fetchActivities()
    else if (tab === "deals") fetchDeals()
  }, [tab, fetchActivities, fetchDeals])

  /* ── Patch ── */
  const patch = async (fields: Record<string, unknown>) => {
    if (!contactId) return
    const res = await fetch(`/api/crm/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
    const data = await res.json()
    if (data.contact) setContact((prev: typeof contact) => ({ ...prev, ...data.contact }))
    onContactUpdated?.()
  }

  /* ── Lemlist ── */
  const handleEnroll = async () => {
    if (!selCampaign || enrolling || !contactId) return
    setEnrolling(true)
    try {
      const res = await fetch("/api/lemlist/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, campaignId: selCampaign }),
      })
      const data = await res.json()
      if (data.ok) { setShowSeq(false); setSelCampaign(""); fetchContact(); fetchActivities(); onContactUpdated?.() }
    } catch { /* */ }
    setEnrolling(false)
  }

  /* ── Add Note ── */
  const handleAddNote = async () => {
    if (!noteText.trim() || !contactId) return
    setAddingNote(true)
    try {
      await fetch(`/api/crm/contacts/${contactId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "note_added", description: noteText }),
      })
      setNoteText("")
      fetchActivities()
    } catch { /* */ }
    setAddingNote(false)
  }

  /* ── Outside click ── */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
  }

  /* ── Early returns ── */
  if (!contactId) return null

  const isOpen = !!contactId

  if (loading && !contact) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end", background: "rgba(0,0,0,0.3)", transition: "opacity 0.3s" }} onClick={handleOverlayClick}>
        <div ref={panelRef} style={{ width: 450, maxWidth: "90vw", height: "100vh", background: "rgba(15,17,24,0.95)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
          Loading...
        </div>
      </div>
    )
  }

  if (!contact) return null

  const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
  const initials = `${contact.firstName?.[0] || ""}${contact.lastName?.[0] || ""}`.toUpperCase()
  const avColor = avatarColor(fullName)
  const companyName = contact.company?.name || ""
  const stageColor = STAGE_COLORS[contact.lifecycleStage] || "#9CA3AF"
  const stageLabel = STAGE_LABELS[contact.lifecycleStage] || contact.lifecycleStage || "—"

  const tabs: { id: PanelTab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "activity", label: "Activity" },
    { id: "deals", label: "Deals" },
    { id: "notes", label: "Notes" },
    { id: "support", label: "Support" },
  ]

  // Notes = activities of type note_added
  const notes = activities.filter((a: { type: string }) => a.type === "note_added")

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", justifyContent: "flex-end",
        background: isOpen ? "rgba(0,0,0,0.3)" : "transparent",
        transition: "background 0.3s",
      }}
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        style={{
          width: 450, maxWidth: "90vw", height: "100vh",
          background: "rgba(15,17,24,0.95)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          borderLeft: `1px solid ${CARD_BORDER}`,
          boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
          display: "flex", flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
          overflow: "hidden",
        }}
      >
        {/* ════ HEADER ════ */}
        <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${CARD_BORDER}`, flexShrink: 0 }}>
          {/* Top row: close + expand + menu */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT3, cursor: "pointer", padding: 2, fontSize: 18, lineHeight: 1 }}>&times;</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => router.push(`/crm/contacts/${contactId}`)}
                title="Open full page"
                style={{ background: "none", border: "none", color: TEXT3, cursor: "pointer", padding: 2 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </button>
            </div>
          </div>

          {/* Avatar + Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: avColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 400, color: "#fff", fontFamily: "'Bellfair', serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName || "Unnamed"}</div>
              {companyName && (
                <div
                  onClick={() => contact.company?.id && router.push(`/crm/companies/${contact.company.id}`)}
                  style={{ fontSize: 12, color: TEXT2, cursor: contact.company?.id ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}
                >
                  {companyName}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {contact.email && (
              <a href={`mailto:${contact.email}`} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.04)", color: TEXT2, fontSize: 11, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13 }}>✉</span> Email
              </a>
            )}
            {contact.whatsapp && (
              <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.04)", color: TEXT2, fontSize: 11, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13 }}>📱</span> WhatsApp
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.04)", color: TEXT2, fontSize: 11, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13 }}>📞</span> Call
              </a>
            )}
            {contact.linkedinUrl && (
              <a href={contact.linkedinUrl.startsWith("http") ? contact.linkedinUrl : `https://${contact.linkedinUrl}`} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.04)", color: TEXT2, fontSize: 11, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 11 }}>in</span> LinkedIn
              </a>
            )}
            {/* Add to Sequence */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => { if (!contact.doNotContact) setShowSeq(!showSeq) }}
                disabled={contact.doNotContact}
                style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${ROSE}40`, background: `${ROSE}12`, color: contact.doNotContact ? TEXT3 : ROSE, fontSize: 11, cursor: contact.doNotContact ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, opacity: contact.doNotContact ? 0.4 : 1 }}
              >
                Add to Sequence
              </button>
              {showSeq && (
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "rgba(15,17,24,0.98)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: 12, width: 260, zIndex: 300, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                  <select value={selCampaign} onChange={(e) => setSelCampaign(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: TEXT, padding: "6px 8px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
                    <option value="">Choose campaign...</option>
                    {campaigns.map((c: { id: string; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => { setShowSeq(false); setSelCampaign("") }} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT2, fontSize: 10, cursor: "pointer" }}>Cancel</button>
                    <button onClick={handleEnroll} disabled={!selCampaign || enrolling} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", opacity: !selCampaign || enrolling ? 0.5 : 1 }}>{enrolling ? "..." : "Enroll"}</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${CARD_BORDER}`, margin: "0 -20px", padding: "0 20px" }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 12px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, border: "none", borderBottom: tab === t.id ? `2px solid ${ROSE}` : "2px solid transparent", cursor: "pointer", background: "transparent", color: tab === t.id ? TEXT : TEXT3, transition: "all 0.15s" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ════ SCROLLABLE CONTENT ════ */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 24px" }}>

          {/* ══ DETAILS TAB ══ */}
          {tab === "details" && (
            <div>
              {/* Pinned Note */}
              {(contact.pinnedNote || editingNote) && (
                <div style={{ background: "rgba(192,139,136,0.06)", borderLeft: `3px solid ${ROSE}`, borderRadius: 6, padding: "10px 12px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: ROSE, textTransform: "uppercase", letterSpacing: 0.7, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Pinned Note</span>
                    <button onClick={() => { if (editingNote) { patch({ pinnedNote: noteVal }); setEditingNote(false) } else setEditingNote(true) }} style={{ background: "none", border: "none", color: ROSE, fontSize: 10, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {editingNote ? "Save" : "Edit"}
                    </button>
                  </div>
                  {editingNote ? (
                    <textarea value={noteVal} onChange={(e) => setNoteVal(e.target.value)} rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${ROSE}30`, borderRadius: 6, color: TEXT, padding: "6px 8px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none" }} />
                  ) : (
                    <p style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, margin: 0, fontFamily: "'DM Sans', sans-serif", whiteSpace: "pre-wrap" }}>{contact.pinnedNote}</p>
                  )}
                </div>
              )}

              {/* Status + Channel row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <ESelect label="Status" value={contact.lifecycleStage || ""} options={LIFECYCLE_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] || s }))} onSave={(v) => patch({ lifecycleStage: v })} placeholder="Select stage..." />
                <ESelect label="Channel" value={contact.acquisitionSource || ""} options={ACQUISITION_SOURCES.map((s) => ({ value: s, label: s }))} onSave={(v) => patch({ acquisitionSource: v || null })} placeholder="Select source..." />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <ESelect label="Prospect Owner" value={contact.dealOwner || ""} options={DEAL_OWNERS.map((o) => ({ value: o, label: o }))} onSave={(v) => patch({ dealOwner: v || null })} placeholder="Unassigned" />
                <ESelect label="Outreach Group" value={contact.outreachGroup || ""} options={OUTREACH_GROUPS.map((g) => ({ value: g.id, label: g.short || g.label }))} onSave={(v) => patch({ outreachGroup: v || null })} placeholder="No Group" />
              </div>

              <ESelect label="ICP Fit" value={contact.icpFit || ""} options={ICP_FITS.map((f) => ({ value: f.id, label: f.label }))} onSave={(v) => patch({ icpFit: v || null })} placeholder="Not scored" />

              <EMultiPills label="Verticals" values={contact.vertical || []} options={VERTICALS} onSave={(v) => patch({ vertical: v })} color={ROSE} />
              <EMultiPills label="Sub-Verticals" values={contact.subVertical || []} options={SUB_VERTICALS} onSave={(v) => patch({ subVertical: v })} color="#818CF8" />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <ESelect label="Geo Zone" value={contact.geoZone || ""} options={GEO_ZONES.map((g) => ({ value: g, label: g }))} onSave={(v) => patch({ geoZone: v || null })} placeholder="Select..." />
                <EText label="Company Size" value={contact.companySize || ""} onSave={(v) => patch({ companySize: v })} />
              </div>

              <div style={{ height: 1, background: CARD_BORDER, margin: "8px 0 12px" }} />

              <EText label="Email" value={contact.email || ""} onSave={(v) => patch({ email: v })} isLink="mailto" />
              <EText label="Phone" value={contact.phone || ""} onSave={(v) => patch({ phone: v })} isLink="tel" />
              <EText label="LinkedIn" value={contact.linkedinUrl || ""} onSave={(v) => patch({ linkedinUrl: v })} isUrl />
              <EText label="Job Title" value={contact.jobTitle || ""} onSave={(v) => patch({ jobTitle: v })} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <EText label="Country" value={contact.country || ""} onSave={(v) => patch({ country: v })} />
                <EText label="City" value={contact.city || ""} onSave={(v) => patch({ city: v })} />
              </div>

              <EText label="Next Steps" value={contact.pinnedNote || ""} onSave={(v) => patch({ pinnedNote: v })} />

              {/* Sequence status */}
              {contact.lifecycleStage === "sequence_active" && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(52,211,153,0.06)", borderRadius: 6, border: "1px solid rgba(52,211,153,0.15)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} />
                    <span style={{ fontSize: 11, color: "#34D399", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>Active in Lemlist</span>
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {contact.aiSummary && (
                <div style={{ marginTop: 12 }}>
                  <div style={lbl}>AI Summary</div>
                  <p style={{ fontSize: 12, color: TEXT2, margin: 0, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{contact.aiSummary}</p>
                </div>
              )}
            </div>
          )}

          {/* ══ ACTIVITY TAB ══ */}
          {tab === "activity" && (
            <div>
              {activities.length === 0 ? (
                <div style={{ padding: "32px 0", textAlign: "center", color: TEXT3, fontSize: 12 }}>No activities yet</div>
              ) : (
                activities.map((a: { id: string; type: string; description: string | null; createdAt: string; performedBy: string | null }, i: number) => (
                  <div key={a.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : "none" }}>
                    <span style={{ fontSize: 14, width: 24, textAlign: "center", flexShrink: 0 }}>{ACTIVITY_ICONS[a.type] || "📌"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ fontSize: 12, color: TEXT, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                          {ACTIVITY_TYPES.find((t) => t.id === a.type)?.label || a.type}
                        </span>
                        <span style={{ fontSize: 10, color: TEXT3, whiteSpace: "nowrap" }}>{fmtDateTime(a.createdAt)}</span>
                      </div>
                      {a.description && <p style={{ fontSize: 11, color: TEXT2, margin: "3px 0 0", lineHeight: 1.4 }}>{a.description}</p>}
                      {a.performedBy && <span style={{ fontSize: 9, color: TEXT3 }}>by {a.performedBy}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══ DEALS TAB ══ */}
          {tab === "deals" && (
            <div>
              {deals.length === 0 ? (
                <div style={{ padding: "32px 0", textAlign: "center", color: TEXT3, fontSize: 12 }}>No deals found</div>
              ) : (
                deals.map((d: { id: string; dealName: string; stage: string; dealValue: number | null; dealOwner: string | null; kycStatus?: string }, i: number) => {
                  const dColor = STAGE_COLORS[d.stage] || "#9CA3AF"
                  const dLabel = STAGE_LABELS[d.stage] || d.stage
                  const kycObj = KYC_STATUSES.find((k) => k.id === d.kycStatus)
                  return (
                    <div key={d.id} style={{ padding: "10px 0", borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: TEXT, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{d.dealName}</span>
                        {d.dealValue != null && <span style={{ fontSize: 12, fontFamily: "'Bellfair', serif", color: TEXT }}>{fmtCurrency(d.dealValue)}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <Badge label={dLabel} color={dColor} />
                        {kycObj && <Badge label={kycObj.label} color={kycObj.color} />}
                        {d.dealOwner && <span style={{ fontSize: 10, color: TEXT3 }}>{d.dealOwner}</span>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ══ NOTES TAB ══ */}
          {tab === "notes" && (
            <div>
              {/* Add Note */}
              <div style={{ marginBottom: 16 }}>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  placeholder="Write a note..."
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, color: TEXT, padding: "8px 10px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", marginBottom: 8 }}
                />
                <button onClick={handleAddNote} disabled={addingNote || !noteText.trim()} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: addingNote || !noteText.trim() ? 0.5 : 1 }}>
                  {addingNote ? "Adding..." : "+ Add Note"}
                </button>
              </div>
              {notes.length === 0 ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: TEXT3, fontSize: 12 }}>No notes yet</div>
              ) : (
                notes.map((n: { id: string; description: string | null; createdAt: string; performedBy: string | null }, i: number) => (
                  <div key={n.id} style={{ padding: "10px 0", borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: TEXT3 }}>{n.performedBy || "Unknown"}</span>
                      <span style={{ fontSize: 10, color: TEXT3 }}>{fmtDateTime(n.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: TEXT, margin: 0, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif", whiteSpace: "pre-wrap" }}>{n.description}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══ SUPPORT TAB ══ */}
          {tab === "support" && (
            <div style={{ fontSize: 12, color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>
              <a onClick={() => router.push(`/crm/contacts/${contactId}`)} style={{ color: ROSE, cursor: "pointer", fontSize: 12 }}>Open full page</a> to view support tickets.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
