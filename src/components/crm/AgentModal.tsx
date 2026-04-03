"use client"

import { useState, useEffect } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_TERTIARY, RED, FROST,
  AGENT_TYPES, AGENT_STATUSES, labelStyle,
} from "./constants"
import type { Agent, AgentFormData } from "./types"

interface AgentModalProps {
  show: boolean
  onClose: () => void
  agent: Agent | null
  onSaved: () => void
}

const emptyForm: AgentFormData = {
  name: "", company: "", type: "broker", email: "", phone: "",
  telegram: "", whatsapp: "", country: "", website: "",
  commissionDirect: "15", commissionIndirect: "5", status: "prospect", notes: "",
}

export default function AgentModal({ show, onClose, agent, onSaved }: AgentModalProps) {
  const [form, setForm] = useState<AgentFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        company: agent.company ?? "",
        type: agent.type,
        email: agent.email ?? "",
        phone: agent.phone ?? "",
        telegram: agent.telegram ?? "",
        whatsapp: agent.whatsapp ?? "",
        country: agent.country ?? "",
        website: agent.website ?? "",
        commissionDirect: String(agent.commissionDirect),
        commissionIndirect: String(agent.commissionIndirect),
        status: agent.status,
        notes: agent.notes ?? "",
      })
    } else {
      setForm(emptyForm)
    }
  }, [agent, show])

  if (!show) return null

  const set = (key: keyof AgentFormData, val: string) => setForm((p) => ({ ...p, [key]: val }))

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const url = agent ? `/api/agents/${agent.id}` : "/api/agents"
      const method = agent ? "PATCH" : "POST"
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      onSaved()
    } catch { /* silent */ }
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)",
    border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: FROST,
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{
        position: "relative", width: 560, maxHeight: "85vh", overflow: "auto",
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
        padding: 28, animation: "slideUp 0.2s ease",
      }}>
        <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 22, color: FROST, margin: "0 0 20px" }}>
          {agent ? "Edit Agent" : "New Agent"}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Name <span style={{ color: RED }}>*</span></label>
            <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input style={inputStyle} value={form.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select style={inputStyle} value={form.type} onChange={(e) => set("type", e.target.value)}>
              {AGENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {AGENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Telegram</label>
            <input style={inputStyle} value={form.telegram} onChange={(e) => set("telegram", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>WhatsApp</label>
            <input style={inputStyle} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input style={inputStyle} value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Website</label>
            <input style={inputStyle} value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Commission Direct (%)</label>
            <input style={inputStyle} type="number" value={form.commissionDirect} onChange={(e) => set("commissionDirect", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Commission Indirect (%)</label>
            <input style={inputStyle} type="number" value={form.commissionIndirect} onChange={(e) => set("commissionIndirect", e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{
            padding: "8px 18px", border: `1px solid ${CARD_BORDER}`, borderRadius: 6,
            background: "transparent", color: TEXT_TERTIARY, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", fontSize: 12,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !form.name.trim()} style={{
            padding: "8px 18px", border: "none", borderRadius: 6,
            background: "linear-gradient(135deg, #C08B88 0%, #A07572 100%)",
            color: FROST, cursor: saving ? "wait" : "pointer",
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
            opacity: saving || !form.name.trim() ? 0.5 : 1,
          }}>{saving ? "Saving..." : agent ? "Update Agent" : "Create Agent"}</button>
        </div>
      </div>
    </div>
  )
}
