"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ShieldCheck, FileText, AlertTriangle, GraduationCap, Scale, AlertOctagon,
  Search as SearchIcon, Plus, ChevronDown, X, Filter, Activity,
  CheckCircle2, Clock, XCircle, BarChart3, TrendingUp, Users,
  Building2, Eye, Edit3, Trash2, ArrowUpRight, RefreshCw,
} from "lucide-react"

/* ── types ── */
type Tab = "overview" | "policies" | "risks" | "training" | "licenses" | "incidents"

interface OverviewData {
  policies: Record<string, number>
  risks: Record<string, number>
  avgRiskScore: number
  trainingCompletionRate: number
  trainingTotal: number
  trainingCompleted: number
  incidents: Record<string, number>
  licenses: Record<string, number>
  screening: Record<string, number>
  upcomingDeadlines: Array<{ type: string; title: string; date: string; id: string }>
}

interface Policy {
  id: string; title: string; code: string; category: string; status: string
  priority: string; description?: string; ownerId?: string; reviewerId?: string
  effectiveDate?: string; expiryDate?: string; reviewDate?: string
  entity?: { id: string; name: string }; createdAt: string; updatedAt: string
}

interface Risk {
  id: string; title: string; code: string; category: string; description?: string
  likelihood: number; impact: number; riskScore: number; status: string
  mitigation?: string; residualLikelihood?: number; residualImpact?: number; residualScore?: number
  ownerId?: string; entity?: { id: string; name: string }
  reviewDate?: string; lastAssessedAt?: string; createdAt: string
}

interface TrainingItem {
  id: string; title: string; code: string; category: string; description?: string
  provider?: string; durationHours?: number; frequency?: string; mandatory: boolean
  dueDate?: string; status: string; entity?: { id: string; name: string }
  _count?: { completions: number }; completionRate?: number
  completedCount?: number; totalAssigned?: number
}

interface License {
  id: string; name: string; code?: string; regulator: string; type?: string
  status: string; entityName?: string; grantedDate?: string; expiryDate?: string
  renewalDate?: string; conditions?: string; notes?: string
  entity?: { id: string; name: string }
}

interface Incident {
  id: string; title: string; code: string; type: string; severity: string
  status: string; description?: string; reportedBy: string; assignedTo?: string
  reportedToRegulator: boolean; regulatorRef?: string; reportedAt?: string
  resolvedAt?: string; financialImpact?: number; currency: string
  entity?: { id: string; name: string }; tags: string[]; createdAt: string
}

interface OrgEntity {
  id: string; name: string
}

interface Employee {
  id: string; name: string; email?: string; initials: string; avatarColor: string; icon?: string
}

/* ── style constants ── */
const cardBg = "rgba(15,17,24,0.6)"
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
  fontFamily: "'DM Sans', sans-serif",
}
const btnSecondary: React.CSSProperties = {
  padding: "10px 20px", background: "rgba(255,255,255,0.06)", color: textPrimary,
  border: `1px solid ${cardBorder}`, borderRadius: 10, fontSize: 13, fontWeight: 500,
  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
}

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "policies", label: "Policies", icon: FileText },
  { key: "risks", label: "Risk Register", icon: AlertTriangle },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "licenses", label: "Regulatory", icon: Scale },
  { key: "incidents", label: "Incidents", icon: AlertOctagon },
]

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#EF4444", high: "#F59E0B", medium: "#3B82F6", low: "#6B7280",
}
const STATUS_COLORS: Record<string, string> = {
  active: "#22C55E", approved: "#22C55E", completed: "#22C55E", resolved: "#22C55E", closed: "#6B7280",
  draft: "#6B7280", pending: "#F59E0B", pending_review: "#F59E0B", investigating: "#F59E0B",
  open: "#3B82F6", mitigating: "#F59E0B", monitoring: "#8B5CF6", accepted: "#6B7280",
  expired: "#EF4444", suspended: "#EF4444", revoked: "#EF4444", failed: "#EF4444",
  clear: "#22C55E", match: "#EF4444", potential_match: "#F59E0B",
  archived: "#6B7280",
}
const RISK_CATEGORY_COLORS: Record<string, string> = {
  operational: "#3B82F6", financial: "#22C55E", regulatory: "#F59E0B",
  cyber: "#EF4444", reputational: "#8B5CF6", strategic: "#EC4899", compliance: "#14B8A6",
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "#6B7280"
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
      background: `${color}15`, color, letterSpacing: "0.3px", textTransform: "uppercase",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      {status.replace(/_/g, " ")}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLORS[severity] || "#6B7280"
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
      background: `${color}15`, color, textTransform: "uppercase",
    }}>
      {severity}
    </span>
  )
}

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType
}) {
  return (
    <div style={{
      background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14,
      padding: "20px 24px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 16, right: 16, opacity: 0.15 }}>
        <Icon size={32} color={color} />
      </div>
      <div style={{ fontSize: 11, color: textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: textPrimary, fontFamily: "'Bellfair', serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: textTertiary, marginTop: 4 }}>{sub}</div>}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, transparent)` }} />
    </div>
  )
}

/* ── Modal Wrapper ── */
function Modal({ open, onClose, title, children, width }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number
}) {
  if (!open) return null
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
    }} onClick={onClose}>
      <div style={{
        background: "#0D0F14", border: `1px solid ${cardBorder}`, borderRadius: 16,
        width: width || 560, maxHeight: "85vh", overflow: "auto", padding: 0,
        animation: "slideUp 0.3s ease",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 28px", borderBottom: `1px solid ${cardBorder}`,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: textPrimary, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: textTertiary }}><X size={18} /></button>
        </div>
        <div style={{ padding: "24px 28px" }}>{children}</div>
      </div>
    </div>
  )
}

/* ───────────────────── MAIN PAGE ───────────────────── */
export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>("overview")
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [trainings, setTrainings] = useState<TrainingItem[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [entities, setEntities] = useState<OrgEntity[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Filters
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterEntity, setFilterEntity] = useState("all")

  // Modals
  const [showAddPolicy, setShowAddPolicy] = useState(false)
  const [showAddRisk, setShowAddRisk] = useState(false)
  const [showAddTraining, setShowAddTraining] = useState(false)
  const [showAddLicense, setShowAddLicense] = useState(false)
  const [showAddIncident, setShowAddIncident] = useState(false)
  const [showAddScreening, setShowAddScreening] = useState(false)

  // Edit modals
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null)
  const [editRisk, setEditRisk] = useState<Risk | null>(null)
  const [editIncident, setEditIncident] = useState<Incident | null>(null)

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/compliance/overview")
      if (!res.ok) return
      const data = await res.json()
      if (data.error) return
      setOverview({
        policies: data.policies || {},
        risks: data.risks || {},
        avgRiskScore: data.avgRiskScore || 0,
        trainingCompletionRate: data.trainingCompletionRate || 0,
        trainingTotal: data.trainingTotal || 0,
        trainingCompleted: data.trainingCompleted || 0,
        incidents: data.incidents || {},
        licenses: data.licenses || {},
        screening: data.screening || {},
        upcomingDeadlines: data.upcomingDeadlines || [],
      })
    } catch { /* ignore */ }
  }, [])

  const fetchPolicies = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterCategory !== "all") params.set("category", filterCategory)
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (filterEntity !== "all") params.set("entityId", filterEntity)
    if (search) params.set("search", search)
    try {
      const res = await fetch(`/api/compliance/policies?${params}`)
      const data = await res.json()
      setPolicies(data.policies || [])
    } catch { /* ignore */ }
  }, [filterCategory, filterStatus, filterEntity, search])

  const fetchRisks = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterCategory !== "all") params.set("category", filterCategory)
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (filterEntity !== "all") params.set("entityId", filterEntity)
    try {
      const res = await fetch(`/api/compliance/risks?${params}`)
      const data = await res.json()
      setRisks(data.risks || [])
    } catch { /* ignore */ }
  }, [filterCategory, filterStatus, filterEntity])

  const fetchTrainings = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterCategory !== "all") params.set("category", filterCategory)
    if (filterEntity !== "all") params.set("entityId", filterEntity)
    try {
      const res = await fetch(`/api/compliance/training?${params}`)
      const data = await res.json()
      // Map completionStats from API to the fields the UI expects
      const mapped = (data.trainings || []).map((t: TrainingItem & { completionStats?: { total: number; completed: number; rate: number } }) => ({
        ...t,
        completionRate: t.completionStats?.rate ?? t.completionRate ?? 0,
        completedCount: t.completionStats?.completed ?? t.completedCount ?? 0,
        totalAssigned: t.completionStats?.total ?? t.totalAssigned ?? 0,
      }))
      setTrainings(mapped)
    } catch { /* ignore */ }
  }, [filterCategory, filterEntity])

  const fetchLicenses = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterEntity !== "all") params.set("entityId", filterEntity)
    try {
      const res = await fetch(`/api/compliance/licenses?${params}`)
      const data = await res.json()
      setLicenses(data.licenses || [])
    } catch { /* ignore */ }
  }, [filterEntity])

  const fetchIncidents = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterCategory !== "all") params.set("type", filterCategory)
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (filterEntity !== "all") params.set("entityId", filterEntity)
    try {
      const res = await fetch(`/api/compliance/incidents?${params}`)
      const data = await res.json()
      setIncidents(data.incidents || [])
    } catch { /* ignore */ }
  }, [filterCategory, filterStatus, filterEntity])

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch("/api/org-entities")
      const data = await res.json()
      setEntities(data.entities || [])
    } catch { /* ignore */ }
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees")
      const data = await res.json()
      setEmployees(data.employees || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEntities(), fetchEmployees()]).then(() => setLoading(false))
  }, [fetchEntities, fetchEmployees])

  useEffect(() => {
    if (tab === "overview") fetchOverview()
    if (tab === "policies") fetchPolicies()
    if (tab === "risks") fetchRisks()
    if (tab === "training") fetchTrainings()
    if (tab === "licenses") fetchLicenses()
    if (tab === "incidents") fetchIncidents()
  }, [tab, fetchOverview, fetchPolicies, fetchRisks, fetchTrainings, fetchLicenses, fetchIncidents])

  // Reset filters on tab change
  useEffect(() => {
    setFilterCategory("all")
    setFilterStatus("all")
    setFilterEntity("all")
    setSearch("")
  }, [tab])

  const refreshTab = () => {
    if (tab === "overview") fetchOverview()
    if (tab === "policies") fetchPolicies()
    if (tab === "risks") fetchRisks()
    if (tab === "training") fetchTrainings()
    if (tab === "licenses") fetchLicenses()
    if (tab === "incidents") fetchIncidents()
  }

  /* ── DELETE helpers ── */
  const deleteItem = async (endpoint: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return
    try {
      await fetch(endpoint, { method: "DELETE" })
      refreshTab()
    } catch { /* ignore */ }
  }

  /* ── Seed licenses ── */
  const seedLicenses = async () => {
    try {
      await fetch("/api/compliance/seed", { method: "POST" })
      fetchLicenses()
    } catch { /* ignore */ }
  }

  /* ── RENDER ── */
  return (
    <div style={{ minHeight: "100vh", background: void_, padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: textPrimary, margin: 0, fontFamily: "'Bellfair', serif", display: "flex", alignItems: "center", gap: 12 }}>
            <ShieldCheck size={28} color={roseGold} />
            Compliance
          </h1>
          <p style={{ fontSize: 13, color: textSecondary, margin: "4px 0 0" }}>
            Policies, risk, training, licenses & incident management
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {tab === "policies" && (
            <button onClick={() => setShowAddPolicy(true)} style={btnPrimary}>
              <Plus size={14} style={{ marginRight: 6 }} /> New Policy
            </button>
          )}
          {tab === "risks" && (
            <button onClick={() => setShowAddRisk(true)} style={btnPrimary}>
              <Plus size={14} style={{ marginRight: 6 }} /> New Risk
            </button>
          )}
          {tab === "training" && (
            <button onClick={() => setShowAddTraining(true)} style={btnPrimary}>
              <Plus size={14} style={{ marginRight: 6 }} /> New Training
            </button>
          )}
          {tab === "licenses" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={seedLicenses} style={btnSecondary}>
                <RefreshCw size={14} style={{ marginRight: 6 }} /> Seed Licenses
              </button>
              <button onClick={() => setShowAddLicense(true)} style={btnPrimary}>
                <Plus size={14} style={{ marginRight: 6 }} /> New License
              </button>
            </div>
          )}
          {tab === "incidents" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAddScreening(true)} style={btnSecondary}>
                <SearchIcon size={14} style={{ marginRight: 6 }} /> New Screening
              </button>
              <button onClick={() => setShowAddIncident(true)} style={btnPrimary}>
                <Plus size={14} style={{ marginRight: 6 }} /> New Incident
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 28, background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 4, width: "fit-content" }}>
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              background: active ? roseGold : "transparent", color: active ? void_ : textSecondary,
              border: "none", borderRadius: 10, fontSize: 13, fontWeight: active ? 600 : 400,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
            }}>
              <t.icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Filters row (for non-overview tabs) */}
      {tab !== "overview" && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
          {(tab === "policies" || tab === "risks" || tab === "training" || tab === "incidents") && (
            <div style={{ position: "relative" }}>
              <Filter size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: textTertiary }} />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{
                ...inputStyle, width: 180, paddingLeft: 32, appearance: "none", cursor: "pointer",
              }}>
                <option value="all">All Categories</option>
                {tab === "policies" && <>
                  <option value="aml">AML</option><option value="kyc">KYC</option>
                  <option value="data_protection">Data Protection</option><option value="operational">Operational</option>
                  <option value="conduct">Conduct</option><option value="it_security">IT Security</option><option value="hr">HR</option>
                </>}
                {tab === "risks" && <>
                  <option value="operational">Operational</option><option value="financial">Financial</option>
                  <option value="regulatory">Regulatory</option><option value="cyber">Cyber</option>
                  <option value="reputational">Reputational</option><option value="strategic">Strategic</option>
                  <option value="compliance">Compliance</option>
                </>}
                {tab === "training" && <>
                  <option value="aml">AML</option><option value="kyc">KYC</option>
                  <option value="data_protection">Data Protection</option><option value="conduct">Conduct</option>
                  <option value="it_security">IT Security</option><option value="orias">ORIAS</option><option value="general">General</option>
                </>}
                {tab === "incidents" && <>
                  <option value="sar">SAR</option><option value="breach">Breach</option>
                  <option value="complaint">Complaint</option><option value="near_miss">Near Miss</option>
                  <option value="audit_finding">Audit Finding</option><option value="regulatory_inquiry">Regulatory Inquiry</option>
                </>}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: textTertiary, pointerEvents: "none" }} />
            </div>
          )}

          {(tab === "policies" || tab === "risks" || tab === "incidents") && (
            <div style={{ position: "relative" }}>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{
                ...inputStyle, width: 160, appearance: "none", cursor: "pointer",
              }}>
                <option value="all">All Statuses</option>
                {tab === "policies" && <>
                  <option value="draft">Draft</option><option value="pending_review">Pending Review</option>
                  <option value="approved">Approved</option><option value="active">Active</option>
                  <option value="expired">Expired</option><option value="archived">Archived</option>
                </>}
                {tab === "risks" && <>
                  <option value="open">Open</option><option value="mitigating">Mitigating</option>
                  <option value="accepted">Accepted</option><option value="monitoring">Monitoring</option>
                  <option value="closed">Closed</option>
                </>}
                {tab === "incidents" && <>
                  <option value="open">Open</option><option value="investigating">Investigating</option>
                  <option value="reported">Reported</option><option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </>}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: textTertiary, pointerEvents: "none" }} />
            </div>
          )}

          {entities.length > 0 && (
            <div style={{ position: "relative" }}>
              <Building2 size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: textTertiary }} />
              <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} style={{
                ...inputStyle, width: 180, paddingLeft: 32, appearance: "none", cursor: "pointer",
              }}>
                <option value="all">All Entities</option>
                {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: textTertiary, pointerEvents: "none" }} />
            </div>
          )}

          {tab === "policies" && (
            <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
              <SearchIcon size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: textTertiary }} />
              <input
                placeholder="Search policies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 32 }}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab Content */}
      {tab === "overview" && <OverviewTab overview={overview} />}
      {tab === "policies" && <PoliciesTab policies={policies} onDelete={(id) => deleteItem(`/api/compliance/policies/${id}`)} onEdit={setEditPolicy} />}
      {tab === "risks" && <RisksTab risks={risks} onDelete={(id) => deleteItem(`/api/compliance/risks/${id}`)} onEdit={setEditRisk} />}
      {tab === "training" && <TrainingTab trainings={trainings} employees={employees} onRefresh={refreshTab} />}
      {tab === "licenses" && <LicensesTab licenses={licenses} onDelete={(id) => deleteItem(`/api/compliance/licenses/${id}`)} />}
      {tab === "incidents" && <IncidentsTab incidents={incidents} onDelete={(id) => deleteItem(`/api/compliance/incidents/${id}`)} onEdit={setEditIncident} />}

      {/* ── MODALS ── */}
      <AddPolicyModal open={showAddPolicy} onClose={() => setShowAddPolicy(false)} entities={entities} employees={employees} onSaved={refreshTab} />
      <AddRiskModal open={showAddRisk} onClose={() => setShowAddRisk(false)} entities={entities} employees={employees} onSaved={refreshTab} />
      <AddTrainingModal open={showAddTraining} onClose={() => setShowAddTraining(false)} entities={entities} onSaved={refreshTab} />
      <AddLicenseModal open={showAddLicense} onClose={() => setShowAddLicense(false)} entities={entities} onSaved={refreshTab} />
      <AddIncidentModal open={showAddIncident} onClose={() => setShowAddIncident(false)} entities={entities} employees={employees} onSaved={refreshTab} />
      <AddScreeningModal open={showAddScreening} onClose={() => setShowAddScreening(false)} onSaved={refreshTab} />
      {editPolicy && <EditPolicyModal policy={editPolicy} onClose={() => setEditPolicy(null)} entities={entities} employees={employees} onSaved={refreshTab} />}
      {editRisk && <EditRiskModal risk={editRisk} onClose={() => setEditRisk(null)} entities={entities} employees={employees} onSaved={refreshTab} />}
      {editIncident && <EditIncidentModal incident={editIncident} onClose={() => setEditIncident(null)} entities={entities} employees={employees} onSaved={refreshTab} />}

      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  OVERVIEW TAB                          ═══ */
/* ═══════════════════════════════════════════════ */
function OverviewTab({ overview }: { overview: OverviewData | null }) {
  if (!overview) return <div style={{ color: textSecondary, textAlign: "center", padding: 60 }}>Loading overview...</div>

  const totalPolicies = Object.values(overview.policies).reduce((a, b) => a + b, 0)
  const totalIncidents = Object.values(overview.incidents).reduce((a, b) => a + b, 0)
  const totalLicenses = Object.values(overview.licenses).reduce((a, b) => a + b, 0)
  const openRisks = (overview.risks["open"] || 0) + (overview.risks["mitigating"] || 0) + (overview.risks["monitoring"] || 0)

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        <KpiCard label="Active Policies" value={overview.policies["active"] || 0} sub={`${totalPolicies} total`} color="#22C55E" icon={FileText} />
        <KpiCard label="Open Risks" value={openRisks} sub={`Avg score: ${overview.avgRiskScore?.toFixed(1) || "—"}`} color="#F59E0B" icon={AlertTriangle} />
        <KpiCard label="Training Rate" value={`${overview.trainingCompletionRate?.toFixed(0) || 0}%`} sub={`${overview.trainingCompleted || 0}/${overview.trainingTotal || 0} completed`} color="#3B82F6" icon={GraduationCap} />
        <KpiCard label="Active Licenses" value={overview.licenses["active"] || 0} sub={`${totalLicenses} total`} color="#8B5CF6" icon={Scale} />
        <KpiCard label="Open Incidents" value={(overview.incidents["open"] || 0) + (overview.incidents["investigating"] || 0)} sub={`${totalIncidents} total`} color="#EF4444" icon={AlertOctagon} />
        <KpiCard label="Screenings" value={overview.screening["clear"] || 0} sub={`${overview.screening["match"] || 0} matches`} color={roseGold} icon={SearchIcon} />
      </div>

      {/* Risk Heatmap + Upcoming Deadlines */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Risk Heatmap */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={16} color={roseGold} /> Risk Heatmap
          </h3>
          <RiskHeatmap />
        </div>

        {/* Upcoming Deadlines */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} color={roseGold} /> Upcoming Deadlines
          </h3>
          {(!overview.upcomingDeadlines || overview.upcomingDeadlines.length === 0) ? (
            <p style={{ color: textTertiary, fontSize: 13, textAlign: "center", padding: 20 }}>No upcoming deadlines</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {overview.upcomingDeadlines.slice(0, 8).map((d, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8,
                }}>
                  <div>
                    <span style={{ fontSize: 12, color: textPrimary, fontWeight: 500 }}>{d.title}</span>
                    <span style={{
                      fontSize: 10, color: textTertiary, marginLeft: 8,
                      padding: "2px 6px", background: "rgba(255,255,255,0.06)", borderRadius: 4,
                    }}>{d.type}</span>
                  </div>
                  <span style={{ fontSize: 11, color: roseGold }}>{new Date(d.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compliance Score Summary */}
      <div style={{
        background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24, marginTop: 16,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={16} color={roseGold} /> Compliance Summary
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <ComplianceBar label="Policies Approved" value={overview.policies["active"] || 0} total={totalPolicies} color="#22C55E" />
          <ComplianceBar label="Risks Mitigated" value={(overview.risks["accepted"] || 0) + (overview.risks["closed"] || 0)} total={Object.values(overview.risks).reduce((a, b) => a + b, 0)} color="#F59E0B" />
          <ComplianceBar label="Training Complete" value={overview.trainingCompleted || 0} total={overview.trainingTotal || 0} color="#3B82F6" />
          <ComplianceBar label="Incidents Resolved" value={(overview.incidents["resolved"] || 0) + (overview.incidents["closed"] || 0)} total={totalIncidents} color="#8B5CF6" />
        </div>
      </div>

      {/* Marketing Content Pending Review */}
      <PendingContentReview />
    </div>
  )
}

function ComplianceBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: textSecondary }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: 10, color: textTertiary, marginTop: 4 }}>{value} / {total}</div>
    </div>
  )
}

function RiskHeatmap() {
  const levels = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"]
  const impacts = ["Insignificant", "Minor", "Moderate", "Major", "Catastrophic"]
  const getColor = (l: number, i: number) => {
    const score = (l + 1) * (i + 1)
    if (score >= 16) return "#EF4444"
    if (score >= 10) return "#F59E0B"
    if (score >= 5) return "#3B82F6"
    return "#22C55E"
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
        <div style={{ width: 80 }} />
        {impacts.map((imp, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: textTertiary, padding: "0 2px 4px", lineHeight: 1.2 }}>{imp}</div>
        ))}
      </div>
      {[...levels].reverse().map((lvl, li) => (
        <div key={li} style={{ display: "flex", gap: 2, marginBottom: 2 }}>
          <div style={{ width: 80, fontSize: 9, color: textTertiary, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 }}>{lvl}</div>
          {impacts.map((_, ii) => {
            const l = 4 - li
            const color = getColor(l, ii)
            return (
              <div key={ii} style={{
                flex: 1, aspectRatio: "1", borderRadius: 4,
                background: `${color}30`, border: `1px solid ${color}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 600, color,
              }}>
                {(l + 1) * (ii + 1)}
              </div>
            )
          })}
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12 }}>
        {[{ label: "Low (1-4)", color: "#22C55E" }, { label: "Medium (5-9)", color: "#3B82F6" },
          { label: "High (10-15)", color: "#F59E0B" }, { label: "Critical (16-25)", color: "#EF4444" }
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: textTertiary }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function PendingContentReview() {
  const [pending, setPending] = useState<{ id: string; contentText: string; platform: string; status: string; score: number | null; overallRisk: string | null; createdBy: string; createdAt: string }[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/marketing/compliance-checks/pending")
      .then((r) => r.json())
      .then((data) => { setPending(data.checks ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || pending.length === 0) return null

  return (
    <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24, marginTop: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldCheck size={16} color="#FBBF24" /> Marketing Content Pending Review
        <span style={{ fontSize: 11, fontWeight: 400, color: "#FBBF24", background: "rgba(251,191,36,0.15)", padding: "2px 8px", borderRadius: 10 }}>
          {pending.length}
        </span>
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pending.map((c) => {
          const preview = c.contentText.length > 80 ? c.contentText.slice(0, 80) + "..." : c.contentText
          const riskColor = c.overallRisk === "critical" ? "#EF4444" : c.overallRisk === "high" ? "#F59E0B" : c.overallRisk === "medium" ? "#FBBF24" : "#9CA3AF"
          return (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8,
              border: `1px solid ${cardBorder}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: textPrimary, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: textSecondary, textTransform: "capitalize" }}>{c.platform}</span>
                  <span style={{ fontSize: 10, color: riskColor, fontWeight: 600 }}>
                    {c.status === "rejected" ? "❌ Rejected" : "⚠️ Needs Changes"} · {c.score !== null ? `${c.score}/100` : ""}
                  </span>
                  <span style={{ fontSize: 10, color: textTertiary }}>by {c.createdBy} · {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <a
                href="/marketing"
                style={{ fontSize: 11, color: roseGold, textDecoration: "none", padding: "4px 10px", borderRadius: 4, background: "rgba(192,139,136,0.1)", whiteSpace: "nowrap" }}
              >
                Review →
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  POLICIES TAB                          ═══ */
/* ═══════════════════════════════════════════════ */
function PoliciesTab({ policies, onDelete, onEdit }: { policies: Policy[]; onDelete: (id: string) => void; onEdit: (p: Policy) => void }) {
  if (policies.length === 0) return <EmptyState icon={FileText} message="No policies found" sub="Create your first compliance policy" />
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {policies.map((p) => (
        <div key={p.id} style={{
          background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14,
          padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
          borderLeft: `3px solid ${SEVERITY_COLORS[p.priority] || "#6B7280"}`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: roseGold, fontWeight: 600, fontFamily: "monospace" }}>{p.code}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{p.title}</span>
              <StatusBadge status={p.status} />
              <SeverityBadge severity={p.priority} />
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11, color: textTertiary }}>
              <span>{p.category.replace(/_/g, " ").toUpperCase()}</span>
              {p.entity && <span><Building2 size={11} style={{ marginRight: 3 }} />{p.entity.name}</span>}
              {p.reviewDate && <span>Review: {new Date(p.reviewDate).toLocaleDateString()}</span>}
              {p.effectiveDate && <span>Effective: {new Date(p.effectiveDate).toLocaleDateString()}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <a href={`/compliance/policies/${p.id}`} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <Eye size={12} /> View
            </a>
            <button onClick={() => onEdit(p)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={() => onDelete(p.id)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, color: "#EF4444", display: "flex", alignItems: "center", gap: 4 }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  RISKS TAB                             ═══ */
/* ═══════════════════════════════════════════════ */
function RisksTab({ risks, onDelete, onEdit }: { risks: Risk[]; onDelete: (id: string) => void; onEdit: (r: Risk) => void }) {
  if (risks.length === 0) return <EmptyState icon={AlertTriangle} message="No risks registered" sub="Add risks to your risk register" />

  return (
    <div>
      {/* Risk summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {Object.entries(RISK_CATEGORY_COLORS).map(([cat, color]) => {
          const count = risks.filter((r) => r.category === cat).length
          return (
            <div key={cat} style={{
              background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10,
              padding: "12px 16px", borderLeft: `3px solid ${color}`,
            }}>
              <div style={{ fontSize: 10, color: textTertiary, textTransform: "uppercase", marginBottom: 4 }}>{cat}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: textPrimary }}>{count}</div>
            </div>
          )
        })}
      </div>

      {/* Risk list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {risks.map((r) => {
          const scoreColor = r.riskScore >= 16 ? "#EF4444" : r.riskScore >= 10 ? "#F59E0B" : r.riskScore >= 5 ? "#3B82F6" : "#22C55E"
          return (
            <div key={r.id} style={{
              background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14,
              padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
              borderLeft: `3px solid ${scoreColor}`,
            }}>
              {/* Score badge */}
              <div style={{
                width: 48, height: 48, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: `${scoreColor}15`, border: `1px solid ${scoreColor}30`, flexShrink: 0,
              }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor }}>{r.riskScore}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: roseGold, fontWeight: 600, fontFamily: "monospace" }}>{r.code}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{r.title}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: textTertiary }}>
                  <span style={{ color: RISK_CATEGORY_COLORS[r.category] || textTertiary }}>{r.category}</span>
                  <span>L:{r.likelihood} x I:{r.impact}</span>
                  {r.residualScore && <span>Residual: {r.residualScore}</span>}
                  {r.entity && <span><Building2 size={11} style={{ marginRight: 3 }} />{r.entity.name}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => onEdit(r)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                  <Edit3 size={12} /> Edit
                </button>
                <button onClick={() => onDelete(r.id)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, color: "#EF4444", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  TRAINING TAB                          ═══ */
/* ═══════════════════════════════════════════════ */
function TrainingTab({ trainings, employees, onRefresh }: { trainings: TrainingItem[]; employees: Employee[]; onRefresh: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [completions, setCompletions] = useState<Record<string, Array<{ employeeId: string; status: string; completedAt?: string; employee?: { name: string } }>>>({})

  const loadCompletions = async (trainingId: string) => {
    if (completions[trainingId]) { setExpandedId(expandedId === trainingId ? null : trainingId); return }
    try {
      const res = await fetch(`/api/compliance/training/${trainingId}/completions`)
      const data = await res.json()
      setCompletions((prev) => ({ ...prev, [trainingId]: data.completions || [] }))
      setExpandedId(trainingId)
    } catch { setExpandedId(trainingId) }
  }

  const markComplete = async (trainingId: string, employeeId: string) => {
    try {
      await fetch(`/api/compliance/training/${trainingId}/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, status: "completed", completedAt: new Date().toISOString() }),
      })
      // Refresh completions
      const res = await fetch(`/api/compliance/training/${trainingId}/completions`)
      const data = await res.json()
      setCompletions((prev) => ({ ...prev, [trainingId]: data.completions || [] }))
      onRefresh()
    } catch { /* ignore */ }
  }

  if (trainings.length === 0) return <EmptyState icon={GraduationCap} message="No training programs" sub="Create training requirements for your team" />

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {trainings.map((t) => {
        const expanded = expandedId === t.id
        const rate = t.completionRate ?? 0
        const rateColor = rate >= 80 ? "#22C55E" : rate >= 50 ? "#F59E0B" : "#EF4444"
        return (
          <div key={t.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{
              padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
            }} onClick={() => loadCompletions(t.id)}>
              {/* Completion circle */}
              <div style={{
                width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: `conic-gradient(${rateColor} ${rate * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
                position: "relative", flexShrink: 0,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", background: cardBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: rateColor }}>{Math.round(rate)}%</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: roseGold, fontWeight: 600, fontFamily: "monospace" }}>{t.code}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{t.title}</span>
                  {t.mandatory && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.15)", color: "#EF4444", fontWeight: 600 }}>MANDATORY</span>}
                  <StatusBadge status={t.status} />
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 11, color: textTertiary }}>
                  <span>{t.category.replace(/_/g, " ").toUpperCase()}</span>
                  {t.provider && <span>{t.provider}</span>}
                  {t.frequency && <span>{t.frequency}</span>}
                  {t.dueDate && <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>}
                  <span>{t.completedCount || 0}/{t.totalAssigned || 0} completed</span>
                </div>
              </div>
              <ChevronDown size={16} color={textTertiary} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </div>

            {/* Expanded: show completions */}
            {expanded && (
              <div style={{ borderTop: `1px solid ${cardBorder}`, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: textSecondary }}>Employee Completions</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                  {employees.map((emp) => {
                    const comp = (completions[t.id] || []).find((c) => c.employeeId === emp.id)
                    const done = comp?.status === "completed"
                    return (
                      <div key={emp.id} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                        background: "rgba(255,255,255,0.03)", borderRadius: 8,
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", background: emp.avatarColor || "rgba(255,255,255,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff", flexShrink: 0,
                        }}>
                          {emp.icon || emp.initials}
                        </div>
                        <span style={{ fontSize: 12, color: textPrimary, flex: 1 }}>{emp.name}</span>
                        {done ? (
                          <span style={{ fontSize: 10, color: "#22C55E", display: "flex", alignItems: "center", gap: 3 }}>
                            <CheckCircle2 size={12} /> Done
                          </span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); markComplete(t.id, emp.id) }} style={{
                            padding: "4px 10px", background: "rgba(34,197,94,0.15)", color: "#22C55E",
                            border: "none", borderRadius: 6, fontSize: 10, cursor: "pointer", fontWeight: 600,
                          }}>
                            Mark Complete
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  LICENSES TAB                          ═══ */
/* ═══════════════════════════════════════════════ */
function LicensesTab({ licenses, onDelete }: { licenses: License[]; onDelete: (id: string) => void }) {
  if (licenses.length === 0) return <EmptyState icon={Scale} message="No regulatory licenses" sub="Add licenses or seed default data" />

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
      {licenses.map((lic) => (
        <div key={lic.id} style={{
          background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14,
          padding: 24, position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: STATUS_COLORS[lic.status] || "#6B7280" }} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: textPrimary, marginBottom: 4 }}>{lic.name}</div>
              <div style={{ fontSize: 12, color: roseGold }}>{lic.regulator}</div>
            </div>
            <StatusBadge status={lic.status} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 12 }}>
            {lic.type && <div><span style={{ color: textTertiary }}>Type:</span> <span style={{ color: textSecondary }}>{lic.type}</span></div>}
            {lic.code && <div><span style={{ color: textTertiary }}>License #:</span> <span style={{ color: textSecondary }}>{lic.code}</span></div>}
            {lic.entityName && <div><span style={{ color: textTertiary }}>Entity:</span> <span style={{ color: textSecondary }}>{lic.entityName}</span></div>}
            {lic.grantedDate && <div><span style={{ color: textTertiary }}>Granted:</span> <span style={{ color: textSecondary }}>{new Date(lic.grantedDate).toLocaleDateString()}</span></div>}
            {lic.expiryDate && <div><span style={{ color: textTertiary }}>Expires:</span> <span style={{ color: textSecondary }}>{new Date(lic.expiryDate).toLocaleDateString()}</span></div>}
            {lic.renewalDate && <div><span style={{ color: textTertiary }}>Renewal:</span> <span style={{ color: textSecondary }}>{new Date(lic.renewalDate).toLocaleDateString()}</span></div>}
          </div>
          {lic.conditions && <div style={{ marginTop: 12, fontSize: 11, color: textTertiary, lineHeight: 1.5 }}>{lic.conditions}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={() => onDelete(lic.id)} style={{ ...btnSecondary, padding: "4px 10px", fontSize: 10, color: "#EF4444" }}>
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  INCIDENTS TAB                         ═══ */
/* ═══════════════════════════════════════════════ */
function IncidentsTab({ incidents, onDelete, onEdit }: { incidents: Incident[]; onDelete: (id: string) => void; onEdit: (i: Incident) => void }) {
  if (incidents.length === 0) return <EmptyState icon={AlertOctagon} message="No incidents recorded" sub="Log compliance incidents and SARs here" />

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {incidents.map((inc) => (
        <div key={inc.id} style={{
          background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14,
          padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
          borderLeft: `3px solid ${SEVERITY_COLORS[inc.severity] || "#6B7280"}`,
        }}>
          {inc.type === "sar" && (
            <div style={{
              width: 40, height: 40, borderRadius: 8, background: "rgba(239,68,68,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <AlertOctagon size={20} color="#EF4444" />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: roseGold, fontWeight: 600, fontFamily: "monospace" }}>{inc.code}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{inc.title}</span>
              <StatusBadge status={inc.status} />
              <SeverityBadge severity={inc.severity} />
              {inc.type === "sar" && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.15)", color: "#EF4444", fontWeight: 700 }}>SAR</span>}
              {inc.reportedToRegulator && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(139,92,246,0.15)", color: "#8B5CF6", fontWeight: 600 }}>REPORTED</span>}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11, color: textTertiary }}>
              <span>{inc.type.replace(/_/g, " ").toUpperCase()}</span>
              {inc.entity && <span><Building2 size={11} style={{ marginRight: 3 }} />{inc.entity.name}</span>}
              <span>Reported: {new Date(inc.createdAt).toLocaleDateString()}</span>
              {inc.financialImpact && <span>Impact: {inc.currency} {inc.financialImpact.toLocaleString()}</span>}
              {inc.resolvedAt && <span>Resolved: {new Date(inc.resolvedAt).toLocaleDateString()}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <a href={`/compliance/incidents/${inc.id}`} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              <Eye size={12} /> View
            </a>
            <button onClick={() => onEdit(inc)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={() => onDelete(inc.id)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 11, color: "#EF4444", display: "flex", alignItems: "center", gap: 4 }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  EMPTY STATE                           ═══ */
/* ═══════════════════════════════════════════════ */
function EmptyState({ icon: Icon, message, sub }: { icon: React.ElementType; message: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <Icon size={40} color={textTertiary} style={{ marginBottom: 16 }} />
      <div style={{ fontSize: 16, fontWeight: 600, color: textSecondary, marginBottom: 4 }}>{message}</div>
      <div style={{ fontSize: 13, color: textTertiary }}>{sub}</div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  ADD POLICY MODAL                      ═══ */
/* ═══════════════════════════════════════════════ */
function AddPolicyModal({ open, onClose, entities, employees, onSaved }: {
  open: boolean; onClose: () => void; entities: OrgEntity[]; employees: Employee[]; onSaved: () => void
}) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("aml")
  const [priority, setPriority] = useState("medium")
  const [description, setDescription] = useState("")
  const [entityId, setEntityId] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [reviewDate, setReviewDate] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title) return
    setSaving(true)
    try {
      await fetch("/api/compliance/policies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, priority, description, entityId: entityId || undefined, ownerId: ownerId || undefined, reviewDate: reviewDate || undefined }),
      })
      onSaved(); onClose()
      setTitle(""); setDescription(""); setCategory("aml"); setPriority("medium"); setEntityId(""); setOwnerId(""); setReviewDate("")
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="New Policy">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Anti-Money Laundering Policy" style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              <option value="aml">AML</option><option value="kyc">KYC</option>
              <option value="data_protection">Data Protection</option><option value="operational">Operational</option>
              <option value="conduct">Conduct</option><option value="it_security">IT Security</option><option value="hr">HR</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              <option value="critical">Critical</option><option value="high">High</option>
              <option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Entity</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              <option value="">All Entities</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.id} value={e.email || e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Next Review Date</label>
          <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !title} style={{ ...btnPrimary, opacity: saving || !title ? 0.5 : 1 }}>
            {saving ? "Creating..." : "Create Policy"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  EDIT POLICY MODAL                     ═══ */
/* ═══════════════════════════════════════════════ */
function EditPolicyModal({ policy, onClose, entities, employees, onSaved }: {
  policy: Policy; onClose: () => void; entities: OrgEntity[]; employees: Employee[]; onSaved: () => void
}) {
  const [title, setTitle] = useState(policy.title)
  const [category, setCategory] = useState(policy.category)
  const [priority, setPriority] = useState(policy.priority)
  const [status, setStatus] = useState(policy.status)
  const [description, setDescription] = useState(policy.description || "")
  const [entityId, setEntityId] = useState(policy.entity?.id || "")
  const [ownerId, setOwnerId] = useState(policy.ownerId || "")
  const [reviewDate, setReviewDate] = useState(policy.reviewDate ? policy.reviewDate.slice(0, 10) : "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/compliance/policies/${policy.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, priority, status, description, entityId: entityId || null, ownerId: ownerId || null, reviewDate: reviewDate || null }),
      })
      onSaved(); onClose()
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Modal open={true} onClose={onClose} title={`Edit ${policy.code}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="aml">AML</option><option value="kyc">KYC</option>
              <option value="data_protection">Data Protection</option><option value="operational">Operational</option>
              <option value="conduct">Conduct</option><option value="it_security">IT Security</option><option value="hr">HR</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="critical">Critical</option><option value="high">High</option>
              <option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="draft">Draft</option><option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option><option value="active">Active</option>
              <option value="expired">Expired</option><option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Entity</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">All Entities</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.id} value={e.email || e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Next Review Date</label>
          <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  ADD RISK MODAL                        ═══ */
/* ═══════════════════════════════════════════════ */
function AddRiskModal({ open, onClose, entities, employees, onSaved }: {
  open: boolean; onClose: () => void; entities: OrgEntity[]; employees: Employee[]; onSaved: () => void
}) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("operational")
  const [description, setDescription] = useState("")
  const [likelihood, setLikelihood] = useState(3)
  const [impact, setImpact] = useState(3)
  const [mitigation, setMitigation] = useState("")
  const [entityId, setEntityId] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title) return
    setSaving(true)
    try {
      await fetch("/api/compliance/risks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, description, likelihood, impact, mitigation, entityId: entityId || undefined, ownerId: ownerId || undefined }),
      })
      onSaved(); onClose()
      setTitle(""); setDescription(""); setMitigation(""); setCategory("operational"); setLikelihood(3); setImpact(3); setEntityId(""); setOwnerId("")
    } catch { /* ignore */ }
    setSaving(false)
  }

  const score = likelihood * impact
  const scoreColor = score >= 16 ? "#EF4444" : score >= 10 ? "#F59E0B" : score >= 5 ? "#3B82F6" : "#22C55E"

  return (
    <Modal open={open} onClose={onClose} title="New Risk">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Data breach risk" style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="operational">Operational</option><option value="financial">Financial</option>
              <option value="regulatory">Regulatory</option><option value="cyber">Cyber</option>
              <option value="reputational">Reputational</option><option value="strategic">Strategic</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: textTertiary, marginBottom: 4 }}>Risk Score</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor }}>{score}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Likelihood (1-5)</label>
            <input type="range" min={1} max={5} value={likelihood} onChange={(e) => setLikelihood(parseInt(e.target.value))} style={{ width: "100%" }} />
            <div style={{ textAlign: "center", fontSize: 12, color: textSecondary }}>{likelihood}</div>
          </div>
          <div>
            <label style={labelStyle}>Impact (1-5)</label>
            <input type="range" min={1} max={5} value={impact} onChange={(e) => setImpact(parseInt(e.target.value))} style={{ width: "100%" }} />
            <div style={{ textAlign: "center", fontSize: 12, color: textSecondary }}>{impact}</div>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div>
          <label style={labelStyle}>Mitigation Plan</label>
          <textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Entity</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">All Entities</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Risk Owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.id} value={e.email || e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !title} style={{ ...btnPrimary, opacity: saving || !title ? 0.5 : 1 }}>
            {saving ? "Creating..." : "Add Risk"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  EDIT RISK MODAL                       ═══ */
/* ═══════════════════════════════════════════════ */
function EditRiskModal({ risk, onClose, entities, employees, onSaved }: {
  risk: Risk; onClose: () => void; entities: OrgEntity[]; employees: Employee[]; onSaved: () => void
}) {
  const [title, setTitle] = useState(risk.title)
  const [category, setCategory] = useState(risk.category)
  const [status, setStatus] = useState(risk.status)
  const [description, setDescription] = useState(risk.description || "")
  const [likelihood, setLikelihood] = useState(risk.likelihood)
  const [impact, setImpact] = useState(risk.impact)
  const [mitigation, setMitigation] = useState(risk.mitigation || "")
  const [residualLikelihood, setResidualLikelihood] = useState(risk.residualLikelihood || 1)
  const [residualImpact, setResidualImpact] = useState(risk.residualImpact || 1)
  const [entityId, setEntityId] = useState(risk.entity?.id || "")
  const [ownerId, setOwnerId] = useState(risk.ownerId || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/compliance/risks/${risk.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, status, description, likelihood, impact, mitigation, residualLikelihood, residualImpact, entityId: entityId || null, ownerId: ownerId || null }),
      })
      onSaved(); onClose()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const score = likelihood * impact
  const scoreColor = score >= 16 ? "#EF4444" : score >= 10 ? "#F59E0B" : score >= 5 ? "#3B82F6" : "#22C55E"

  return (
    <Modal open={true} onClose={onClose} title={`Edit ${risk.code}`} width={640}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="operational">Operational</option><option value="financial">Financial</option>
              <option value="regulatory">Regulatory</option><option value="cyber">Cyber</option>
              <option value="reputational">Reputational</option><option value="strategic">Strategic</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="open">Open</option><option value="mitigating">Mitigating</option>
              <option value="accepted">Accepted</option><option value="monitoring">Monitoring</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: textTertiary, marginBottom: 4 }}>Score</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: scoreColor }}>{score}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Likelihood (1-5): {likelihood}</label>
            <input type="range" min={1} max={5} value={likelihood} onChange={(e) => setLikelihood(parseInt(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>Impact (1-5): {impact}</label>
            <input type="range" min={1} max={5} value={impact} onChange={(e) => setImpact(parseInt(e.target.value))} style={{ width: "100%" }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Mitigation Plan</label>
          <textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Residual Likelihood: {residualLikelihood}</label>
            <input type="range" min={1} max={5} value={residualLikelihood} onChange={(e) => setResidualLikelihood(parseInt(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={labelStyle}>Residual Impact: {residualImpact}</label>
            <input type="range" min={1} max={5} value={residualImpact} onChange={(e) => setResidualImpact(parseInt(e.target.value))} style={{ width: "100%" }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Entity</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">All Entities</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Owner</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.id} value={e.email || e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  ADD TRAINING MODAL                    ═══ */
/* ═══════════════════════════════════════════════ */
function AddTrainingModal({ open, onClose, entities, onSaved }: {
  open: boolean; onClose: () => void; entities: OrgEntity[]; onSaved: () => void
}) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("aml")
  const [description, setDescription] = useState("")
  const [provider, setProvider] = useState("")
  const [frequency, setFrequency] = useState("annual")
  const [mandatory, setMandatory] = useState(true)
  const [dueDate, setDueDate] = useState("")
  const [entityId, setEntityId] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title) return
    setSaving(true)
    try {
      await fetch("/api/compliance/training", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, description, provider, frequency, mandatory, dueDate: dueDate || undefined, entityId: entityId || undefined }),
      })
      onSaved(); onClose()
      setTitle(""); setDescription(""); setProvider(""); setCategory("aml"); setFrequency("annual"); setMandatory(true); setDueDate(""); setEntityId("")
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="New Training Program">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Annual AML Training" style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="aml">AML</option><option value="kyc">KYC</option>
              <option value="data_protection">Data Protection</option><option value="conduct">Conduct</option>
              <option value="it_security">IT Security</option><option value="orias">ORIAS</option><option value="general">General</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="annual">Annual</option><option value="biannual">Biannual</option>
              <option value="quarterly">Quarterly</option><option value="one_time">One-time</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Provider</label>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Internal / ACAMS" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Entity</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">All Entities</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20 }}>
            <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} id="mandatory" />
            <label htmlFor="mandatory" style={{ fontSize: 13, color: textSecondary, cursor: "pointer" }}>Mandatory</label>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !title} style={{ ...btnPrimary, opacity: saving || !title ? 0.5 : 1 }}>
            {saving ? "Creating..." : "Create Training"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  ADD LICENSE MODAL                     ═══ */
/* ═══════════════════════════════════════════════ */
function AddLicenseModal({ open, onClose, entities, onSaved }: {
  open: boolean; onClose: () => void; entities: OrgEntity[]; onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [regulator, setRegulator] = useState("")
  const [code, setCode] = useState("")
  const [type, setType] = useState("")
  const [status, setStatus] = useState("active")
  const [entityId, setEntityId] = useState("")
  const [entityName, setEntityName] = useState("")
  const [grantedDate, setGrantedDate] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [conditions, setConditions] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name || !regulator) return
    setSaving(true)
    try {
      await fetch("/api/compliance/licenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, regulator, code, type, status, entityId: entityId || undefined, entityName: entityName || undefined, grantedDate: grantedDate || undefined, expiryDate: expiryDate || undefined, conditions }),
      })
      onSaved(); onClose()
      setName(""); setRegulator(""); setCode(""); setType(""); setStatus("active"); setEntityId(""); setEntityName(""); setGrantedDate(""); setExpiryDate(""); setConditions("")
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="New Regulatory License">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>License Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="E-Money Institution License" style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Regulator *</label>
            <input value={regulator} onChange={(e) => setRegulator(e.target.value)} placeholder="FCA, ACPR, BaFin..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>License Number</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <input value={type} onChange={(e) => setType(e.target.value)} placeholder="EMI, PI, Agent..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="active">Active</option><option value="pending">Pending</option>
              <option value="suspended">Suspended</option><option value="expired">Expired</option>
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Entity</label>
            <select value={entityId} onChange={(e) => { setEntityId(e.target.value); const ent = entities.find((x) => x.id === e.target.value); setEntityName(ent?.name || "") }} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">Select Entity</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Entity Name (if not in list)</label>
            <input value={entityName} onChange={(e) => setEntityName(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Granted Date</label>
            <input type="date" value={grantedDate} onChange={(e) => setGrantedDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Expiry Date</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Conditions / Notes</label>
          <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name || !regulator} style={{ ...btnPrimary, opacity: saving || !name || !regulator ? 0.5 : 1 }}>
            {saving ? "Creating..." : "Add License"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  ADD INCIDENT MODAL                    ═══ */
/* ═══════════════════════════════════════════════ */
function AddIncidentModal({ open, onClose, entities, employees, onSaved }: {
  open: boolean; onClose: () => void; entities: OrgEntity[]; employees: Employee[]; onSaved: () => void
}) {
  const [title, setTitle] = useState("")
  const [type, setType] = useState("sar")
  const [severity, setSeverity] = useState("medium")
  const [description, setDescription] = useState("")
  const [entityId, setEntityId] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [reportedToRegulator, setReportedToRegulator] = useState(false)
  const [financialImpact, setFinancialImpact] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title) return
    setSaving(true)
    try {
      await fetch("/api/compliance/incidents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, type, severity, description,
          entityId: entityId || undefined, assignedTo: assignedTo || undefined,
          reportedToRegulator, financialImpact: financialImpact ? parseFloat(financialImpact) : undefined,
        }),
      })
      onSaved(); onClose()
      setTitle(""); setDescription(""); setType("sar"); setSeverity("medium"); setEntityId(""); setAssignedTo(""); setReportedToRegulator(false); setFinancialImpact("")
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Report Incident">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Suspicious activity report" style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="sar">SAR</option><option value="breach">Breach</option>
              <option value="complaint">Complaint</option><option value="near_miss">Near Miss</option>
              <option value="audit_finding">Audit Finding</option><option value="regulatory_inquiry">Regulatory Inquiry</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="critical">Critical</option><option value="high">High</option>
              <option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Entity</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">Select Entity</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Assigned To</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.id} value={e.email || e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Financial Impact (EUR)</label>
            <input type="number" value={financialImpact} onChange={(e) => setFinancialImpact(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20 }}>
            <input type="checkbox" checked={reportedToRegulator} onChange={(e) => setReportedToRegulator(e.target.checked)} id="reported" />
            <label htmlFor="reported" style={{ fontSize: 13, color: textSecondary, cursor: "pointer" }}>Reported to Regulator</label>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !title} style={{ ...btnPrimary, opacity: saving || !title ? 0.5 : 1 }}>
            {saving ? "Reporting..." : "Report Incident"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  EDIT INCIDENT MODAL                   ═══ */
/* ═══════════════════════════════════════════════ */
function EditIncidentModal({ incident, onClose, entities, employees, onSaved }: {
  incident: Incident; onClose: () => void; entities: OrgEntity[]; employees: Employee[]; onSaved: () => void
}) {
  const [title, setTitle] = useState(incident.title)
  const [type, setType] = useState(incident.type)
  const [severity, setSeverity] = useState(incident.severity)
  const [status, setStatus] = useState(incident.status)
  const [description, setDescription] = useState(incident.description || "")
  const [entityId, setEntityId] = useState(incident.entity?.id || "")
  const [assignedTo, setAssignedTo] = useState(incident.assignedTo || "")
  const [reportedToRegulator, setReportedToRegulator] = useState(incident.reportedToRegulator)
  const [regulatorRef, setRegulatorRef] = useState(incident.regulatorRef || "")
  const [rootCause, setRootCause] = useState("")
  const [remediation, setRemediation] = useState("")
  const [financialImpact, setFinancialImpact] = useState(incident.financialImpact?.toString() || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/compliance/incidents/${incident.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, type, severity, status, description, rootCause, remediation,
          entityId: entityId || null, assignedTo: assignedTo || null,
          reportedToRegulator, regulatorRef, financialImpact: financialImpact ? parseFloat(financialImpact) : null,
        }),
      })
      onSaved(); onClose()
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Modal open={true} onClose={onClose} title={`Edit ${incident.code}`} width={640}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="sar">SAR</option><option value="breach">Breach</option>
              <option value="complaint">Complaint</option><option value="near_miss">Near Miss</option>
              <option value="audit_finding">Audit Finding</option><option value="regulatory_inquiry">Regulatory Inquiry</option>
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
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="open">Open</option><option value="investigating">Investigating</option>
              <option value="reported">Reported</option><option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div>
          <label style={labelStyle}>Root Cause</label>
          <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div>
          <label style={labelStyle}>Remediation</label>
          <textarea value={remediation} onChange={(e) => setRemediation(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Entity</label>
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">Select Entity</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Assigned To</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.id} value={e.email || e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Financial Impact (EUR)</label>
            <input type="number" value={financialImpact} onChange={(e) => setFinancialImpact(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Regulator Reference</label>
            <input value={regulatorRef} onChange={(e) => setRegulatorRef(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={reportedToRegulator} onChange={(e) => setReportedToRegulator(e.target.checked)} id="editReported" />
          <label htmlFor="editReported" style={{ fontSize: 13, color: textSecondary, cursor: "pointer" }}>Reported to Regulator</label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════ */
/* ═══  ADD SCREENING MODAL                   ═══ */
/* ═══════════════════════════════════════════════ */
function AddScreeningModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [subjectName, setSubjectName] = useState("")
  const [subjectType, setSubjectType] = useState("individual")
  const [screeningType, setScreeningType] = useState("sanctions")
  const [provider, setProvider] = useState("")
  const [result, setResult] = useState("pending")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!subjectName) return
    setSaving(true)
    try {
      await fetch("/api/compliance/screening", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectName, subjectType, screeningType, provider, result, notes }),
      })
      onSaved(); onClose()
      setSubjectName(""); setSubjectType("individual"); setScreeningType("sanctions"); setProvider(""); setResult("pending"); setNotes("")
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="New Screening Record">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Subject Name *</label>
          <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="John Doe / Acme Corp" style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Subject Type</label>
            <select value={subjectType} onChange={(e) => setSubjectType(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="individual">Individual</option><option value="company">Company</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Screening Type</label>
            <select value={screeningType} onChange={(e) => setScreeningType(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="sanctions">Sanctions</option><option value="pep">PEP</option>
              <option value="adverse_media">Adverse Media</option><option value="kyc">KYC</option>
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Provider</label>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="ComplyAdvantage" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Result</label>
            <select value={result} onChange={(e) => setResult(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              <option value="pending">Pending</option><option value="clear">Clear</option>
              <option value="match">Match</option><option value="potential_match">Potential Match</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !subjectName} style={{ ...btnPrimary, opacity: saving || !subjectName ? 0.5 : 1 }}>
            {saving ? "Creating..." : "Submit Screening"}
          </button>
        </div>
      </div>
    </Modal>
  )
}
