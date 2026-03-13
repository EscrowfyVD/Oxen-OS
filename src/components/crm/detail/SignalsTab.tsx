"use client"

import { useState } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, RED,
  SIGNAL_TYPE_COLORS,
} from "../constants"
import { labelStyle } from "../constants"
import type { IntentSignal } from "../types"

interface SignalsTabProps {
  contactId: string
  signals: IntentSignal[]
  onRefresh: () => void
}

const SIGNAL_TYPES = ["job_change", "funding", "expansion", "tech_install", "hiring", "web_visit", "content_download"]
const SIGNAL_SOURCES = ["manual", "trigify", "clay", "web_visit", "email_open", "ad_click"]

export default function SignalsTab({ contactId, signals, onRefresh }: SignalsTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ source: "manual", signalType: "web_visit", title: "", detail: "", score: "10" })

  const handleAdd = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/contacts/${contactId}/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, score: parseInt(form.score) || 10 }),
      })
      setForm({ source: "manual", signalType: "web_visit", title: "", detail: "", score: "10" })
      setShowForm(false)
      onRefresh()
    } catch { /* silent */ }
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)",
    border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: FROST,
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST, margin: 0 }}>
          Intent Signals ({signals.length})
        </h3>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: "6px 14px", border: `1px solid ${CARD_BORDER}`, borderRadius: 6,
          background: showForm ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.04)",
          color: showForm ? RED : TEXT_PRIMARY, cursor: "pointer",
          fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
        }}>{showForm ? "Cancel" : "+ Add Signal"}</button>
      </div>

      {showForm && (
        <div style={{
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
          padding: 20, marginBottom: 16,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Source</label>
              <select style={inputStyle} value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}>
                {SIGNAL_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.signalType} onChange={(e) => setForm((p) => ({ ...p, signalType: e.target.value }))}>
                {SIGNAL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Title <span style={{ color: RED }}>*</span></label>
              <input style={inputStyle} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Score (0-100)</label>
              <input style={inputStyle} type="number" min="0" max="100" value={form.score} onChange={(e) => setForm((p) => ({ ...p, score: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Detail</label>
            <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={form.detail} onChange={(e) => setForm((p) => ({ ...p, detail: e.target.value }))} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={handleAdd} disabled={saving || !form.title.trim()} style={{
              padding: "8px 18px", border: "none", borderRadius: 6,
              background: "linear-gradient(135deg, #C08B88 0%, #A07572 100%)",
              color: FROST, cursor: saving ? "wait" : "pointer",
              fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
              opacity: saving || !form.title.trim() ? 0.5 : 1,
            }}>{saving ? "Adding..." : "Add Signal"}</button>
          </div>
        </div>
      )}

      {signals.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
          No intent signals recorded yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {signals.map((signal) => {
            const typeColor = SIGNAL_TYPE_COLORS[signal.signalType] ?? { bg: "rgba(255,255,255,0.06)", text: TEXT_SECONDARY }
            const isExpired = signal.expiresAt && new Date(signal.expiresAt) < new Date()
            return (
              <div key={signal.id} style={{
                background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
                padding: 16, opacity: isExpired ? 0.5 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                        background: typeColor.bg, color: typeColor.text, fontFamily: "'DM Sans', sans-serif",
                      }}>{signal.signalType.replace(/_/g, " ")}</span>
                      <span style={{
                        padding: "2px 6px", borderRadius: 4, fontSize: 9,
                        background: "rgba(255,255,255,0.04)", color: TEXT_TERTIARY,
                        fontFamily: "'DM Sans', sans-serif",
                      }}>{signal.source}</span>
                      {isExpired && <span style={{ fontSize: 9, color: RED, fontFamily: "'DM Sans', sans-serif" }}>EXPIRED</span>}
                    </div>
                    <div style={{ fontSize: 14, color: FROST, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{signal.title}</div>
                    {signal.detail && <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{signal.detail}</div>}
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
                      {new Date(signal.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {signal.expiresAt && ` · Expires ${new Date(signal.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 60 }}>
                    <div style={{ fontSize: 20, fontFamily: "'Bellfair', serif", color: signal.score >= 50 ? GREEN : signal.score >= 20 ? TEXT_PRIMARY : TEXT_TERTIARY }}>
                      {signal.score}
                    </div>
                    <div style={{
                      width: 50, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)",
                      marginTop: 4, marginLeft: "auto",
                    }}>
                      <div style={{
                        width: `${signal.score}%`, height: "100%", borderRadius: 2,
                        background: signal.score >= 50 ? GREEN : signal.score >= 20 ? FROST : TEXT_TERTIARY,
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
