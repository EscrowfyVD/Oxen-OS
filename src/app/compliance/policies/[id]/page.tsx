"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, FileText, Clock, User, Building2, Shield, CheckCircle2,
  Edit3, Plus, ChevronDown, X,
} from "lucide-react"

const cardBg = "var(--card-bg)"
const cardBorder = "var(--card-border)"
const roseGold = "#C08B88"
const void_ = "var(--void)"
const textPrimary = "var(--text-primary)"
const textSecondary = "var(--text-secondary)"
const textTertiary = "var(--text-tertiary)"

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--surface-input)",
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
  active: "#22C55E", approved: "#22C55E", draft: "#6B7280",
  pending_review: "#F59E0B", expired: "#EF4444", archived: "#6B7280",
}
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#EF4444", high: "#F59E0B", medium: "#3B82F6", low: "#6B7280",
}

interface Policy {
  id: string; title: string; code: string; category: string; status: string
  priority: string; description?: string; content?: string; ownerId?: string
  reviewerId?: string; approvedBy?: string; approvedAt?: string
  effectiveDate?: string; expiryDate?: string; reviewDate?: string
  entity?: { id: string; name: string }; tags: string[]
  createdBy: string; createdAt: string; updatedAt: string
}

interface PolicyVersion {
  id: string; version: number; content: string; changelog?: string
  createdBy: string; createdAt: string
}

export default function PolicyDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [versions, setVersions] = useState<PolicyVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"details" | "content" | "versions">("details")
  const [editing, setEditing] = useState(false)
  const [showNewVersion, setShowNewVersion] = useState(false)

  // Edit state
  const [editContent, setEditContent] = useState("")
  const [editStatus, setEditStatus] = useState("")

  // New version state
  const [versionContent, setVersionContent] = useState("")
  const [versionChangelog, setVersionChangelog] = useState("")
  const [savingVersion, setSavingVersion] = useState(false)

  const fetchPolicy = useCallback(async () => {
    try {
      const res = await fetch(`/api/compliance/policies/${id}`)
      const data = await res.json()
      setPolicy(data.policy || data)
      setEditContent(data.policy?.content || data.content || "")
      setEditStatus(data.policy?.status || data.status || "draft")
    } catch { /* ignore */ }
    setLoading(false)
  }, [id])

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/compliance/policies/${id}/versions`)
      const data = await res.json()
      setVersions(data.versions || [])
    } catch { /* ignore */ }
  }, [id])

  useEffect(() => { fetchPolicy(); fetchVersions() }, [fetchPolicy, fetchVersions])

  const saveContent = async () => {
    try {
      await fetch(`/api/compliance/policies/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, status: editStatus }),
      })
      fetchPolicy()
      setEditing(false)
    } catch { /* ignore */ }
  }

  const createVersion = async () => {
    if (!versionContent) return
    setSavingVersion(true)
    try {
      await fetch(`/api/compliance/policies/${id}/versions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: versionContent, changelog: versionChangelog }),
      })
      fetchVersions()
      setShowNewVersion(false)
      setVersionContent("")
      setVersionChangelog("")
    } catch { /* ignore */ }
    setSavingVersion(false)
  }

  if (loading) return <div style={{ minHeight: "100vh", background: void_, display: "flex", alignItems: "center", justifyContent: "center", color: textSecondary }}>Loading...</div>
  if (!policy) return <div style={{ minHeight: "100vh", background: void_, display: "flex", alignItems: "center", justifyContent: "center", color: textSecondary }}>Policy not found</div>

  const statusColor = STATUS_COLORS[policy.status] || "#6B7280"
  const priorityColor = SEVERITY_COLORS[policy.priority] || "#6B7280"

  return (
    <div style={{ minHeight: "100vh", background: void_, padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.push("/compliance")} style={{ background: "none", border: "none", cursor: "pointer", color: textTertiary, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: roseGold, fontWeight: 600, fontFamily: "monospace" }}>{policy.code}</span>
            <span style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: `${statusColor}15`, color: statusColor, textTransform: "uppercase",
            }}>
              {policy.status.replace(/_/g, " ")}
            </span>
            <span style={{
              padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: `${priorityColor}15`, color: priorityColor, textTransform: "uppercase",
            }}>
              {policy.priority}
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: textPrimary, margin: 0, fontFamily: "'Bellfair', serif" }}>{policy.title}</h1>
          <p style={{ fontSize: 13, color: textSecondary, margin: "4px 0 0" }}>
            {policy.category.replace(/_/g, " ").toUpperCase()} Policy
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 3, width: "fit-content" }}>
        {(["details", "content", "versions"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "8px 20px", background: activeTab === t ? roseGold : "transparent",
            color: activeTab === t ? void_ : textSecondary, border: "none", borderRadius: 8,
            fontSize: 12, fontWeight: activeTab === t ? 600 : 400, cursor: "pointer",
            textTransform: "capitalize",
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === "details" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 16px" }}>Policy Details</h3>
            {policy.description && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: textTertiary, marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, color: textSecondary, lineHeight: 1.6 }}>{policy.description}</div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: textTertiary, marginBottom: 4 }}>Category</div>
                <div style={{ fontSize: 13, color: textPrimary }}>{policy.category.replace(/_/g, " ").toUpperCase()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: textTertiary, marginBottom: 4 }}>Owner</div>
                <div style={{ fontSize: 13, color: textPrimary }}>{policy.ownerId || "Unassigned"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: textTertiary, marginBottom: 4 }}>Reviewer</div>
                <div style={{ fontSize: 13, color: textPrimary }}>{policy.reviewerId || "Unassigned"}</div>
              </div>
              {policy.entity && (
                <div>
                  <div style={{ fontSize: 11, color: textTertiary, marginBottom: 4 }}>Entity</div>
                  <div style={{ fontSize: 13, color: textPrimary, display: "flex", alignItems: "center", gap: 4 }}>
                    <Building2 size={12} /> {policy.entity.name}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: textTertiary, marginBottom: 4 }}>Created</div>
                <div style={{ fontSize: 13, color: textPrimary }}>{new Date(policy.createdAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: textTertiary, marginBottom: 4 }}>Last Updated</div>
                <div style={{ fontSize: 13, color: textPrimary }}>{new Date(policy.updatedAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Dates card */}
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={14} color={roseGold} /> Key Dates
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {policy.effectiveDate && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: textTertiary }}>Effective</span>
                    <span style={{ fontSize: 12, color: textPrimary }}>{new Date(policy.effectiveDate).toLocaleDateString()}</span>
                  </div>
                )}
                {policy.expiryDate && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: textTertiary }}>Expiry</span>
                    <span style={{ fontSize: 12, color: "#EF4444" }}>{new Date(policy.expiryDate).toLocaleDateString()}</span>
                  </div>
                )}
                {policy.reviewDate && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: textTertiary }}>Next Review</span>
                    <span style={{ fontSize: 12, color: "#F59E0B" }}>{new Date(policy.reviewDate).toLocaleDateString()}</span>
                  </div>
                )}
                {policy.approvedAt && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: textTertiary }}>Approved</span>
                    <span style={{ fontSize: 12, color: "#22C55E" }}>{new Date(policy.approvedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Approval card */}
            {policy.approvedBy && (
              <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={14} color="#22C55E" /> Approval
                </h3>
                <div style={{ fontSize: 12, color: textSecondary }}>
                  Approved by <span style={{ color: textPrimary, fontWeight: 500 }}>{policy.approvedBy}</span>
                </div>
              </div>
            )}

            {/* Versions count */}
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={14} color={roseGold} /> Versions
              </h3>
              <div style={{ fontSize: 24, fontWeight: 700, color: textPrimary }}>{versions.length}</div>
              <div style={{ fontSize: 11, color: textTertiary }}>version{versions.length !== 1 ? "s" : ""} recorded</div>
            </div>
          </div>
        </div>
      )}

      {/* Content Tab */}
      {activeTab === "content" && (
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: textPrimary, margin: 0 }}>Policy Content</h3>
            <button onClick={() => setEditing(!editing)} style={{ ...btnSecondary, padding: "6px 14px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
              <Edit3 size={12} /> {editing ? "Cancel" : "Edit"}
            </button>
          </div>
          {editing ? (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ ...inputStyle, width: 200, appearance: "none" }}>
                  <option value="draft">Draft</option><option value="pending_review">Pending Review</option>
                  <option value="approved">Approved</option><option value="active">Active</option>
                </select>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={20}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button onClick={() => setEditing(false)} style={btnSecondary}>Cancel</button>
                <button onClick={saveContent} style={btnPrimary}>Save Content</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: textSecondary, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {policy.content || "No content yet. Click Edit to add policy content."}
            </div>
          )}
        </div>
      )}

      {/* Versions Tab */}
      {activeTab === "versions" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button onClick={() => setShowNewVersion(true)} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> New Version
            </button>
          </div>

          {versions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: textTertiary }}>No versions yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {versions.map((v) => (
                <div key={v.id} style={{
                  background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, padding: "16px 20px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: roseGold }}>v{v.version}</span>
                      <span style={{ fontSize: 11, color: textTertiary }}>{new Date(v.createdAt).toLocaleString()}</span>
                      <span style={{ fontSize: 11, color: textSecondary }}>by {v.createdBy}</span>
                    </div>
                  </div>
                  {v.changelog && <div style={{ fontSize: 12, color: textSecondary, marginBottom: 8 }}>Changelog: {v.changelog}</div>}
                  <details>
                    <summary style={{ fontSize: 11, color: roseGold, cursor: "pointer" }}>View content</summary>
                    <div style={{ fontSize: 12, color: textTertiary, lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 8, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                      {v.content}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}

          {/* New Version Modal */}
          {showNewVersion && (
            <div style={{
              position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
            }} onClick={() => setShowNewVersion(false)}>
              <div style={{
                background: "#0D0F14", border: `1px solid ${cardBorder}`, borderRadius: 16,
                width: 600, maxHeight: "85vh", overflow: "auto", padding: 0,
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "20px 28px", borderBottom: `1px solid ${cardBorder}`,
                }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: textPrimary, margin: 0 }}>Create New Version</h3>
                  <button onClick={() => setShowNewVersion(false)} style={{ background: "none", border: "none", cursor: "pointer", color: textTertiary }}><X size={18} /></button>
                </div>
                <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Content *</label>
                    <textarea
                      value={versionContent}
                      onChange={(e) => setVersionContent(e.target.value)}
                      rows={12}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                      placeholder="Paste the updated policy content..."
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Changelog</label>
                    <textarea
                      value={versionChangelog}
                      onChange={(e) => setVersionChangelog(e.target.value)}
                      rows={2}
                      style={{ ...inputStyle, resize: "vertical" }}
                      placeholder="Describe what changed..."
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button onClick={() => setShowNewVersion(false)} style={btnSecondary}>Cancel</button>
                    <button onClick={createVersion} disabled={savingVersion || !versionContent} style={{ ...btnPrimary, opacity: savingVersion || !versionContent ? 0.5 : 1 }}>
                      {savingVersion ? "Saving..." : "Create Version"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
