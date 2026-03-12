"use client"

import { useState } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, RED, GREEN, AMBER, INDIGO, ROSE_GOLD,
  SECTOR_COLORS, STATUS_COLORS, HEALTH_COLORS, STAGE_COLORS,
  STATUSES, SEGMENTS, labelStyle,
} from "@/components/crm/constants"
import type { Contact, Employee } from "@/components/crm/types"
import CompanyIntelPanel from "@/components/ai/CompanyIntelPanel"

interface OverviewTabProps {
  contact: Contact
  employees: Employee[]
  onRefresh: () => void
}

/* ── Format helper ── */
const fmt = (val: number | null, prefix = "\u20AC") => {
  if (val == null) return "\u2014"
  if (val >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${prefix}${(val / 1_000).toFixed(0)}K`
  return `${prefix}${val.toFixed(0)}`
}

export default function OverviewTab({ contact, employees, onRefresh }: OverviewTabProps) {
  /* ── Inline editing state ── */
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  /* ── Metrics form state ── */
  const [showMetricsForm, setShowMetricsForm] = useState(false)
  const [metricsMonth, setMetricsMonth] = useState("")
  const [metricsGtv, setMetricsGtv] = useState("")
  const [metricsRevenue, setMetricsRevenue] = useState("")
  const [metricsRate, setMetricsRate] = useState("")
  const [metricsTx, setMetricsTx] = useState("")

  /* ── Helpers ── */
  const saveField = async (field: string, value: string | null) => {
    try {
      await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      onRefresh()
    } catch { /* silent */ }
  }

  const startEdit = (field: string, currentValue: string | null) => {
    setEditingField(field)
    setEditValue(currentValue || "")
  }

  const saveEdit = async (field: string) => {
    setEditingField(null)
    try {
      await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: editValue.trim() || null }),
      })
      onRefresh()
    } catch { /* silent */ }
  }

  const saveStatus = async (newStatus: string) => {
    try {
      await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      onRefresh()
    } catch { /* silent */ }
  }

  const handleAddMetrics = async () => {
    if (!metricsMonth) return
    try {
      await fetch(`/api/contacts/${contact.id}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: metricsMonth,
          gtv: metricsGtv || "0",
          revenue: metricsRevenue || "0",
          takeRate: metricsRate || "0",
          txCount: metricsTx || "0",
        }),
      })
      setMetricsMonth("")
      setMetricsGtv("")
      setMetricsRevenue("")
      setMetricsRate("")
      setMetricsTx("")
      setShowMetricsForm(false)
      onRefresh()
    } catch { /* silent */ }
  }

  /* ── Inline editable field renderer ── */
  const renderField = (label: string, field: string, value: string | null, fullWidth = false) => (
    <div style={{ flex: fullWidth ? "1 1 100%" : "1 1 45%", minWidth: 0 }}>
      <div style={{ ...labelStyle, marginBottom: 3 }}>{label}</div>
      {editingField === field ? (
        <input
          className="oxen-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(field)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit(field)
            if (e.key === "Escape") setEditingField(null)
          }}
          autoFocus
          style={{ fontSize: 12, padding: "4px 8px" }}
        />
      ) : (
        <div
          onClick={() => startEdit(field, value)}
          style={{
            fontSize: 12,
            color: value ? TEXT_PRIMARY : TEXT_TERTIARY,
            fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer",
            padding: "4px 0",
            borderBottom: "1px dashed rgba(255,255,255,0.06)",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = "rgba(192,139,136,0.3)" }}
          onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = "rgba(255,255,255,0.06)" }}
        >
          {value || "\u2014"}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Contact Information ── */}
      <div className="card fade-in" style={{ padding: 20, animationDelay: "0.05s" }}>
        <div style={{ fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST, marginBottom: 16 }}>
          Contact Information
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {renderField("Email", "email", contact.email)}
          {renderField("Phone", "phone", contact.phone)}
          {renderField("Telegram", "telegram", contact.telegram)}
          {renderField("WhatsApp", "whatsapp", contact.whatsapp)}
          {renderField("Website", "website", contact.website)}
          {renderField("Country", "country", contact.country)}
        </div>
      </div>

      {/* ── Revenue Intelligence ── */}
      <div className="card fade-in" style={{ padding: 20, animationDelay: "0.08s" }}>
        <div style={{ fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST, marginBottom: 16 }}>
          Revenue Intelligence
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={labelStyle}>Monthly GTV</div>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: FROST }}>
              {fmt(contact.monthlyGtv)}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Revenue</div>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: FROST }}>
              {fmt(contact.monthlyRevenue)}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Take Rate</div>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: FROST }}>
              {contact.takeRate != null ? `${contact.takeRate}%` : "\u2014"}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Projected Volume</div>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: FROST }}>
              {fmt(contact.projectedVolume)}
            </div>
          </div>
        </div>

        {/* Health + Segment selectors */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: "1 1 45%", minWidth: 0 }}>
            <div style={{ ...labelStyle, marginBottom: 3 }}>Health Status</div>
            <select
              className="oxen-input"
              value={contact.healthStatus}
              onChange={(e) => saveField("healthStatus", e.target.value)}
              style={{ appearance: "none", fontSize: 12, padding: "4px 8px" }}
            >
              <option value="healthy">Healthy</option>
              <option value="watch">Watch</option>
              <option value="at_risk">At Risk</option>
              <option value="declining">Declining</option>
              <option value="churned">Churned</option>
            </select>
          </div>
          <div style={{ flex: "1 1 45%", minWidth: 0 }}>
            <div style={{ ...labelStyle, marginBottom: 3 }}>Segment</div>
            <select
              className="oxen-input"
              value={contact.segment || ""}
              onChange={(e) => saveField("segment", e.target.value || null)}
              style={{ appearance: "none", fontSize: 12, padding: "4px 8px" }}
            >
              <option value="">Select segment...</option>
              {SEGMENTS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
        </div>

        {/* Monthly Metrics History */}
        {contact.metrics && contact.metrics.length > 0 && (
          <div>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Monthly Metrics</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Month", "GTV", "Revenue", "Rate", "Tx"].map((h) => (
                      <th key={h} style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, padding: "6px 8px", textAlign: "left", borderBottom: `1px solid ${CARD_BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contact.metrics.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: 11, color: TEXT_PRIMARY, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{m.month}</td>
                      <td style={{ fontSize: 11, fontFamily: "'Bellfair', serif", color: FROST, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{fmt(m.gtv)}</td>
                      <td style={{ fontSize: 11, fontFamily: "'Bellfair', serif", color: FROST, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{fmt(m.revenue)}</td>
                      <td style={{ fontSize: 11, color: TEXT_SECONDARY, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{m.takeRate}%</td>
                      <td style={{ fontSize: 11, color: TEXT_SECONDARY, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{m.txCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Metrics button / form */}
        {!showMetricsForm ? (
          <button
            onClick={() => setShowMetricsForm(true)}
            style={{
              marginTop: 12,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${CARD_BORDER}`,
              color: TEXT_SECONDARY,
              fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            + Add Monthly Metrics
          </button>
        ) : (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ ...labelStyle, fontSize: 9 }}>Month</div>
                <input className="oxen-input" type="month" value={metricsMonth} onChange={(e) => setMetricsMonth(e.target.value)} style={{ fontSize: 11, padding: "4px 6px" }} />
              </div>
              <div>
                <div style={{ ...labelStyle, fontSize: 9 }}>GTV (\u20AC)</div>
                <input className="oxen-input" type="number" value={metricsGtv} onChange={(e) => setMetricsGtv(e.target.value)} placeholder="0" style={{ fontSize: 11, padding: "4px 6px" }} />
              </div>
              <div>
                <div style={{ ...labelStyle, fontSize: 9 }}>Revenue (\u20AC)</div>
                <input className="oxen-input" type="number" value={metricsRevenue} onChange={(e) => setMetricsRevenue(e.target.value)} placeholder="0" style={{ fontSize: 11, padding: "4px 6px" }} />
              </div>
              <div>
                <div style={{ ...labelStyle, fontSize: 9 }}>Rate (%)</div>
                <input className="oxen-input" type="number" step="0.01" value={metricsRate} onChange={(e) => setMetricsRate(e.target.value)} placeholder="0" style={{ fontSize: 11, padding: "4px 6px" }} />
              </div>
              <div>
                <div style={{ ...labelStyle, fontSize: 9 }}>Tx Count</div>
                <input className="oxen-input" type="number" value={metricsTx} onChange={(e) => setMetricsTx(e.target.value)} placeholder="0" style={{ fontSize: 11, padding: "4px 6px" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={handleAddMetrics} disabled={!metricsMonth} style={{ padding: "4px 12px", fontSize: 11 }}>Save</button>
              <button className="btn-secondary" onClick={() => setShowMetricsForm(false)} style={{ padding: "4px 12px", fontSize: 11 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Deal Information ── */}
      <div className="card fade-in" style={{ padding: 20, animationDelay: "0.1s" }}>
        <div style={{ fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST, marginBottom: 16 }}>
          Deal Information
        </div>

        {/* Deal Value */}
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Deal Value</div>
          <div style={{ fontFamily: "'Bellfair', serif", fontSize: 28, fontWeight: 400, color: FROST, lineHeight: 1 }}>
            {fmt(contact.value)}
          </div>
        </div>

        {/* Status buttons */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Status</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUSES.map((s) => {
              const sc = STATUS_COLORS[s] || STATUS_COLORS.lead
              return (
                <button
                  key={s}
                  onClick={() => saveStatus(s)}
                  style={{
                    padding: "5px 12px",
                    fontSize: 10,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    letterSpacing: 0.5,
                    textTransform: "capitalize",
                    border: `1px solid ${contact.status === s ? sc.text : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 6,
                    background: contact.status === s ? sc.bg : "transparent",
                    color: contact.status === s ? sc.text : TEXT_SECONDARY,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        {/* Source + Assigned To */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {renderField("Source", "source", contact.source)}
          <div style={{ flex: "1 1 45%", minWidth: 0 }}>
            <div style={{ ...labelStyle, marginBottom: 3 }}>Assigned To</div>
            <select
              className="oxen-input"
              value={contact.assignedTo || ""}
              onChange={(e) => saveField("assignedTo", e.target.value || null)}
              style={{ appearance: "none", fontSize: 12, padding: "4px 8px" }}
            >
              <option value="">Unassigned</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.name}>{emp.name} \u2014 {emp.role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginTop: 14 }}>
          <div style={labelStyle}>Notes</div>
          {editingField === "notes" ? (
            <textarea
              className="oxen-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveEdit("notes")}
              rows={4}
              autoFocus
              style={{ resize: "vertical", minHeight: 60, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
            />
          ) : (
            <div
              onClick={() => startEdit("notes", contact.notes)}
              style={{
                fontSize: 12,
                color: contact.notes ? TEXT_SECONDARY : TEXT_TERTIARY,
                fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.6,
                cursor: "pointer",
                padding: "8px 0",
                borderBottom: "1px dashed rgba(255,255,255,0.06)",
                whiteSpace: "pre-wrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = "rgba(192,139,136,0.3)" }}
              onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = "rgba(255,255,255,0.06)" }}
            >
              {contact.notes || "Click to add notes..."}
            </div>
          )}
        </div>

        {/* Active Deals list */}
        {contact.deals && contact.deals.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Active Deals</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {contact.deals.map((deal) => {
                const sc = STAGE_COLORS[deal.stage] || STAGE_COLORS.discovery
                return (
                  <div
                    key={deal.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 500 }}>{deal.name}</div>
                      <div style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                        {deal.probability}% \u00B7 {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "No close date"}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, padding: "2px 6px", borderRadius: 8, background: sc.bg, color: sc.text }}>
                      {deal.stage.replace("_", " ")}
                    </span>
                    <span style={{ fontFamily: "'Bellfair', serif", fontSize: 13, color: FROST }}>
                      {fmt(deal.expectedRevenue)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Company Intel ── */}
      <div className="fade-in" style={{ animationDelay: "0.12s" }}>
        <CompanyIntelPanel contactId={contact.id} />
      </div>
    </div>
  )
}
