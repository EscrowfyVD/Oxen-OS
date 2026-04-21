"use client"

import { useState, useEffect, useMemo } from "react"
import {
  PIPELINE_STAGES,
  DEAL_OWNERS,
  ACQUISITION_SOURCES,
  KYC_STATUSES,
  VERTICALS,
  STAGE_PROBABILITY,
  STAGE_LABELS,
  fmtCurrencyFull,
} from "@/lib/crm-config"

/* ── Types ── */

interface DealData {
  id?: string
  dealName: string
  contactId: string
  dealValue: number | string
  stage: string
  dealOwner: string
  expectedCloseDate: string
  acquisitionSource: string
  acquisitionSourceDetail: string
  kycStatus: string
  notes: string
  verticals: string[]
  winProbability: number | string
}

interface ContactOption {
  id: string
  firstName?: string
  lastName?: string
  name?: string
  company?: string | null
}

interface DealModalProps {
  mode: "create" | "edit"
  deal?: Partial<DealData> | null
  contacts: ContactOption[]
  onSave: (data: DealData) => void
  onClose: () => void
}

/* ── Shared Styles ── */

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
}

const modalStyle: React.CSSProperties = {
  background: "var(--modal-bg)",
  border: "1px solid var(--border)",
  borderTop: "2px solid var(--rose-gold)",
  borderRadius: 16, padding: 28, width: 580,
  maxHeight: "88vh", overflowY: "auto",
  color: "var(--text-primary)",
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--surface-elevated)",
  border: "1px solid var(--border)", borderRadius: 8,
  padding: "8px 12px", color: "var(--text-primary)", fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, textTransform: "uppercase",
  letterSpacing: 1, color: "var(--text-tertiary)",
  fontFamily: "'DM Sans', sans-serif", marginBottom: 4,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
  color: "var(--rose-gold)", textTransform: "uppercase", letterSpacing: 1.5,
  marginBottom: 10, marginTop: 18,
}

const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }
const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }

/* ── Component ── */

export default function DealModal({ mode, deal, contacts, onSave, onClose }: DealModalProps) {
  const [form, setForm] = useState<DealData>({
    dealName: "", contactId: "", dealValue: "", stage: "new_lead",
    dealOwner: "", expectedCloseDate: "", acquisitionSource: "",
    acquisitionSourceDetail: "", kycStatus: "not_started", notes: "",
    verticals: [], winProbability: "",
  })

  const [contactSearch, setContactSearch] = useState("")

  /* Seed form in edit mode */
  useEffect(() => {
    if (mode === "edit" && deal) {
      setForm((prev) => ({ ...prev, ...deal }))
      if (deal.contactId) {
        const c = contacts.find((ct) => ct.id === deal.contactId)
        if (c) setContactSearch(c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim())
      }
    }
  }, [mode, deal, contacts])

  /* Auto-set probability when stage changes (only if user hasn't manually edited) */
  const [probManuallySet, setProbManuallySet] = useState(false)
  useEffect(() => {
    if (!probManuallySet && form.stage) {
      const auto = STAGE_PROBABILITY[form.stage]
      if (auto !== undefined) {
        setForm((p) => ({ ...p, winProbability: auto }))
      }
    }
  }, [form.stage, probManuallySet])

  /* Filtered contacts for search */
  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts.slice(0, 20)
    const q = contactSearch.toLowerCase()
    return contacts.filter((c) => {
      const name = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim()
      return name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q)
    }).slice(0, 20)
  }, [contactSearch, contacts])

  const set = (key: keyof DealData, val: unknown) => setForm((p) => ({ ...p, [key]: val }))

  const toggleVertical = (v: string) => {
    setForm((prev) => ({
      ...prev,
      verticals: prev.verticals.includes(v) ? prev.verticals.filter((x) => x !== v) : [...prev.verticals, v],
    }))
  }

  /* Computed values */
  const numericValue = Number(form.dealValue) || 0
  const numericProb = Number(form.winProbability) || 0
  const weightedValue = numericValue * numericProb

  const showSourceDetail = form.acquisitionSource === "Conference" || form.acquisitionSource === "Referral / Introducer"

  /* Auto-generate deal name */
  const autoName = useMemo(() => {
    if (form.dealName) return form.dealName
    const c = contacts.find((ct) => ct.id === form.contactId)
    if (!c) return ""
    const name = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim()
    return c.company ? `${name} - ${c.company}` : name
  }, [form.dealName, form.contactId, contacts])

  const canSave = form.contactId && (form.dealName || autoName)

  const handleSubmit = () => {
    if (!canSave) return
    onSave({
      ...form,
      dealName: form.dealName || autoName,
      winProbability: numericProb,
    })
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slideUp" style={modalStyle}>
        {/* Header */}
        <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: "var(--text-primary)", marginBottom: 20 }}>
          {mode === "edit" ? "Edit Deal" : "New Deal"}
        </div>

        {/* ── Deal Info ── */}
        <div style={sectionTitle}>Deal Information</div>

        {/* Contact selector */}
        <div style={{ marginBottom: 14, position: "relative" }}>
          <label style={labelStyle}>Contact *</label>
          <input
            style={inputStyle}
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search contact by name or company..."
          />
          {contactSearch && filteredContacts.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
              background: "var(--card-bg-solid)", border: "1px solid var(--border-active)",
              borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: "auto",
            }}>
              {filteredContacts.map((c) => {
                const name = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim()
                return (
                  <div key={c.id}
                    onClick={() => {
                      set("contactId", c.id)
                      setContactSearch(name)
                    }}
                    style={{
                      padding: "8px 12px", fontSize: 12, color: "var(--text-primary)",
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-input)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {name}{c.company ? <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>{c.company}</span> : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Deal Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Deal Name</label>
          <input style={inputStyle} value={form.dealName}
            onChange={(e) => set("dealName", e.target.value)}
            placeholder={autoName || "Auto-generated from contact + company"} />
          {!form.dealName && autoName && (
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>
              Will be saved as: {autoName}
            </div>
          )}
        </div>

        <div style={grid3}>
          <div>
            <label style={labelStyle}>Deal Value</label>
            <input style={inputStyle} type="number" step="0.01" value={form.dealValue}
              onChange={(e) => set("dealValue", e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label style={labelStyle}>Stage</label>
            <select style={inputStyle} value={form.stage} onChange={(e) => { set("stage", e.target.value); setProbManuallySet(false) }}>
              {PIPELINE_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Deal Owner</label>
            <select style={inputStyle} value={form.dealOwner} onChange={(e) => set("dealOwner", e.target.value)}>
              <option value="">Select...</option>
              {DEAL_OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div style={grid3}>
          <div>
            <label style={labelStyle}>Expected Close Date</label>
            <input style={{ ...inputStyle, colorScheme: "dark" }} type="date" value={form.expectedCloseDate}
              onChange={(e) => set("expectedCloseDate", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Win Probability</label>
            <div style={{ position: "relative" }}>
              <input style={inputStyle} type="number" step="0.01" min="0" max="1"
                value={form.winProbability}
                onChange={(e) => { set("winProbability", e.target.value); setProbManuallySet(true) }}
                placeholder="0.00" />
              <span style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', sans-serif",
              }}>
                {(numericProb * 100).toFixed(0)}%
              </span>
            </div>
            {form.stage && STAGE_LABELS[form.stage] && (
              <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                Stage default: {((STAGE_PROBABILITY[form.stage] || 0) * 100).toFixed(0)}%
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Weighted Value</label>
            <div style={{
              ...inputStyle, background: "var(--surface-subtle)", cursor: "default",
              fontFamily: "'Bellfair', serif", fontSize: 14, color: "var(--green)",
            }}>
              {fmtCurrencyFull(weightedValue)}
            </div>
          </div>
        </div>

        {/* ── Classification ── */}
        <div style={sectionTitle}>Classification</div>

        <div style={grid2}>
          <div>
            <label style={labelStyle}>Acquisition Source</label>
            <select style={inputStyle} value={form.acquisitionSource}
              onChange={(e) => set("acquisitionSource", e.target.value)}>
              <option value="">Select...</option>
              {ACQUISITION_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>KYC Status</label>
            <select style={inputStyle} value={form.kycStatus}
              onChange={(e) => set("kycStatus", e.target.value)}>
              {KYC_STATUSES.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>
        </div>

        {showSourceDetail && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              {form.acquisitionSource === "Conference" ? "Conference Name" : "Referrer / Introducer Name"}
            </label>
            <input style={inputStyle} value={form.acquisitionSourceDetail}
              onChange={(e) => set("acquisitionSourceDetail", e.target.value)}
              placeholder={form.acquisitionSource === "Conference" ? "e.g. SiGMA Malta 2026" : "e.g. John Smith"} />
          </div>
        )}

        {/* Verticals */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Verticals</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {VERTICALS.map((v) => (
              <label key={v} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                background: form.verticals.includes(v) ? "var(--rose-gold)" : "var(--surface-input)",
                border: form.verticals.includes(v) ? "1px solid transparent" : "1px solid var(--border)",
                color: form.verticals.includes(v) ? "#fff" : "var(--text-secondary)",
              }}>
                <input type="checkbox" checked={form.verticals.includes(v)} onChange={() => toggleVertical(v)}
                  style={{ display: "none" }} />
                {form.verticals.includes(v) && <span style={{ fontSize: 10 }}>&#10003;</span>}
                {v}
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
            value={form.notes} onChange={(e) => set("notes", e.target.value)}
            placeholder="Deal context, next steps, blockers..." />
        </div>

        {/* ── Actions ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-secondary)", fontSize: 11,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            }}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="btn-primary"
            disabled={!canSave}
            style={{
              padding: "8px 20px", fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              opacity: canSave ? 1 : 0.5, cursor: canSave ? "pointer" : "not-allowed",
            }}>
            {mode === "edit" ? "Save Changes" : "Create Deal"}
          </button>
        </div>
      </div>
    </div>
  )
}
