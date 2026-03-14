"use client"

import { useState } from "react"
import { CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, FROST, GREEN, RED, AMBER, ROSE_GOLD, CARD_BG } from "./constants"
import type { LeaveRules, BlackoutPeriod } from "./types"

interface RulesTabProps {
  rules: LeaveRules | null
  isAdmin: boolean
  onRulesSaved: () => void
}

export default function RulesTab({ rules, isAdmin, onRulesSaved }: RulesTabProps) {
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<LeaveRules>>({})
  const [saving, setSaving] = useState(false)
  const [blackoutForm, setBlackoutForm] = useState<BlackoutPeriod[]>([])

  if (!rules) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 12 }}>
        Loading rules...
      </div>
    )
  }

  const startEditing = (section: string) => {
    setEditingSection(section)
    setForm({ ...rules })
    setBlackoutForm(Array.isArray(rules.blackoutPeriods) ? [...rules.blackoutPeriods] : [])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...form }
      if (editingSection === "vacation") {
        payload.blackoutPeriods = blackoutForm
      }
      await fetch("/api/leaves/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setEditingSection(null)
      onRulesSaved()
    } catch { /* silent */ }
    setSaving(false)
  }

  const inputStyle = { fontSize: 12, padding: "6px 10px", width: "100%" }
  const labelStyle = { fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 4 }

  const blackouts = Array.isArray(rules.blackoutPeriods) ? rules.blackoutPeriods : []

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* General Rules */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: 0 }}>General Policy</h3>
          {isAdmin && editingSection !== "general" && (
            <button onClick={() => startEditing("general")} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Edit
            </button>
          )}
        </div>
        {editingSection === "general" ? (
          <>
            <textarea
              className="oxen-input"
              value={form.generalPolicy || ""}
              onChange={(e) => setForm({ ...form, generalPolicy: e.target.value })}
              rows={5}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingSection(null)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 11 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: "6px 14px", fontSize: 11 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {rules.generalPolicy || "No general policy set."}
          </div>
        )}
      </div>

      {/* Vacation Rules */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: GREEN, margin: 0 }}>Vacation Rules</h3>
          {isAdmin && editingSection !== "vacation" && (
            <button onClick={() => startEditing("vacation")} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Edit
            </button>
          )}
        </div>
        {editingSection === "vacation" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { key: "vacationQuota", label: "Annual Quota (days)" },
                { key: "vacationMinNotice", label: "Min Notice (days)" },
                { key: "vacationMaxConsecutive", label: "Max Consecutive (days)" },
                { key: "vacationCarryOver", label: "Carry Over (days)" },
              ].map((item) => (
                <div key={item.key}>
                  <label style={labelStyle}>{item.label}</label>
                  <input
                    className="oxen-input"
                    type="number"
                    value={(form as Record<string, number>)[item.key] ?? 0}
                    onChange={(e) => setForm({ ...form, [item.key]: parseInt(e.target.value) || 0 })}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>

            {/* Blackout Periods */}
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Blackout Periods</label>
              {blackoutForm.map((bp, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input className="oxen-input" type="date" value={bp.startDate} onChange={(e) => { const n = [...blackoutForm]; n[idx] = { ...n[idx], startDate: e.target.value }; setBlackoutForm(n) }} style={{ fontSize: 11, padding: "4px 8px", colorScheme: "dark" }} />
                  <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>to</span>
                  <input className="oxen-input" type="date" value={bp.endDate} onChange={(e) => { const n = [...blackoutForm]; n[idx] = { ...n[idx], endDate: e.target.value }; setBlackoutForm(n) }} style={{ fontSize: 11, padding: "4px 8px", colorScheme: "dark" }} />
                  <input className="oxen-input" value={bp.reason} placeholder="Reason" onChange={(e) => { const n = [...blackoutForm]; n[idx] = { ...n[idx], reason: e.target.value }; setBlackoutForm(n) }} style={{ fontSize: 11, padding: "4px 8px", flex: 1 }} />
                  <button onClick={() => setBlackoutForm(blackoutForm.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 14, padding: "0 4px" }}>x</button>
                </div>
              ))}
              <button
                onClick={() => setBlackoutForm([...blackoutForm, { startDate: "", endDate: "", reason: "" }])}
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                + Add Period
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingSection(null)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 11 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: "6px 14px", fontSize: 11 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Annual Quota", value: `${rules.vacationQuota} days` },
              { label: "Min Notice", value: `${rules.vacationMinNotice} days` },
              { label: "Max Consecutive", value: `${rules.vacationMaxConsecutive} days` },
              { label: "Carry Over", value: `${rules.vacationCarryOver} days` },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{item.value}</div>
              </div>
            ))}
            {blackouts.length > 0 && (
              <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Blackout Periods</div>
                {blackouts.map((bp, i) => (
                  <div key={i} style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
                    {bp.startDate} to {bp.endDate} — {bp.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sick Leave Rules */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: RED, margin: 0 }}>Sick Leave Rules</h3>
          {isAdmin && editingSection !== "sick" && (
            <button onClick={() => startEditing("sick")} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Edit
            </button>
          )}
        </div>
        {editingSection === "sick" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Annual Quota (days)</label>
                <input className="oxen-input" type="number" value={form.sickQuota ?? 0} onChange={(e) => setForm({ ...form, sickQuota: parseInt(e.target.value) || 0 })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Certificate Required After (days)</label>
                <input className="oxen-input" type="number" value={form.sickCertAfterDays ?? 0} onChange={(e) => setForm({ ...form, sickCertAfterDays: parseInt(e.target.value) || 0 })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingSection(null)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 11 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: "6px 14px", fontSize: 11 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Annual Quota</div>
              <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{rules.sickQuota} days</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Certificate After</div>
              <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{rules.sickCertAfterDays} days</div>
            </div>
          </div>
        )}
      </div>

      {/* OOO Rules */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: "#818cf8", margin: 0 }}>Out of Office Rules</h3>
          {isAdmin && editingSection !== "ooo" && (
            <button onClick={() => startEditing("ooo")} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Edit
            </button>
          )}
        </div>
        {editingSection === "ooo" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Annual Quota (days)</label>
                <input className="oxen-input" type="number" value={form.oooQuota ?? 0} onChange={(e) => setForm({ ...form, oooQuota: parseInt(e.target.value) || 0 })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Min Notice (days)</label>
                <input className="oxen-input" type="number" value={form.oooMinNotice ?? 0} onChange={(e) => setForm({ ...form, oooMinNotice: parseInt(e.target.value) || 0 })} style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.oooReasonRequired ?? false}
                    onChange={(e) => setForm({ ...form, oooReasonRequired: e.target.checked })}
                    style={{ accentColor: ROSE_GOLD }}
                  />
                  Reason Required
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingSection(null)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 11 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: "6px 14px", fontSize: 11 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Annual Quota</div>
              <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{rules.oooQuota} days</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Min Notice</div>
              <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{rules.oooMinNotice} days</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Reason Required</div>
              <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{rules.oooReasonRequired ? "Yes" : "No"}</div>
            </div>
          </div>
        )}
      </div>

      {/* Approval Process */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: 0 }}>Approval Process</h3>
          {isAdmin && editingSection !== "approval" && (
            <button onClick={() => startEditing("approval")} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Edit
            </button>
          )}
        </div>
        {editingSection === "approval" ? (
          <>
            <div>
              <label style={labelStyle}>Approval Timeline (business days)</label>
              <input className="oxen-input" type="number" value={form.approvalTimeline ?? 0} onChange={(e) => setForm({ ...form, approvalTimeline: parseInt(e.target.value) || 0 })} style={{ ...inputStyle, maxWidth: 200 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingSection(null)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 11 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: "6px 14px", fontSize: 11 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Timeline</div>
            <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{rules.approvalTimeline} business days</div>
          </div>
        )}
      </div>
    </div>
  )
}
