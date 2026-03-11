"use client"

import { useState, useEffect } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, INDIGO,
  ENTITIES, getCategoriesForType, getCategoryLabel,
} from "./constants"
import type { FinanceEntry, EntryFormData } from "./types"

interface EntryModalProps {
  entry: FinanceEntry | null
  onClose: () => void
  onSave: () => void
}

const emptyForm: EntryFormData = {
  type: "expense",
  category: "",
  description: "",
  amount: "",
  currency: "EUR",
  date: new Date().toISOString().split("T")[0],
  entity: "oxen",
  recurring: false,
  notes: "",
}

export default function EntryModal({ entry, onClose, onSave }: EntryModalProps) {
  const [form, setForm] = useState<EntryFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (entry) {
      setForm({
        type: entry.type,
        category: entry.category,
        description: entry.description || "",
        amount: String(entry.amount),
        currency: entry.currency,
        date: entry.date.split("T")[0],
        entity: entry.entity,
        recurring: entry.recurring,
        notes: entry.notes || "",
      })
    } else {
      setForm(emptyForm)
    }
  }, [entry])

  const set = (key: keyof EntryFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const categories = getCategoriesForType(form.type)

  // Reset category when type changes and current category doesn't match
  useEffect(() => {
    const validIds = getCategoriesForType(form.type).map((c) => c.id)
    if (form.category && !validIds.includes(form.category)) {
      set("category", "")
    }
  }, [form.type])

  const handleSave = async () => {
    if (!form.category || !form.amount || !form.date) return
    setSaving(true)
    try {
      const url = entry ? `/api/finance/${entry.id}` : "/api/finance"
      const method = entry ? "PATCH" : "POST"
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          category: form.category,
          description: form.description || null,
          amount: parseFloat(form.amount),
          currency: form.currency,
          date: form.date,
          entity: form.entity,
          recurring: form.recurring,
          notes: form.notes || null,
        }),
      })
      onSave()
    } catch {
      // ignore
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!entry) return
    setSaving(true)
    try {
      await fetch(`/api/finance/${entry.id}`, { method: "DELETE" })
      onSave()
    } catch {
      // ignore
    }
    setSaving(false)
  }

  const typeColor = form.type === "revenue" ? GREEN : form.type === "expense" ? ROSE_GOLD : INDIGO

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
            {entry ? "Edit Entry" : "Add Entry"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", fontSize: 18 }}>
            {"\u2715"}
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Type selector */}
          <div>
            <label style={labelSt}>Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["revenue", "expense", "budget"] as const).map((t) => {
                const active = form.type === t
                const col = t === "revenue" ? GREEN : t === "expense" ? ROSE_GOLD : INDIGO
                return (
                  <button
                    key={t}
                    onClick={() => set("type", t)}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize", cursor: "pointer",
                      border: `1px solid ${active ? col : CARD_BORDER}`,
                      background: active ? `${col}15` : "transparent",
                      color: active ? col : TEXT_TERTIARY,
                      transition: "all 0.15s",
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={labelSt}>Category</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} style={inputSt}>
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Amount + Currency row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10 }}>
            <div>
              <label style={labelSt}>Amount</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" style={{ ...inputSt, fontFamily: "'Bellfair', serif", fontSize: 16, color: typeColor }} />
            </div>
            <div>
              <label style={labelSt}>Currency</label>
              <select value={form.currency} onChange={(e) => set("currency", e.target.value)} style={inputSt}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {/* Date + Entity row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelSt}>Date</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Entity</label>
              <select value={form.entity} onChange={(e) => set("entity", e.target.value)} style={inputSt}>
                {ENTITIES.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={labelSt}>Description</label>
            <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional description" style={inputSt} />
          </div>

          {/* Recurring toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => set("recurring", !form.recurring)}
              style={{
                width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                background: form.recurring ? GREEN : "rgba(255,255,255,0.08)",
                position: "relative", transition: "background 0.2s",
              }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 3, left: form.recurring ? 19 : 3,
                transition: "left 0.2s",
              }} />
            </button>
            <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
              Recurring monthly
            </span>
          </div>

          {/* Notes */}
          <div>
            <label style={labelSt}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              style={{ ...inputSt, resize: "vertical", minHeight: 60 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {entry && (
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "rgba(248,113,113,0.1)", color: "#F87171", fontSize: 11,
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                }}
              >
                Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !form.category || !form.amount} className="btn-primary" style={{ padding: "8px 16px", fontSize: 11, opacity: (!form.category || !form.amount) ? 0.5 : 1 }}>
              {saving ? "Saving..." : entry ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = {
  display: "block", fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase",
  letterSpacing: 1, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
  background: "rgba(255,255,255,0.02)", color: TEXT_PRIMARY, fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}
