"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  STAGE_COLORS, STAGE_LABELS, ACTIVITY_ICONS, ACTIVITY_TYPES,
  ICP_FITS, RELATIONSHIP_STRENGTHS, OWNER_COLORS, KYC_STATUSES,
  VERTICALS, SUB_VERTICALS, GEO_ZONES, DEAL_OWNERS,
  ACQUISITION_SOURCES, CRM_COLORS, fmtCurrency,
} from "@/lib/crm-config"

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

/* ── Inline Editable Field ── */
function InlineField({ label, value, onSave, type = "text" }: { label: string; value: string; onSave: (v: string) => void; type?: string }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  useEffect(() => { setVal(value) }, [value])
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      {editing ? (
        <input
          type={type}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => { setEditing(false); if (val !== value) onSave(val) }}
          onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (val !== value) onSave(val) } if (e.key === "Escape") { setEditing(false); setVal(value) } }}
          autoFocus
          style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${ROSE}40`, borderRadius: 6, color: TEXT, padding: "5px 8px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
        />
      ) : (
        <div onClick={() => setEditing(true)} style={{ fontSize: 13, color: value ? TEXT : TEXT3, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "4px 0", borderBottom: `1px dashed ${CARD_BORDER}`, minHeight: 22 }}>
          {value || "Click to add"}
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
   CONTACT DETAIL PAGE
   ════════════════════════════════════════════════════════════════ */
export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contact, setContact] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"activity" | "deals" | "emails" | "files" | "signals">("activity")

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

  useEffect(() => { fetchContact() }, [fetchContact])

  useEffect(() => {
    if (activeTab === "activity") fetchActivities()
    else if (activeTab === "deals") fetchDeals()
    else if (activeTab === "emails") fetchEmails()
    else if (activeTab === "files") fetchFiles()
    else if (activeTab === "signals") fetchSignals()
  }, [activeTab, fetchActivities, fetchDeals, fetchEmails, fetchFiles, fetchSignals])

  /* ── Patch helper ── */
  const patchContact = async (fields: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (data.contact) setContact((prev: typeof contact) => ({ ...prev, ...data.contact }))
    } catch { /* ignore */ }
  }

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to permanently delete this contact?")) return
    try {
      await fetch(`/api/crm/contacts/${id}`, { method: "DELETE" })
      router.push("/crm/contacts")
    } catch { /* ignore */ }
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
              <button onClick={() => router.push(`/crm/contacts/${id}/edit`)} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.04)", color: TEXT, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Edit
              </button>
              <button onClick={handleDelete} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#F87171", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Delete
              </button>
            </div>
            {/* Do Not Contact toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 11, color: contact.doNotContact ? "#F87171" : TEXT3, fontFamily: "'DM Sans', sans-serif" }}>Do Not Contact</span>
              <div
                onClick={() => patchContact({ doNotContact: !contact.doNotContact })}
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

      {/* ════ BODY: Two-Column Layout ════ */}
      <div style={{ display: "flex", gap: 24, padding: "24px 32px", alignItems: "flex-start" }}>
        {/* ──── LEFT COLUMN (65%) ──── */}
        <div style={{ flex: "0 0 65%", maxWidth: "65%", display: "flex", flexDirection: "column", gap: 20 }}>
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
            {(["activity", "deals", "emails", "files", "signals"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "7px 16px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, border: "none", borderRadius: 6, cursor: "pointer", transition: "all 0.15s", background: activeTab === tab ? `${ROSE}22` : "transparent", color: activeTab === tab ? TEXT : TEXT2, textTransform: "capitalize" }}>
                {tab === "activity" ? "Activity" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Tab: Activity Timeline ── */}
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

          {/* ── Tab: Deals ── */}
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

          {/* ── Tab: Emails ── */}
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

          {/* ── Tab: Files ── */}
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

          {/* ── Tab: Signals ── */}
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

        {/* ──── RIGHT COLUMN (35%) ──── */}
        <div style={{ flex: "0 0 calc(35% - 24px)", maxWidth: "calc(35% - 24px)", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Contact Info Card ── */}
          <GlassCard>
            <h4 style={{ fontSize: 12, color: ROSE, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Contact Info</h4>
            <InlineField label="Email" value={contact.email || ""} onSave={(v) => patchContact({ email: v })} type="email" />
            <InlineField label="Phone" value={contact.phone || ""} onSave={(v) => patchContact({ phone: v })} type="tel" />
            <InlineField label="LinkedIn" value={contact.linkedinUrl || ""} onSave={(v) => patchContact({ linkedinUrl: v })} />
            <InlineField label="Company" value={companyName} onSave={() => {}} />
            <InlineField label="Job Title" value={contact.jobTitle || ""} onSave={(v) => patchContact({ jobTitle: v })} />
          </GlassCard>

          {/* ── Classification Card ── */}
          <GlassCard>
            <h4 style={{ fontSize: 12, color: ROSE, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Classification</h4>

            {/* Verticals */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Verticals</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(contact.vertical || []).length > 0 ? (contact.vertical as string[]).map((v: string) => (
                  <Badge key={v} label={v} color={ROSE} />
                )) : <span style={{ fontSize: 11, color: TEXT3 }}>None</span>}
              </div>
            </div>

            {/* Sub-verticals */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Sub-Verticals</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(contact.subVertical || []).length > 0 ? (contact.subVertical as string[]).map((v: string) => (
                  <Badge key={v} label={v} color="#818CF8" />
                )) : <span style={{ fontSize: 11, color: TEXT3 }}>None</span>}
              </div>
            </div>

            <InlineField label="Geo Zone" value={contact.geoZone || ""} onSave={(v) => patchContact({ geoZone: v })} />
            <InlineField label="Acquisition Source" value={contact.acquisitionSource || ""} onSave={(v) => patchContact({ acquisitionSource: v })} />

            {/* ICP Fit */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>ICP Fit</div>
              <div style={{ display: "flex", gap: 4 }}>
                {ICP_FITS.map((fit) => (
                  <button key={fit.id} onClick={() => patchContact({ icpFit: fit.id })} style={{ padding: "4px 10px", borderRadius: 16, border: contact.icpFit === fit.id ? `1px solid ${fit.color}` : `1px solid ${CARD_BORDER}`, background: contact.icpFit === fit.id ? fit.bg : "transparent", color: contact.icpFit === fit.id ? fit.color : TEXT3, fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    {fit.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deal Owner */}
            <div>
              <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Deal Owner</div>
              <div style={{ display: "flex", gap: 4 }}>
                {DEAL_OWNERS.map((o) => (
                  <button key={o} onClick={() => patchContact({ dealOwner: o })} style={{ padding: "4px 10px", borderRadius: 16, border: contact.dealOwner === o ? `1px solid ${OWNER_COLORS[o]}` : `1px solid ${CARD_BORDER}`, background: contact.dealOwner === o ? `${OWNER_COLORS[o]}18` : "transparent", color: contact.dealOwner === o ? OWNER_COLORS[o] : TEXT3, fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* ── Enrichment Card ── */}
          <GlassCard>
            <h4 style={{ fontSize: 12, color: ROSE, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Enrichment</h4>
            <InlineField label="Company Size" value={contact.companySize || ""} onSave={(v) => patchContact({ companySize: v })} />
            <InlineField label="Funding Stage" value={contact.fundingStage || ""} onSave={(v) => patchContact({ fundingStage: v })} />
            <InlineField label="Tech Stack" value={(contact.techStack || []).join(", ")} onSave={(v) => patchContact({ techStack: v.split(",").map((s: string) => s.trim()).filter(Boolean) })} />
            <InlineField label="Revenue Range" value={contact.annualRevenueRange || ""} onSave={(v) => patchContact({ annualRevenueRange: v })} />
            <InlineField label="Country" value={contact.country || ""} onSave={(v) => patchContact({ country: v })} />
            <InlineField label="City" value={contact.city || ""} onSave={(v) => patchContact({ city: v })} />
          </GlassCard>

          {/* ── Smart Fields Card ── */}
          <GlassCard>
            <h4 style={{ fontSize: 12, color: ROSE, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Smart Fields</h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
              <div>
                <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Last Interaction</div>
                <div style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{fmtDate(contact.lastInteraction)}</div>
                <div style={{ fontSize: 10, color: TEXT3 }}>{relativeTime(contact.lastInteraction)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Days Since Contact</div>
                <div style={{ fontSize: 22, fontFamily: "'Bellfair', serif", color: daysSince != null && daysSince > 14 ? "#F87171" : daysSince != null && daysSince > 7 ? "#FBBF24" : "#34D399" }}>
                  {daysSince != null ? daysSince : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Next Meeting</div>
                <div style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{fmtDate(contact.nextScheduledMeeting)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Total Interactions</div>
                <div style={{ fontSize: 22, fontFamily: "'Bellfair', serif", color: TEXT }}>{contact.totalInteractions ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Avg Response Time</div>
                <div style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>
                  {contact.avgResponseTimeHours != null ? `${contact.avgResponseTimeHours}h` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Relationship</div>
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

          {/* ── AI Summary Card ── */}
          <GlassCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ fontSize: 12, color: ROSE, textTransform: "uppercase", letterSpacing: 0.8, margin: 0, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>AI Summary</h4>
              <button onClick={() => patchContact({ aiSummary: null })} style={{ background: "none", border: "none", color: TEXT3, fontSize: 10, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Regenerate</button>
            </div>
            <p style={{ fontSize: 13, color: contact.aiSummary ? TEXT : TEXT3, margin: 0, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
              {contact.aiSummary || "No AI summary available. Click Regenerate to create one."}
            </p>
          </GlassCard>

          {/* ── Introducer Info (conditional) ── */}
          {contact.contactType === "introducer" && (
            <GlassCard>
              <h4 style={{ fontSize: 12, color: ROSE, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Introducer Info</h4>
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
