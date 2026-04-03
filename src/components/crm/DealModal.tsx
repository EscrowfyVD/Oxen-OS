"use client"

import { useState, useEffect } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_TERTIARY, RED, FROST,
  DEAL_STAGES, labelStyle,
} from "./constants"
import type { Deal, DealFormData, Contact, Employee } from "./types"

interface DealModalProps {
  show: boolean
  onClose: () => void
  deal: Deal | null
  contacts: Contact[]
  employees: Employee[]
  onSaved: () => void
}

const emptyForm: DealFormData = {
  name: "",
  contactId: "",
  stage: "discovery",
  expectedVolume: "",
  takeRate: "",
  expectedRevenue: "",
  probability: "50",
  closeDate: "",
  assignedTo: "",
  notes: "",
}

export default function DealModal({ show, onClose, deal, contacts, employees, onSaved }: DealModalProps) {
  const [form, setForm] = useState<DealFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (deal) {
      setForm({
        name: deal.name,
        contactId: deal.contactId,
        stage: deal.stage,
        expectedVolume: deal.expectedVolume != null ? String(deal.expectedVolume) : "",
        takeRate: deal.takeRate != null ? String(deal.takeRate) : "",
        expectedRevenue: deal.expectedRevenue != null ? String(deal.expectedRevenue) : "",
        probability: String(deal.probability),
        closeDate: deal.closeDate ? deal.closeDate.substring(0, 10) : "",
        assignedTo: deal.assignedTo || "",
        notes: deal.notes || "",
      })
    } else {
      setForm(emptyForm)
    }
  }, [deal, show])

  // Auto-calculate expected revenue when volume or rate changes
  useEffect(() => {
    if (form.expectedVolume && form.takeRate) {
      const vol = parseFloat(form.expectedVolume)
      const rate = parseFloat(form.takeRate)
      if (!isNaN(vol) && !isNaN(rate)) {
        const rev = (vol * rate) / 100
        setForm((prev) => ({ ...prev, expectedRevenue: String(Math.round(rev)) }))
      }
    }
  }, [form.expectedVolume, form.takeRate])

  if (!show) return null

  const set = (key: keyof DealFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim() || !form.contactId) return
    setSaving(true)

    try {
      const url = deal ? `/api/deals/${deal.id}` : "/api/deals"
      const method = deal ? "PATCH" : "POST"

      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          contactId: form.contactId,
          stage: form.stage,
          expectedVolume: form.expectedVolume || null,
          takeRate: form.takeRate || null,
          expectedRevenue: form.expectedRevenue || null,
          probability: form.probability || "50",
          closeDate: form.closeDate || null,
          assignedTo: form.assignedTo || null,
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
    if (!deal) return
    setSaving(true)
    try {
      await fetch(`/api/deals/${deal.id}`, { method: "DELETE" })
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
          width: 520,
          maxHeight: "85vh",
          overflowY: "auto",
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 14,
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
            {deal ? "Edit Deal" : "New Deal"}
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
          {/* Row 1: Name, Contact */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Deal Name *</label>
              <input
                className="oxen-input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Deal name"
                autoFocus
              />
            </div>
            <div>
              <label style={labelStyle}>Customer *</label>
              <select
                className="oxen-input"
                value={form.contactId}
                onChange={(e) => set("contactId", e.target.value)}
                style={{ appearance: "none" }}
              >
                <option value="">Select customer...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company ? `${c.company} — ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Stage, Probability */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Stage</label>
              <select
                className="oxen-input"
                value={form.stage}
                onChange={(e) => set("stage", e.target.value)}
                style={{ appearance: "none" }}
              >
                {DEAL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Probability (%)</label>
              <input
                className="oxen-input"
                type="number"
                min="0"
                max="100"
                value={form.probability}
                onChange={(e) => set("probability", e.target.value)}
                placeholder="50"
              />
            </div>
          </div>

          {/* Row 3: Volume, Take Rate, Revenue */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Expected Volume (€)</label>
              <input
                className="oxen-input"
                type="number"
                value={form.expectedVolume}
                onChange={(e) => set("expectedVolume", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label style={labelStyle}>Take Rate (%)</label>
              <input
                className="oxen-input"
                type="number"
                step="0.01"
                value={form.takeRate}
                onChange={(e) => set("takeRate", e.target.value)}
                placeholder="1.0"
              />
            </div>
            <div>
              <label style={labelStyle}>Expected Revenue</label>
              <input
                className="oxen-input"
                type="number"
                value={form.expectedRevenue}
                onChange={(e) => set("expectedRevenue", e.target.value)}
                placeholder="Auto-calculated"
              />
            </div>
          </div>

          {/* Row 4: Close Date, Assigned To */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Close Date</label>
              <input
                className="oxen-input"
                type="date"
                value={form.closeDate}
                onChange={(e) => set("closeDate", e.target.value)}
              />
            </div>
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
          </div>

          {/* Row 5: Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              className="oxen-input"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Add notes about this deal..."
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
            {deal && (
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
              disabled={!form.name.trim() || !form.contactId || saving}
              style={{ padding: "8px 18px" }}
            >
              {saving ? "Saving..." : deal ? "Save Changes" : "Create Deal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
