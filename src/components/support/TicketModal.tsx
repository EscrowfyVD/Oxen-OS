"use client"

import { useState } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_TERTIARY,
  CHANNELS, CATEGORIES, PRIORITIES,
  labelStyle, inputStyle,
} from "./constants"
import type { Employee } from "./types"

interface TicketModalProps {
  employees: Employee[]
  onClose: () => void
  onSave: () => void
}

interface TicketForm {
  subject: string
  clientName: string
  clientEmail: string
  channel: string
  category: string
  priority: string
  assignedTo: string
  initialMessage: string
}

const emptyForm: TicketForm = {
  subject: "", clientName: "", clientEmail: "",
  channel: "email", category: "", priority: "medium",
  assignedTo: "", initialMessage: "",
}

export default function TicketModal({ employees, onClose, onSave }: TicketModalProps) {
  const [form, setForm] = useState<TicketForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof TicketForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.subject.trim() || !form.clientName.trim()) return
    setSaving(true)
    try {
      await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject.trim(),
          clientName: form.clientName.trim(),
          clientEmail: form.clientEmail || null,
          channel: form.channel,
          category: form.category || null,
          priority: form.priority,
          assignedTo: form.assignedTo || null,
          initialMessage: form.initialMessage || null,
        }),
      })
      onSave()
    } catch { /* silent */ }
    setSaving(false)
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16,
          width: 520, maxHeight: "85vh", overflow: "auto",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: CARD_BG, zIndex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
            New Support Ticket
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", fontSize: 18 }}>{"\u2715"}</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Subject */}
          <div>
            <label style={labelStyle}>Subject *</label>
            <input type="text" value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Ticket subject..." style={inputStyle} />
          </div>

          {/* Client Name + Email */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Client Name *</label>
              <input type="text" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client name..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Client Email</label>
              <input type="email" value={form.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} placeholder="client@example.com" style={inputStyle} />
            </div>
          </div>

          {/* Channel + Category */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Channel</label>
              <select value={form.channel} onChange={(e) => set("channel", e.target.value)} style={inputStyle}>
                {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} style={inputStyle}>
                <option value="">Not specified</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set("priority", p.id)}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 11, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif", cursor: "pointer", textTransform: "capitalize",
                    border: `1px solid ${form.priority === p.id ? p.color : CARD_BORDER}`,
                    background: form.priority === p.id ? `${p.color}15` : "transparent",
                    color: form.priority === p.id ? p.color : TEXT_TERTIARY,
                    transition: "all 0.15s",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign To */}
          <div>
            <label style={labelStyle}>Assign To</label>
            <select value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} style={inputStyle}>
              <option value="">Unassigned</option>
              {employees.map((emp) => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
            </select>
          </div>

          {/* Initial Message */}
          <div>
            <label style={labelStyle}>Initial Message</label>
            <textarea
              value={form.initialMessage}
              onChange={(e) => set("initialMessage", e.target.value)}
              placeholder="Client's initial message or description of the issue..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.subject.trim() || !form.clientName.trim()}
            className="btn-primary"
            style={{ padding: "8px 16px", fontSize: 11, opacity: (!form.subject.trim() || !form.clientName.trim()) ? 0.5 : 1 }}
          >
            {saving ? "Creating..." : "Create Ticket"}
          </button>
        </div>
      </div>
    </div>
  )
}
