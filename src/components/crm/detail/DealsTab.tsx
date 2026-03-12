"use client"

import { useState, useMemo } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, RED, GREEN, AMBER, ROSE_GOLD,
  STAGE_COLORS, DEAL_STAGES, labelStyle,
} from "@/components/crm/constants"
import type { Deal, Employee } from "@/components/crm/types"

interface DealsTabProps {
  deals: Deal[]
  contactId: string
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

export default function DealsTab({ deals, contactId, employees, onRefresh }: DealsTabProps) {
  /* ── Add deal form state ── */
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newStage, setNewStage] = useState("discovery")
  const [newRevenue, setNewRevenue] = useState("")
  const [newProbability, setNewProbability] = useState("50")
  const [newCloseDate, setNewCloseDate] = useState("")
  const [newAssignedTo, setNewAssignedTo] = useState("")

  /* ── Expanded deal editing state ── */
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editStage, setEditStage] = useState("")
  const [editProbability, setEditProbability] = useState("")
  const [editCloseDate, setEditCloseDate] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editRevenue, setEditRevenue] = useState("")
  const [editAssignedTo, setEditAssignedTo] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  /* ── Pipeline counts ── */
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    DEAL_STAGES.forEach((s) => { counts[s.id] = 0 })
    deals.forEach((d) => {
      if (counts[d.stage] !== undefined) counts[d.stage]++
      else counts[d.stage] = (counts[d.stage] || 0) + 1
    })
    return counts
  }, [deals])

  /* ── Add deal ── */
  const handleAddDeal = async () => {
    if (!newName.trim()) return
    try {
      await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          contactId,
          stage: newStage,
          expectedRevenue: newRevenue || null,
          probability: newProbability || "50",
          closeDate: newCloseDate || null,
          assignedTo: newAssignedTo || null,
        }),
      })
      setNewName("")
      setNewStage("discovery")
      setNewRevenue("")
      setNewProbability("50")
      setNewCloseDate("")
      setNewAssignedTo("")
      setShowAddForm(false)
      onRefresh()
    } catch { /* silent */ }
  }

  /* ── Expand deal for editing ── */
  const toggleExpand = (deal: Deal) => {
    if (expandedId === deal.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(deal.id)
    setEditStage(deal.stage)
    setEditProbability(String(deal.probability))
    setEditCloseDate(deal.closeDate ? deal.closeDate.split("T")[0] : "")
    setEditNotes(deal.notes || "")
    setEditRevenue(deal.expectedRevenue != null ? String(deal.expectedRevenue) : "")
    setEditAssignedTo(deal.assignedTo || "")
  }

  /* ── Save deal changes ── */
  const handleSaveDeal = async (dealId: string) => {
    setSaving(true)
    try {
      await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: editStage,
          probability: editProbability,
          closeDate: editCloseDate || null,
          notes: editNotes || null,
          expectedRevenue: editRevenue || null,
          assignedTo: editAssignedTo || null,
        }),
      })
      setExpandedId(null)
      onRefresh()
    } catch { /* silent */ }
    setSaving(false)
  }

  /* ── Delete deal ── */
  const handleDeleteDeal = async (dealId: string) => {
    try {
      await fetch(`/api/deals/${dealId}`, { method: "DELETE" })
      setExpandedId(null)
      setDeleting(null)
      onRefresh()
    } catch { /* silent */ }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Pipeline header + Add Deal button ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        {/* Mini pipeline badges */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DEAL_STAGES.map((stage) => {
            const sc = STAGE_COLORS[stage.id] || STAGE_COLORS.discovery
            const count = stageCounts[stage.id] || 0
            return (
              <div
                key={stage.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 10,
                  background: count > 0 ? sc.bg : "rgba(255,255,255,0.02)",
                  border: `1px solid ${count > 0 ? sc.text + "33" : CARD_BORDER}`,
                }}
              >
                <span style={{
                  fontSize: 9,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: count > 0 ? sc.text : TEXT_TERTIARY,
                }}>
                  {stage.label}
                </span>
                <span style={{
                  fontSize: 10,
                  fontFamily: "'Bellfair', serif",
                  fontWeight: 400,
                  color: count > 0 ? sc.text : TEXT_TERTIARY,
                  minWidth: 14,
                  textAlign: "center",
                }}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>

        {/* Add Deal button */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: "6px 14px",
            fontSize: 11,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            background: showAddForm ? "rgba(248,113,113,0.08)" : "rgba(192,139,136,0.1)",
            border: `1px solid ${showAddForm ? "rgba(248,113,113,0.2)" : "rgba(192,139,136,0.25)"}`,
            color: showAddForm ? RED : ROSE_GOLD,
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {showAddForm ? "Cancel" : "+ Add Deal"}
        </button>
      </div>

      {/* ── Inline add deal form ── */}
      {showAddForm && (
        <div className="card fade-in" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontFamily: "'Bellfair', serif", color: FROST, marginBottom: 12 }}>
            New Deal
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ ...labelStyle, fontSize: 9 }}>Deal Name *</div>
              <input
                className="oxen-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Q2 Integration"
                style={{ fontSize: 12, padding: "6px 8px" }}
              />
            </div>
            <div>
              <div style={{ ...labelStyle, fontSize: 9 }}>Stage</div>
              <select
                className="oxen-input"
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                style={{ appearance: "none", fontSize: 12, padding: "6px 8px" }}
              >
                {DEAL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ ...labelStyle, fontSize: 9 }}>Expected Revenue (\u20AC)</div>
              <input
                className="oxen-input"
                type="number"
                value={newRevenue}
                onChange={(e) => setNewRevenue(e.target.value)}
                placeholder="0"
                style={{ fontSize: 12, padding: "6px 8px" }}
              />
            </div>
            <div>
              <div style={{ ...labelStyle, fontSize: 9 }}>Probability (%)</div>
              <input
                className="oxen-input"
                type="number"
                min="0"
                max="100"
                value={newProbability}
                onChange={(e) => setNewProbability(e.target.value)}
                style={{ fontSize: 12, padding: "6px 8px" }}
              />
            </div>
            <div>
              <div style={{ ...labelStyle, fontSize: 9 }}>Close Date</div>
              <input
                className="oxen-input"
                type="date"
                value={newCloseDate}
                onChange={(e) => setNewCloseDate(e.target.value)}
                style={{ fontSize: 12, padding: "6px 8px" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ ...labelStyle, fontSize: 9 }}>Assigned To</div>
              <select
                className="oxen-input"
                value={newAssignedTo}
                onChange={(e) => setNewAssignedTo(e.target.value)}
                style={{ appearance: "none", fontSize: 12, padding: "6px 8px" }}
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.name}>{emp.name} \u2014 {emp.role}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-primary"
              onClick={handleAddDeal}
              disabled={!newName.trim()}
              style={{ padding: "6px 16px", fontSize: 11 }}
            >
              Create Deal
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowAddForm(false)}
              style={{ padding: "6px 16px", fontSize: 11 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Deal cards ── */}
      {deals.length === 0 && !showAddForm && (
        <div style={{
          padding: "40px 20px",
          textAlign: "center",
          color: TEXT_TERTIARY,
          fontSize: 12,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          No deals yet. Click &quot;+ Add Deal&quot; to create one.
        </div>
      )}

      {deals.map((deal) => {
        const sc = STAGE_COLORS[deal.stage] || STAGE_COLORS.discovery
        const isExpanded = expandedId === deal.id

        return (
          <div
            key={deal.id}
            className="fade-in"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${isExpanded ? "rgba(192,139,136,0.2)" : CARD_BORDER}`,
              borderRadius: 8,
              padding: 14,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!isExpanded) e.currentTarget.style.borderColor = "rgba(192,139,136,0.15)"
            }}
            onMouseLeave={(e) => {
              if (!isExpanded) e.currentTarget.style.borderColor = CARD_BORDER
            }}
          >
            {/* ── Collapsed view ── */}
            <div onClick={() => toggleExpand(deal)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                    {deal.name}
                  </span>
                  <span style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: sc.bg,
                    color: sc.text,
                  }}>
                    {deal.stage.replace("_", " ")}
                  </span>
                </div>
                <span style={{ fontFamily: "'Bellfair', serif", fontSize: 14, color: FROST }}>
                  {fmt(deal.expectedRevenue)}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                  {deal.probability}% probability
                </span>
                <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                  {deal.closeDate
                    ? `Close: ${new Date(deal.closeDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                    : "No close date"
                  }
                </span>
                {deal.assignedTo && (
                  <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                    {deal.assignedTo}
                  </span>
                )}
              </div>
            </div>

            {/* ── Expanded editing view ── */}
            {isExpanded && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${CARD_BORDER}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ ...labelStyle, fontSize: 9 }}>Stage</div>
                    <select
                      className="oxen-input"
                      value={editStage}
                      onChange={(e) => setEditStage(e.target.value)}
                      style={{ appearance: "none", fontSize: 12, padding: "6px 8px" }}
                    >
                      {DEAL_STAGES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, fontSize: 9 }}>Expected Revenue (\u20AC)</div>
                    <input
                      className="oxen-input"
                      type="number"
                      value={editRevenue}
                      onChange={(e) => setEditRevenue(e.target.value)}
                      placeholder="0"
                      style={{ fontSize: 12, padding: "6px 8px" }}
                    />
                  </div>
                  <div>
                    <div style={{ ...labelStyle, fontSize: 9 }}>Probability (%)</div>
                    <input
                      className="oxen-input"
                      type="number"
                      min="0"
                      max="100"
                      value={editProbability}
                      onChange={(e) => setEditProbability(e.target.value)}
                      style={{ fontSize: 12, padding: "6px 8px" }}
                    />
                  </div>
                  <div>
                    <div style={{ ...labelStyle, fontSize: 9 }}>Close Date</div>
                    <input
                      className="oxen-input"
                      type="date"
                      value={editCloseDate}
                      onChange={(e) => setEditCloseDate(e.target.value)}
                      style={{ fontSize: 12, padding: "6px 8px" }}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ ...labelStyle, fontSize: 9 }}>Assigned To</div>
                    <select
                      className="oxen-input"
                      value={editAssignedTo}
                      onChange={(e) => setEditAssignedTo(e.target.value)}
                      style={{ appearance: "none", fontSize: 12, padding: "6px 8px" }}
                    >
                      <option value="">Unassigned</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>{emp.name} \u2014 {emp.role}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ ...labelStyle, fontSize: 9 }}>Notes</div>
                    <textarea
                      className="oxen-input"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      placeholder="Deal notes..."
                      style={{ resize: "vertical", minHeight: 50, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-primary"
                      onClick={() => handleSaveDeal(deal.id)}
                      disabled={saving}
                      style={{ padding: "6px 16px", fontSize: 11 }}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setExpandedId(null)}
                      style={{ padding: "6px 16px", fontSize: 11 }}
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Delete button */}
                  {deleting === deal.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: RED, fontFamily: "'DM Sans', sans-serif" }}>Delete?</span>
                      <button
                        onClick={() => handleDeleteDeal(deal.id)}
                        style={{
                          background: RED,
                          border: "none",
                          color: FROST,
                          fontSize: 10,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                          padding: "4px 10px",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleting(null)}
                        className="btn-secondary"
                        style={{ padding: "4px 10px", fontSize: 10 }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleting(deal.id)}
                      style={{
                        background: "rgba(248,113,113,0.08)",
                        border: "1px solid rgba(248,113,113,0.2)",
                        color: RED,
                        fontSize: 10,
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 500,
                        padding: "4px 12px",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Delete Deal
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
