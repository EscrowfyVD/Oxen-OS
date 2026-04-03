"use client"

import { useState, useEffect, useRef } from "react"
import {
  VERTICALS,
  SUB_VERTICALS,
  GEO_ZONES,
  ACQUISITION_SOURCES,
  CONTACT_TYPES,
  DEAL_OWNERS,
  getOwnerForGeo,
  CRM_COLORS,
} from "@/lib/crm-config"

/* ── Types ── */

interface CrmContact {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  linkedinUrl: string
  jobTitle: string
  company: string
  verticals: string[]
  subVerticals: string[]
  geoZone: string
  acquisitionSource: string
  acquisitionSourceDetail: string
  contactType: string
  dealOwner: string
  telegram: string
  whatsapp: string
  website: string
  country: string
  city: string
  pinnedNote: string
  doNotContact: boolean
}

interface ContactModalProps {
  mode: "create" | "edit"
  contact?: Partial<CrmContact> | null
  onSave: (data: CrmContact) => void
  onClose: () => void
}

/* ── Shared styles ── */

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
}

const modalStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #0D0F14 0%, #0A0B0F 100%)",
  border: `1px solid rgba(255,255,255,0.06)`,
  borderTop: `2px solid ${CRM_COLORS.rose_gold}`,
  borderRadius: 16, padding: 28, width: 620,
  maxHeight: "88vh", overflowY: "auto",
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
  padding: "8px 12px", color: CRM_COLORS.text_primary, fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, textTransform: "uppercase",
  letterSpacing: 1, color: CRM_COLORS.text_tertiary,
  fontFamily: "'DM Sans', sans-serif", marginBottom: 4,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
  color: CRM_COLORS.rose_gold, textTransform: "uppercase", letterSpacing: 1.5,
  marginBottom: 10, marginTop: 18,
}

const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }
const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }

/* ── Component ── */

export default function ContactModal({ mode, contact, onSave, onClose }: ContactModalProps) {
  const [form, setForm] = useState<CrmContact>({
    firstName: "", lastName: "", email: "", phone: "", linkedinUrl: "",
    jobTitle: "", company: "", verticals: [], subVerticals: [], geoZone: "",
    acquisitionSource: "", acquisitionSourceDetail: "", contactType: "prospect",
    dealOwner: "", telegram: "", whatsapp: "", website: "", country: "", city: "",
    pinnedNote: "", doNotContact: false,
  })

  const [companySearch, setCompanySearch] = useState("")
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const companyRef = useRef<HTMLDivElement>(null)

  /* Seed form in edit mode */
  useEffect(() => {
    if (mode === "edit" && contact) {
      setForm((prev) => ({ ...prev, ...contact }))
      setCompanySearch(contact.company || "")
    }
  }, [mode, contact])

  /* Auto-assign deal owner from geoZone */
  useEffect(() => {
    if (form.geoZone) {
      setForm((prev) => ({ ...prev, dealOwner: getOwnerForGeo(prev.geoZone) }))
    }
  }, [form.geoZone])

  /* Company search */
  useEffect(() => {
    if (!companySearch || companySearch.length < 2) {
      setCompanySuggestions([])
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/crm/companies?q=${encodeURIComponent(companySearch)}&limit=8`)
        .then((r) => r.json())
        .then((data) => setCompanySuggestions(data.companies ?? []))
        .catch(() => setCompanySuggestions([]))
    }, 200)
    return () => clearTimeout(t)
  }, [companySearch])

  /* Click outside company dropdown */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const set = (key: keyof CrmContact, val: unknown) => setForm((p) => ({ ...p, [key]: val }))

  const toggleMulti = (key: "verticals" | "subVerticals", val: string) => {
    setForm((prev) => {
      const arr = prev[key]
      return { ...prev, [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] }
    })
  }

  const showSourceDetail = form.acquisitionSource === "Conference" || form.acquisitionSource === "Referral / Introducer"

  const canSave = form.firstName.trim() && form.lastName.trim()

  const handleSubmit = () => {
    if (!canSave) return
    onSave({ ...form, company: companySearch || form.company })
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slideUp" style={modalStyle}>
        {/* Header */}
        <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: CRM_COLORS.text_primary, marginBottom: 20 }}>
          {mode === "edit" ? "Edit Contact" : "New Contact"}
        </div>

        {/* ── Core Info ── */}
        <div style={sectionTitle}>Contact Information</div>
        <div style={grid2}>
          <div>
            <label style={labelStyle}>First Name *</label>
            <input style={inputStyle} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="John" />
          </div>
          <div>
            <label style={labelStyle}>Last Name *</label>
            <input style={inputStyle} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Doe" />
          </div>
        </div>

        <div style={grid2}>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+356 ..." />
          </div>
        </div>

        <div style={grid2}>
          <div>
            <label style={labelStyle}>LinkedIn URL</label>
            <input style={inputStyle} value={form.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>
          <div>
            <label style={labelStyle}>Job Title</label>
            <input style={inputStyle} value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="Managing Director" />
          </div>
        </div>

        {/* ── Company ── */}
        <div style={{ marginBottom: 14, position: "relative" }} ref={companyRef}>
          <label style={labelStyle}>Company</label>
          <input
            style={inputStyle}
            value={companySearch}
            onChange={(e) => { setCompanySearch(e.target.value); setShowCompanyDropdown(true) }}
            onFocus={() => setShowCompanyDropdown(true)}
            placeholder="Search or type new company..."
          />
          {showCompanyDropdown && companySuggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
              background: "#0D0F14", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, marginTop: 4, maxHeight: 160, overflowY: "auto",
            }}>
              {companySuggestions.map((c) => (
                <div key={c} onClick={() => { setCompanySearch(c); set("company", c); setShowCompanyDropdown(false) }}
                  style={{
                    padding: "8px 12px", fontSize: 12, color: CRM_COLORS.text_primary,
                    fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Classification ── */}
        <div style={sectionTitle}>Classification</div>

        {/* Verticals multi-select */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Verticals</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {VERTICALS.map((v) => (
              <label key={v} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                background: form.verticals.includes(v) ? "rgba(192,139,136,0.15)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${form.verticals.includes(v) ? "rgba(192,139,136,0.4)" : "rgba(255,255,255,0.06)"}`,
                color: form.verticals.includes(v) ? CRM_COLORS.rose_gold : CRM_COLORS.text_secondary,
              }}>
                <input type="checkbox" checked={form.verticals.includes(v)} onChange={() => toggleMulti("verticals", v)}
                  style={{ display: "none" }} />
                {form.verticals.includes(v) && <span style={{ fontSize: 10 }}>&#10003;</span>}
                {v}
              </label>
            ))}
          </div>
        </div>

        {/* Sub-Verticals multi-select */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Sub-Verticals</label>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 4,
            maxHeight: 120, overflowY: "auto", padding: 4,
            background: "rgba(255,255,255,0.02)", borderRadius: 8,
          }}>
            {SUB_VERTICALS.map((sv) => (
              <label key={sv} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 5, fontSize: 10, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                background: form.subVerticals.includes(sv) ? "rgba(129,140,248,0.12)" : "transparent",
                border: `1px solid ${form.subVerticals.includes(sv) ? "rgba(129,140,248,0.3)" : "rgba(255,255,255,0.04)"}`,
                color: form.subVerticals.includes(sv) ? CRM_COLORS.indigo : CRM_COLORS.text_tertiary,
              }}>
                <input type="checkbox" checked={form.subVerticals.includes(sv)} onChange={() => toggleMulti("subVerticals", sv)}
                  style={{ display: "none" }} />
                {sv}
              </label>
            ))}
          </div>
        </div>

        <div style={grid3}>
          <div>
            <label style={labelStyle}>Geo Zone</label>
            <select style={inputStyle} value={form.geoZone} onChange={(e) => set("geoZone", e.target.value)}>
              <option value="">Select...</option>
              {GEO_ZONES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Acquisition Source</label>
            <select style={inputStyle} value={form.acquisitionSource} onChange={(e) => set("acquisitionSource", e.target.value)}>
              <option value="">Select...</option>
              {ACQUISITION_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
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

        {/* Contact Type — radio */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Contact Type</label>
          <div style={{ display: "flex", gap: 8 }}>
            {CONTACT_TYPES.map((ct) => (
              <label key={ct} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize",
                background: form.contactType === ct ? "rgba(192,139,136,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${form.contactType === ct ? CRM_COLORS.rose_gold : "rgba(255,255,255,0.06)"}`,
                color: form.contactType === ct ? CRM_COLORS.rose_gold : CRM_COLORS.text_secondary,
              }}>
                <input type="radio" name="contactType" value={ct} checked={form.contactType === ct}
                  onChange={() => set("contactType", ct)} style={{ display: "none" }} />
                {ct}
              </label>
            ))}
          </div>
        </div>

        {/* ── Additional Details ── */}
        <div style={sectionTitle}>Additional Details</div>
        <div style={grid3}>
          <div>
            <label style={labelStyle}>Telegram</label>
            <input style={inputStyle} value={form.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="@handle" />
          </div>
          <div>
            <label style={labelStyle}>WhatsApp</label>
            <input style={inputStyle} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+356 ..." />
          </div>
          <div>
            <label style={labelStyle}>Website</label>
            <input style={inputStyle} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div style={grid2}>
          <div>
            <label style={labelStyle}>Country</label>
            <input style={inputStyle} value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Malta" />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Valletta" />
          </div>
        </div>

        {/* Pinned Note */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Pinned Note</label>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
            value={form.pinnedNote} onChange={(e) => set("pinnedNote", e.target.value)}
            placeholder="Internal note that will be pinned to the contact card..." />
        </div>

        {/* Do Not Contact toggle */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", fontSize: 12,
          }}>
            <div onClick={() => set("doNotContact", !form.doNotContact)}
              style={{
                width: 38, height: 20, borderRadius: 10, position: "relative",
                background: form.doNotContact ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.08)",
                border: `1px solid ${form.doNotContact ? CRM_COLORS.red : "rgba(255,255,255,0.1)"}`,
                transition: "all 0.2s ease", cursor: "pointer",
              }}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                background: form.doNotContact ? CRM_COLORS.red : "rgba(255,255,255,0.3)",
                position: "absolute", top: 2, left: form.doNotContact ? 20 : 2,
                transition: "all 0.2s ease",
              }} />
            </div>
            <span style={{ color: form.doNotContact ? CRM_COLORS.red : CRM_COLORS.text_secondary }}>
              Do Not Contact
            </span>
          </label>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.06)", background: "transparent",
              color: CRM_COLORS.text_secondary, fontSize: 11,
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
            {mode === "edit" ? "Save Changes" : "Create Contact"}
          </button>
        </div>
      </div>
    </div>
  )
}
