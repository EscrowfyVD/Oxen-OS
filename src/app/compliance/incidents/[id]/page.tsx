"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, AlertOctagon, Clock, Building2, User, Shield,
  AlertTriangle, CheckCircle2, FileText, DollarSign, Edit3, X,
} from "lucide-react"

const cardBg = "#0F1118"
const cardBorder = "rgba(255,255,255,0.06)"
const roseGold = "#C08B88"
const void_ = "#060709"
const textPrimary = "rgba(240,240,242,0.92)"
const textSecondary = "rgba(240,240,242,0.55)"
const textTertiary = "rgba(240,240,242,0.35)"

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.04)",
  border: `1px solid ${cardBorder}`, borderRadius: 10, color: textPrimary,
  fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif",
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: textSecondary, marginBottom: 6, display: "block",
}
const btnPrimary: React.CSSProperties = {
  padding: "10px 20px", background: roseGold, color: void_, border: "none",
  borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
}
const btnSecondary: React.CSSProperties = {
  padding: "10px 20px", background: "rgba(255,255,255,0.06)", color: textPrimary,
  border: `1px solid ${cardBorder}`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer",
}

const STATUS_COLORS: Record<string, string> = {
  open: "#3B82F6", investigating: "#F59E0B", reported: "#8B5CF6",
  resolved: "#22C55E", closed: "#6B7280",
}
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#EF4444", high: "#F59E0B", medium: "#3B82F6", low: "#6B7280",
}

interface Incident {
  id: string; title: string; code: string; type: string; severity: string
  status: string; description?: string; rootCause?: string; remediation?: string
  reportedBy: string; assignedTo?: string; reportedToRegulator: boolean
  regulatorRef?: string; reportedAt?: string; resolvedAt?: string
  financialImpact?: number; currency: string
  entity?: { id: string; name: string }; tags: string[]
  createdBy: string; createdAt: string; updatedAt: string
}

export default function IncidentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  // Edit state
  const [status, setStatus] = useState("")
  const [severity, setSeverity] = useState("")
  const [description, setDescription] = useState("")
  const [rootCause, setRootCause] = useState("")
  const [remediation, setRemediation] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [reportedToRegulator, setReportedToRegulator] = useState(false)
  const [regulatorRef, setRegulatorRef] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchIncident = useCallback(async () => {
    try {
      const res = await fetch(`/api/compliance/incidents/${id}`)
      const data = await res.json()
      const inc = data.incident || data
      setIncident(inc)
      setStatus(inc.status)
      setSeverity(inc.severity)
      setDescription(inc.description || "")
      setRootCause(inc.rootCause || "")
      setRemediation(inc.remediation || "")
      setAssignedTo(inc.assignedTo || "")
      setReportedToRegulator(inc.reportedToRegulator || false)
      setRegulatorRef(inc.regulatorRef || "")
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchIncident() }, [fetchIncident])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/compliance/incidents/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, severity, description, rootCause, remediation, assignedTo, reportedToRegulator, regulatorRef }),
      })
      fetchIncident()
      setEditing(false)
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (loading) return <div style={{ minHeight: "100vh", background: void_, display: "flex", alignItems: "center", justifyContent: "center", color: textSecondary }}>Loading...</div>
  if (!incident) return <div style={{ minHeight: "100vh", background: void_, display: "flex", alignItems: "center", justifyContent: "center", color: textSecondary }}>Incident not found</div>

  const statusColor = STATUS_COLORS[incident.status] || "#6B7280"
  const severityColor = SEVERITY_COLORS[incident.severity] || "#6B7280"

  return (
    <div style={{ minHeight: "100vh", background: void_, padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.push("/compliance")} style={{ background: "none", border: "none", cursor: "pointer", color: textTertiary, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <ArrowLeft size={16} /> Back to Compliance
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: roseGold, fontWeight: 600, fontFamily: "monospace" }}>{incident.code}</span>
            <span style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: `${statusColor}15`, color: statusColor, textTransform: "uppercase",
            }}>
              {incident.status.replace(/_/g, " ")}
            </span>
            <span style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: `${severityColor}15`, color: severityColor, textTransform: "uppercase",
            }}>
              {incident.severity}
            </span>
            {incident.type === "sar" && (
              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>SAR</span>
            )}
            {incident.reportedToRegulator && (
              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "rgba(139,92,246,0.15)", color: "#8B5CF6" }}>REPORTED TO REGULATOR</span>
            )}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: textPrimary, margin: 0, fontFamily: "'Bellfair', serif" }}>{incident.title}</h1>
          <p style={{ fontSize: 13, color: textSecondary, margin: "4px 0 0" }}>
            {incident.type.replace(/_/g, " ").toUpperCase()} Incident
          </p>
        </div>
        <button onClick={() => setEditing(!editing)} style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}>
          <Edit3 size={14} /> {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing ? (
        /* Edit Form */
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
                <option value="open">Open</option><option value="investigating">Investigating</option>
                <option value="reported">Reported</option><option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
                <option value="critical">Critical</option><option value="high">High</option>
                <option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assigned To</label>
              <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Root Cause</label>
            <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Remediation</label>
            <textarea value={remediation} onChange={(e) => setRemediation(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={reportedToRegulator} onChange={(e) => setReportedToRegulator(e.target.checked)} id="regReported" />
              <label htmlFor="regReported" style={{ fontSize: 13, color: textSecondary, cursor: "pointer" }}>Reported to Regulator</label>
            </div>
            <div>
              <label style={labelStyle}>Regulator Reference</label>
              <input value={regulatorRef} onChange={(e) => setRegulatorRef(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={() => setEditing(false)} style={btnSecondary}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        /* View Mode */
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Description */}
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={14} color={roseGold} /> Description
              </h3>
              <div style={{ fontSize: 13, color: textSecondary, lineHeight: 1.7 }}>
                {incident.description || "No description provided."}
              </div>
            </div>

            {/* Root Cause */}
            {incident.rootCause && (
              <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={14} color="#F59E0B" /> Root Cause
                </h3>
                <div style={{ fontSize: 13, color: textSecondary, lineHeight: 1.7 }}>{incident.rootCause}</div>
              </div>
            )}

            {/* Remediation */}
            {incident.remediation && (
              <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={14} color="#22C55E" /> Remediation
                </h3>
                <div style={{ fontSize: 13, color: textSecondary, lineHeight: 1.7 }}>{incident.remediation}</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Details card */}
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 16px" }}>Details</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: textTertiary }}>Type</span>
                  <span style={{ fontSize: 12, color: textPrimary }}>{incident.type.replace(/_/g, " ").toUpperCase()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: textTertiary }}>Reported By</span>
                  <span style={{ fontSize: 12, color: textPrimary }}>{incident.reportedBy}</span>
                </div>
                {incident.assignedTo && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: textTertiary }}>Assigned To</span>
                    <span style={{ fontSize: 12, color: textPrimary }}>{incident.assignedTo}</span>
                  </div>
                )}
                {incident.entity && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: textTertiary }}>Entity</span>
                    <span style={{ fontSize: 12, color: textPrimary, display: "flex", alignItems: "center", gap: 4 }}>
                      <Building2 size={11} /> {incident.entity.name}
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: textTertiary }}>Created</span>
                  <span style={{ fontSize: 12, color: textPrimary }}>{new Date(incident.createdAt).toLocaleDateString()}</span>
                </div>
                {incident.resolvedAt && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: textTertiary }}>Resolved</span>
                    <span style={{ fontSize: 12, color: "#22C55E" }}>{new Date(incident.resolvedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Impact */}
            {incident.financialImpact != null && incident.financialImpact > 0 && (
              <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <DollarSign size={14} color="#EF4444" /> Financial Impact
                </h3>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#EF4444", fontFamily: "'Bellfair', serif" }}>
                  {incident.currency} {incident.financialImpact.toLocaleString()}
                </div>
              </div>
            )}

            {/* Regulator info */}
            {incident.reportedToRegulator && (
              <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={14} color="#8B5CF6" /> Regulatory Report
                </h3>
                <div style={{ fontSize: 12, color: textSecondary }}>
                  Reported to regulator
                  {incident.regulatorRef && (
                    <span style={{ display: "block", marginTop: 4, color: textPrimary, fontWeight: 500 }}>
                      Ref: {incident.regulatorRef}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
