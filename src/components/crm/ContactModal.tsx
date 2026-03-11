"use client"

import { useState, useEffect } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_TERTIARY, RED, FROST,
  SECTORS, STATUSES, SOURCES, labelStyle,
} from "./constants"
import type { Contact, Employee, ContactFormData } from "./types"

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
}

export default function ContactModal({ show, onClose, contact, employees, onSaved }: ContactModalProps) {
  const [form, setForm] = useState<ContactFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

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
      })
    } else {
      setForm(emptyForm)
    }
  }, [contact, show])

  if (!show) return null

  const set = (key: keyof ContactFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)

    try {
      const url = contact ? `/api/contacts/${contact.id}` : "/api/contacts"
      const method = contact ? "PATCH" : "POST"

      await fetch(url, {
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
        }),
      })
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
          <span
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 18,
              color: FROST,
            }}
          >
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
              <input
                className="oxen-input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Contact name"
                autoFocus
              />
            </div>
            <div>
              <label style={labelStyle}>Company</label>
              <input
                className="oxen-input"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Company name"
              />
            </div>
          </div>

          {/* Row 2: Email, Phone */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                className="oxen-input"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                className="oxen-input"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+971..."
              />
            </div>
          </div>

          {/* Row 3: Sector, Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Sector</label>
              <select
                className="oxen-input"
                value={form.sector}
                onChange={(e) => set("sector", e.target.value)}
                style={{ appearance: "none" }}
              >
                <option value="">Select sector...</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                className="oxen-input"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                style={{ appearance: "none" }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Source, Value + Currency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Source</label>
              <select
                className="oxen-input"
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                style={{ appearance: "none" }}
              >
                <option value="">Select source...</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Deal Value</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="oxen-input"
                  type="number"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder="0"
                  style={{ flex: 1 }}
                />
                <select
                  className="oxen-input"
                  value={form.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  style={{ width: 70, appearance: "none" }}
                >
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
              <select
                className="oxen-input"
                value={form.assignedTo}
                onChange={(e) => set("assignedTo", e.target.value)}
                style={{ appearance: "none" }}
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} — {emp.role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <input
                className="oxen-input"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                placeholder="e.g. UAE, Malta..."
              />
            </div>
          </div>

          {/* Row 6: Telegram, WhatsApp */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Telegram</label>
              <input
                className="oxen-input"
                value={form.telegram}
                onChange={(e) => set("telegram", e.target.value)}
                placeholder="@handle"
              />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp</label>
              <input
                className="oxen-input"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                placeholder="+971..."
              />
            </div>
          </div>

          {/* Row 7: Website */}
          <div>
            <label style={labelStyle}>Website</label>
            <input
              className="oxen-input"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Row 8: Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              className="oxen-input"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Add notes about this contact..."
              rows={3}
              style={{
                resize: "vertical",
                minHeight: 60,
                fontFamily: "'DM Sans', sans-serif",
              }}
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(248,113,113,0.15)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(248,113,113,0.08)"
                }}
              >
                Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn-secondary"
              onClick={onClose}
              style={{ padding: "8px 18px" }}
            >
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
      </div>
    </div>
  )
}
