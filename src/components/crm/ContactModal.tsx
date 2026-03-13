"use client"

import { useState, useEffect } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_TERTIARY, RED, FROST,
  SECTORS, STATUSES, SOURCES, SEGMENTS, labelStyle,
  LEAD_SOURCES, CLIENT_TYPES, OUTREACH_STATUSES,
} from "./constants"
import type { Contact, Employee, ContactFormData, Agent } from "./types"

interface ContactModalProps {
  show: boolean
  onClose: () => void
  contact: Contact | null
  employees: Employee[]
  onSaved: () => void
}

const emptyForm: ContactFormData = {
  name: "",
  email: "",
  phone: "",
  company: "",
  sector: "",
  status: "lead",
  source: "",
  value: "",
  currency: "EUR",
  assignedTo: "",
  country: "",
  telegram: "",
  whatsapp: "",
  website: "",
  notes: "",
  healthStatus: "healthy",
  monthlyGtv: "",
  monthlyRevenue: "",
  takeRate: "",
  segment: "",
  projectedVolume: "",
  clientType: "",
  vertical: "",
  leadSource: "",
  outreachStatus: "",
  agentId: "",
}

export default function ContactModal({ show, onClose, contact, employees, onSaved }: ContactModalProps) {
  const [form, setForm] = useState<ContactFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showCro, setShowCro] = useState(false)
  const [showGtm, setShowGtm] = useState(false)
  const [showResearchPrompt, setShowResearchPrompt] = useState(false)
  const [newContactId, setNewContactId] = useState<string | null>(null)
  const [researchingCompany, setResearchingCompany] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    if (show) {
      fetch("/api/agents?status=active")
        .then((r) => r.json())
        .then((data) => setAgents(data.agents ?? []))
        .catch(() => {})
    }
  }, [show])

  useEffect(() => {
    if (contact) {
      setForm({
        name: contact.name,
        email: contact.email || "",
        phone: contact.phone || "",
        company: contact.company || "",
        sector: contact.sector || "",
        status: contact.status,
        source: contact.source || "",
        value: contact.value != null ? String(contact.value) : "",
        currency: contact.currency || "EUR",
        assignedTo: contact.assignedTo || "",
        country: contact.country || "",
        telegram: contact.telegram || "",
        whatsapp: contact.whatsapp || "",
        website: contact.website || "",
        notes: contact.notes || "",
        healthStatus: contact.healthStatus || "healthy",
        monthlyGtv: contact.monthlyGtv != null ? String(contact.monthlyGtv) : "",
        monthlyRevenue: contact.monthlyRevenue != null ? String(contact.monthlyRevenue) : "",
        takeRate: contact.takeRate != null ? String(contact.takeRate) : "",
        segment: contact.segment || "",
        projectedVolume: contact.projectedVolume != null ? String(contact.projectedVolume) : "",
        clientType: contact.clientType || "",
        vertical: contact.vertical || "",
        leadSource: contact.leadSource || "",
        outreachStatus: contact.outreachStatus || "",
        agentId: contact.agentId || "",
      })
      if (contact.monthlyGtv || contact.monthlyRevenue || contact.takeRate || contact.segment) {
        setShowCro(true)
      }
      if (contact.clientType || contact.leadSource || contact.outreachStatus || contact.agentId || contact.vertical) {
        setShowGtm(true)
      }
    } else {
      setForm(emptyForm)
      setShowCro(false)
      setShowGtm(false)
    }
  }, [contact, show])

  if (!show) return null

  const set = (key: keyof ContactFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const doResearchCompany = async (cId: string) => {
    setResearchingCompany(true)
    try {
      await fetch(`/api/ai/research/${cId}`, { method: "POST" })
    } catch { /* silent */ }
    setResearchingCompany(false)
    setShowResearchPrompt(false)
    onSaved()
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)

    try {
      const url = contact ? `/api/contacts/${contact.id}` : "/api/contacts"
      const method = contact ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
          sector: form.sector || null,
          status: form.status,
          source: form.source || null,
          value: form.value ? form.value : null,
          currency: form.currency,
          assignedTo: form.assignedTo || null,
          country: form.country.trim() || null,
          telegram: form.telegram.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          website: form.website.trim() || null,
          notes: form.notes.trim() || null,
          healthStatus: form.healthStatus || "healthy",
          monthlyGtv: form.monthlyGtv || null,
          monthlyRevenue: form.monthlyRevenue || null,
          takeRate: form.takeRate || null,
          segment: form.segment || null,
          projectedVolume: form.projectedVolume || null,
          clientType: form.clientType || null,
          vertical: form.vertical?.trim() || null,
          leadSource: form.leadSource || null,
          outreachStatus: form.outreachStatus || null,
          agentId: form.agentId || null,
        }),
      })

      /* If new contact with a company name, offer auto-research */
      if (!contact && form.company.trim()) {
        const data = await res.json()
        if (data.contact?.id) {
          setNewContactId(data.contact.id)
          setShowResearchPrompt(true)
          setSaving(false)
          return
        }
      }

      onSaved()
    } catch {
      /* silent */
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contact) return
    setSaving(true)
    try {
      await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" })
      onSaved()
    } catch {
      /* silent */
    } finally {
      setSaving(false)
    }
  }

  return (
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
        if (e.target === e.currentTarget) onClose()
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
            {contact ? "Edit Contact" : "New Contact"}
          </span>
          <button
            onClick={onClose}
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
          {/* Row 1: Name, Company */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input className="oxen-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Contact name" autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Company</label>
              <input className="oxen-input" value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Company name" />
            </div>
          </div>

          {/* Row 2: Email, Phone */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input className="oxen-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input className="oxen-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+971..." />
            </div>
          </div>

          {/* Row 3: Sector, Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Sector</label>
              <select className="oxen-input" value={form.sector} onChange={(e) => set("sector", e.target.value)} style={{ appearance: "none" }}>
                <option value="">Select sector...</option>
                {SECTORS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="oxen-input" value={form.status} onChange={(e) => set("status", e.target.value)} style={{ appearance: "none" }}>
                {STATUSES.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
              </select>
            </div>
          </div>

          {/* Row 4: Source, Value + Currency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Source</label>
              <select className="oxen-input" value={form.source} onChange={(e) => set("source", e.target.value)} style={{ appearance: "none" }}>
                <option value="">Select source...</option>
                {SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Deal Value</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="oxen-input" type="number" value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="0" style={{ flex: 1 }} />
                <select className="oxen-input" value={form.currency} onChange={(e) => set("currency", e.target.value)} style={{ width: 70, appearance: "none" }}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="AED">AED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 5: Assigned To, Country */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Assigned To</label>
              <select className="oxen-input" value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} style={{ appearance: "none" }}>
                <option value="">Unassigned</option>
                {employees.map((emp) => (<option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <input className="oxen-input" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="e.g. UAE, Malta..." />
            </div>
          </div>

          {/* Row 6: Telegram, WhatsApp */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Telegram</label>
              <input className="oxen-input" value={form.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="@handle" />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp</label>
              <input className="oxen-input" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+971..." />
            </div>
          </div>

          {/* Row 7: Website */}
          <div>
            <label style={labelStyle}>Website</label>
            <input className="oxen-input" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." />
          </div>

          {/* ── CRO Section Toggle ── */}
          <div
            onClick={() => setShowCro(!showCro)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              padding: "6px 0",
              borderTop: "1px solid rgba(255,255,255,0.03)",
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 12, color: TEXT_TERTIARY, transition: "transform 0.2s", transform: showCro ? "rotate(180deg)" : "rotate(0)" }}>
              ▾
            </span>
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>
              Revenue Intelligence
            </span>
          </div>

          {showCro && (
            <>
              {/* CRO Row 1: Segment, Health Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Segment</label>
                  <select className="oxen-input" value={form.segment} onChange={(e) => set("segment", e.target.value)} style={{ appearance: "none" }}>
                    <option value="">Select segment...</option>
                    {SEGMENTS.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Health Status</label>
                  <select className="oxen-input" value={form.healthStatus} onChange={(e) => set("healthStatus", e.target.value)} style={{ appearance: "none" }}>
                    <option value="healthy">Healthy</option>
                    <option value="watch">Watch</option>
                    <option value="at_risk">At Risk</option>
                    <option value="declining">Declining</option>
                    <option value="churned">Churned</option>
                  </select>
                </div>
              </div>

              {/* CRO Row 2: Monthly GTV, Monthly Revenue */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Monthly GTV (€)</label>
                  <input className="oxen-input" type="number" value={form.monthlyGtv} onChange={(e) => set("monthlyGtv", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={labelStyle}>Monthly Revenue (€)</label>
                  <input className="oxen-input" type="number" value={form.monthlyRevenue} onChange={(e) => set("monthlyRevenue", e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* CRO Row 3: Take Rate, Projected Volume */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Take Rate (%)</label>
                  <input className="oxen-input" type="number" step="0.01" value={form.takeRate} onChange={(e) => set("takeRate", e.target.value)} placeholder="1.0" />
                </div>
                <div>
                  <label style={labelStyle}>Projected Volume (€)</label>
                  <input className="oxen-input" type="number" value={form.projectedVolume} onChange={(e) => set("projectedVolume", e.target.value)} placeholder="0" />
                </div>
              </div>
            </>
          )}

          {/* ── GTM Section Toggle ── */}
          <div
            onClick={() => setShowGtm(!showGtm)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              padding: "6px 0",
              borderTop: "1px solid rgba(255,255,255,0.03)",
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 12, color: TEXT_TERTIARY, transition: "transform 0.2s", transform: showGtm ? "rotate(180deg)" : "rotate(0)" }}>
              {"\u25BE"}
            </span>
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>
              GTM &amp; Outreach
            </span>
          </div>

          {showGtm && (
            <>
              {/* GTM Row 1: Agent, Client Type */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Agent / Referrer</label>
                  <select className="oxen-input" value={form.agentId} onChange={(e) => set("agentId", e.target.value)} style={{ appearance: "none" }}>
                    <option value="">No agent</option>
                    {agents.map((a) => (<option key={a.id} value={a.id}>{a.name}{a.company ? ` (${a.company})` : ""}</option>))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Client Type</label>
                  <select className="oxen-input" value={form.clientType} onChange={(e) => set("clientType", e.target.value)} style={{ appearance: "none" }}>
                    <option value="">Select type...</option>
                    {CLIENT_TYPES.map((t) => (<option key={t} value={t}>{t.replace(/_/g, " ")}</option>))}
                  </select>
                </div>
              </div>

              {/* GTM Row 2: Lead Source, Outreach Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Lead Source</label>
                  <select className="oxen-input" value={form.leadSource} onChange={(e) => set("leadSource", e.target.value)} style={{ appearance: "none" }}>
                    <option value="">Select source...</option>
                    {LEAD_SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Outreach Status</label>
                  <select className="oxen-input" value={form.outreachStatus} onChange={(e) => set("outreachStatus", e.target.value)} style={{ appearance: "none" }}>
                    <option value="">Select status...</option>
                    {OUTREACH_STATUSES.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
                  </select>
                </div>
              </div>

              {/* GTM Row 3: Vertical */}
              <div>
                <label style={labelStyle}>Vertical</label>
                <input className="oxen-input" value={form.vertical} onChange={(e) => set("vertical", e.target.value)} placeholder="e.g. Payments, SaaS..." />
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              className="oxen-input"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Add notes about this contact..."
              rows={3}
              style={{ resize: "vertical", minHeight: 60, fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
        </div>

        {/* Research Prompt */}
        {showResearchPrompt && newContactId && (
          <div style={{
            margin: "0 20px 16px",
            padding: 16,
            background: "linear-gradient(135deg, rgba(192,139,136,0.08), rgba(15,17,24,1))",
            border: "1px solid rgba(192,139,136,0.2)",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>{"\uD83D\uDEE1\uFE0F"}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#C08B88", fontFamily: "'DM Sans', sans-serif" }}>
                Research {form.company}?
              </span>
            </div>
            <p style={{ fontSize: 11, color: "rgba(240,240,242,0.55)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, margin: "0 0 12px" }}>
              Sentinel can research this company to find key people, recent news, industry data, and more.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => doResearchCompany(newContactId)}
                disabled={researchingCompany}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif", cursor: researchingCompany ? "wait" : "pointer",
                  background: "linear-gradient(135deg, rgba(192,139,136,0.2), rgba(192,139,136,0.1))",
                  border: "1px solid rgba(192,139,136,0.3)", color: "#C08B88",
                }}
              >
                {researchingCompany ? "Researching..." : "\uD83D\uDD0D Research Company"}
              </button>
              <button
                onClick={() => { setShowResearchPrompt(false); onSaved() }}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 11,
                  fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                  background: "none", border: `1px solid ${CARD_BORDER}`,
                  color: TEXT_TERTIARY,
                }}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        {!showResearchPrompt && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px 20px",
          }}
        >
          <div>
            {contact && (
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
            <button className="btn-secondary" onClick={onClose} style={{ padding: "8px 18px" }}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
              style={{ padding: "8px 18px" }}
            >
              {saving ? "Saving..." : contact ? "Save Changes" : "Create Contact"}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
