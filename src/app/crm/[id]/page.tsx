"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, RED, GREEN, AMBER, INDIGO, ROSE_GOLD,
  SECTOR_COLORS, STATUS_COLORS, HEALTH_COLORS, STAGE_COLORS,
  STATUSES, INTERACTION_TYPES, INTERACTION_ICONS, SEGMENTS,
  labelStyle,
} from "@/components/crm/constants"
import type { Contact, Interaction, Employee, Deal } from "@/components/crm/types"
import CompanyIntelPanel from "@/components/ai/CompanyIntelPanel"

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [contact, setContact] = useState<Contact | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  /* Inline editing state */
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  /* Interaction form */
  const [interType, setInterType] = useState("note")
  const [interContent, setInterContent] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  /* Metrics form */
  const [metricsMonth, setMetricsMonth] = useState("")
  const [metricsGtv, setMetricsGtv] = useState("")
  const [metricsRevenue, setMetricsRevenue] = useState("")
  const [metricsRate, setMetricsRate] = useState("")
  const [metricsTx, setMetricsTx] = useState("")
  const [showMetricsForm, setShowMetricsForm] = useState(false)

  const fetchContact = useCallback(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setContact(data.contact ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const fetchEmployees = useCallback(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchContact()
    fetchEmployees()
  }, [fetchContact, fetchEmployees])

  /* ── Inline edit helpers ── */
  const startEdit = (field: string, currentValue: string | null) => {
    setEditingField(field)
    setEditValue(currentValue || "")
  }

  const saveEdit = async (field: string) => {
    if (!contact) return
    setEditingField(null)
    try {
      await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: editValue.trim() || null }),
      })
      fetchContact()
    } catch { /* silent */ }
  }

  const saveStatus = async (newStatus: string) => {
    if (!contact) return
    try {
      await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchContact()
    } catch { /* silent */ }
  }

  const saveField = async (field: string, value: string | null) => {
    if (!contact) return
    try {
      await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      fetchContact()
    } catch { /* silent */ }
  }

  /* ── Add interaction ── */
  const handleAddInteraction = async () => {
    if (!interContent.trim()) return
    try {
      await fetch(`/api/contacts/${id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: interType, content: interContent.trim() }),
      })
      setInterContent("")
      fetchContact()
    } catch { /* silent */ }
  }

  /* ── Add metrics ── */
  const handleAddMetrics = async () => {
    if (!metricsMonth) return
    try {
      await fetch(`/api/contacts/${id}/metrics`, {
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
      fetchContact()
    } catch { /* silent */ }
  }

  /* ── Delete contact ── */
  const handleDelete = async () => {
    try {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" })
      router.push("/crm")
    } catch { /* silent */ }
  }

  /* ── Format helpers ── */
  const fmt = (val: number | null, prefix = "€") => {
    if (val == null) return "—"
    if (val >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${prefix}${(val / 1_000).toFixed(0)}K`
    return `${prefix}${val.toFixed(0)}`
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })

  const relativeDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return "Today"
    if (diff === 1) return "Yesterday"
    if (diff < 7) return `${diff} days ago`
    return formatDate(iso)
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
          {value || "—"}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center", color: TEXT_TERTIARY }}>
        Loading...
      </div>
    )
  }

  if (!contact) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center", color: TEXT_TERTIARY }}>
        Contact not found.{" "}
        <span style={{ color: ROSE_GOLD, cursor: "pointer" }} onClick={() => router.push("/crm")}>
          Back to CRM
        </span>
      </div>
    )
  }

  const statusColor = STATUS_COLORS[contact.status] || STATUS_COLORS.lead
  const sectorColor = contact.sector ? SECTOR_COLORS[contact.sector] || SECTOR_COLORS.Other : null
  const healthColor = HEALTH_COLORS[contact.healthStatus] || HEALTH_COLORS.healthy

  return (
    <div className="page-content" style={{ padding: 0 }}>
      {/* ── Header ── */}
      <div
        className="sticky-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          background: "rgba(6,7,9,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${CARD_BORDER}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => router.push("/crm")}
            style={{ background: "none", border: "none", color: TEXT_TERTIARY, fontSize: 18, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}
          >
            ←
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 24, fontWeight: 400, color: FROST, lineHeight: 1.2, margin: 0 }}>
                {contact.company || contact.name}
              </h1>
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: statusColor.bg, color: statusColor.text }}>
                {contact.status}
              </span>
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: healthColor.bg, color: healthColor.text }}>
                {contact.healthStatus.replace("_", " ")}
              </span>
              {sectorColor && (
                <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: sectorColor.bg, color: sectorColor.text }}>
                  {contact.sector}
                </span>
              )}
            </div>
            {contact.company && (
              <p style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                {contact.name} {contact.segment && `· ${contact.segment}`}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: RED, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}
            >
              Delete
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: RED }}>Confirm?</span>
              <button onClick={handleDelete} style={{ background: RED, border: "none", color: FROST, fontSize: 11, padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}>Yes, delete</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary" style={{ padding: "6px 12px", fontSize: 11 }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div
        style={{
          padding: "28px 32px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ── Left Column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Contact Info Card */}
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

          {/* Revenue Intelligence Card */}
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
                  {contact.takeRate != null ? `${contact.takeRate}%` : "—"}
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

            {/* Add Metrics button */}
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
                    <div style={{ ...labelStyle, fontSize: 9 }}>GTV (€)</div>
                    <input className="oxen-input" type="number" value={metricsGtv} onChange={(e) => setMetricsGtv(e.target.value)} placeholder="0" style={{ fontSize: 11, padding: "4px 6px" }} />
                  </div>
                  <div>
                    <div style={{ ...labelStyle, fontSize: 9 }}>Revenue (€)</div>
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

          {/* Deal Info Card */}
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
                    <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
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

            {/* Deals */}
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
                            {deal.probability}% · {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "No close date"}
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
        </div>

        {/* ── Right Column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* AI Company Intel */}
        <div className="fade-in" style={{ animationDelay: "0.1s" }}>
          <CompanyIntelPanel contactId={id} />
        </div>

        {/* Timeline */}
        <div className="card fade-in" style={{ padding: 20, animationDelay: "0.15s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST }}>Timeline</span>
            <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
              {contact.interactions.length} interaction{contact.interactions.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Add Interaction Form */}
          <div style={{ padding: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
              {INTERACTION_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setInterType(t)}
                  style={{
                    padding: "3px 8px",
                    fontSize: 10,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    border: `1px solid ${interType === t ? "rgba(192,139,136,0.3)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 4,
                    background: interType === t ? "rgba(192,139,136,0.1)" : "transparent",
                    color: interType === t ? TEXT_PRIMARY : TEXT_TERTIARY,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.15s",
                  }}
                >
                  {INTERACTION_ICONS[t]} {t}
                </button>
              ))}
            </div>
            <textarea
              className="oxen-input"
              value={interContent}
              onChange={(e) => setInterContent(e.target.value)}
              placeholder="Add a note, log a call..."
              rows={2}
              style={{ resize: "vertical", minHeight: 44, fontSize: 12, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}
            />
            <button
              className="btn-primary"
              onClick={handleAddInteraction}
              disabled={!interContent.trim()}
              style={{ padding: "6px 14px", fontSize: 11, width: "100%" }}
            >
              Add {interType}
            </button>
          </div>

          {/* Interaction List */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {contact.interactions.length === 0 && (
              <div style={{ fontSize: 12, color: TEXT_TERTIARY, textAlign: "center", padding: "20px 0", fontFamily: "'DM Sans', sans-serif" }}>
                No interactions yet
              </div>
            )}
            {contact.interactions.map((inter, i) => (
              <div
                key={inter.id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "12px 0",
                  borderBottom: i < contact.interactions.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                  {INTERACTION_ICONS[inter.type] || "📝"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textTransform: "capitalize" }}>{inter.type}</span>
                    <span style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>{relativeDate(inter.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {inter.content}
                  </div>
                  <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
                    by {inter.createdBy}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
