"use client"

import { useState, useRef } from "react"
import { Plus, Upload, X, FileSpreadsheet } from "lucide-react"
import { CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, FROST, GREEN, RED, AMBER, INDIGO, ROSE_GOLD, LEAVE_COLORS, STATUS_COLORS } from "./constants"
import { formatDate, formatShortDate, calculateBusinessDays } from "./helpers"
import { getAvatarGradient } from "@/lib/avatar"
import type { LeaveRequest, LeaveBalance, Employee } from "./types"

interface AdminTabProps {
  pendingRequests: LeaveRequest[]
  allRequests: LeaveRequest[]
  allBalances: Array<LeaveBalance & { employee?: Employee }>
  employees: Employee[]
  onApprove: (id: string, note: string) => void
  onReject: (id: string, note: string) => void
  onEditQuota: (balance: LeaveBalance & { employee?: Employee }) => void
  onRefresh: () => void
}

export default function AdminTab({ pendingRequests, allRequests, allBalances, employees, onApprove, onReject, onEditQuota, onRefresh }: AdminTabProps) {
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterEmployee, setFilterEmployee] = useState("all")
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [showManualModal, setShowManualModal] = useState(false)
  const [showEditBalanceModal, setShowEditBalanceModal] = useState<(LeaveBalance & { employee?: Employee }) | null>(null)
  const [showBulkImport, setShowBulkImport] = useState(false)

  const getFilteredRequests = () =>
    allRequests.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false
      if (filterType !== "all" && r.type !== filterType) return false
      if (filterEmployee !== "all" && r.employeeId !== filterEmployee) return false
      return true
    })

  const handleApprove = (id: string) => {
    onApprove(id, reviewNote)
    setReviewingId(null)
    setReviewNote("")
  }

  const handleReject = (id: string) => {
    onReject(id, reviewNote)
    setReviewingId(null)
    setReviewNote("")
  }

  const getBalanceWarning = (request: LeaveRequest) => {
    const empBalance = allBalances.find((b) => b.employeeId === request.employeeId)
    if (!empBalance) return null

    let total = 0, used = 0, pending = 0
    if (request.type === "vacation") {
      total = empBalance.vacationTotal
      used = empBalance.vacationUsed
      pending = empBalance.vacationPending
    } else if (request.type === "sick") {
      total = empBalance.sickTotal
      used = empBalance.sickUsed
    } else if (request.type === "ooo") {
      total = empBalance.oooTotal
      used = empBalance.oooUsed
    }

    const available = total - used - pending
    if (request.totalDays > available) {
      return { total, used, pending, available, requested: request.totalDays, overage: request.totalDays - available }
    }
    return null
  }

  return (
    <div className="fade-in">
      {/* Pending Approvals + Action Buttons */}
      <div className="card" style={{ padding: 20, marginBottom: 24, border: `1px solid rgba(251,191,36,0.1)` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: AMBER, margin: 0 }}>
            Pending Approvals ({pendingRequests.length})
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowManualModal(true)}
              style={{
                background: "rgba(192,139,136,0.12)", border: "none", color: ROSE_GOLD,
                fontSize: 10, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <Plus size={12} /> Add Leave Manually
            </button>
            <button
              onClick={() => setShowBulkImport(true)}
              style={{
                background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY,
                fontSize: 10, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <FileSpreadsheet size={12} /> Import Past Leaves
            </button>
          </div>
        </div>
        {pendingRequests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: TEXT_TERTIARY, fontSize: 12 }}>
            No pending requests
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {pendingRequests.map((r, i) => {
              const lc = LEAVE_COLORS[r.type] || LEAVE_COLORS.vacation
              const isReviewing = reviewingId === r.id
              const warning = getBalanceWarning(r)

              return (
                <div
                  key={r.id}
                  style={{
                    padding: "14px 0",
                    borderBottom: i < pendingRequests.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                    borderLeft: warning ? "3px solid #f87171" : "3px solid transparent",
                    paddingLeft: warning ? 12 : 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: getAvatarGradient(r.employee.avatarColor), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
                      {r.employee.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{r.employee.name}</div>
                      <div style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                        {formatShortDate(r.startDate)} - {formatShortDate(r.endDate)} ({r.totalDays}d){r.reason ? ` \u00B7 ${r.reason}` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: lc.bg, color: lc.text, fontWeight: 500, textTransform: "uppercase" }}>{r.type}</span>
                    {!isReviewing && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => handleApprove(r.id)} style={{ background: "rgba(74,222,128,0.12)", border: "none", color: GREEN, fontSize: 10, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
                          Approve
                        </button>
                        <button onClick={() => setReviewingId(r.id)} style={{ background: "rgba(248,113,113,0.08)", border: "none", color: RED, fontSize: 10, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {warning && (
                    <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)" }}>
                      <div style={{ fontSize: 10, color: RED, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
                        Exceeds balance by {warning.overage} day{warning.overage !== 1 ? "s" : ""}
                      </div>
                      <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
                        Total: {warning.total} | Used: {warning.used} | Pending: {warning.pending} | Available: {warning.available} | This Request: {warning.requested} | <span style={{ color: RED, fontWeight: 600 }}>Overage: {warning.overage}</span>
                      </div>
                    </div>
                  )}

                  {isReviewing && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        className="oxen-input"
                        placeholder="Review note (optional)"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        style={{ flex: 1, fontSize: 11, padding: "6px 10px" }}
                      />
                      <button onClick={() => handleReject(r.id)} style={{ background: RED, border: "none", color: FROST, fontSize: 10, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
                        Confirm Reject
                      </button>
                      <button onClick={() => { setReviewingId(null); setReviewNote("") }} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_TERTIARY, fontSize: 10, padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* All Requests Table */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: 0 }}>All Requests</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="oxen-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ fontSize: 10, padding: "4px 8px", width: "auto" }}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select className="oxen-input" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ fontSize: 10, padding: "4px 8px", width: "auto" }}>
              <option value="all">All Types</option>
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="ooo">OOO</option>
            </select>
            <select className="oxen-input" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} style={{ fontSize: 10, padding: "4px 8px", width: "auto" }}>
              <option value="all">All Employees</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button
              onClick={() => { window.location.href = `/api/leaves/export?scope=team&year=${new Date().getFullYear()}` }}
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              Export Team
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Employee", "Type", "Start", "End", "Days", "Status", "Source", "Reviewed By", "Date"].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}`, textTransform: "uppercase", letterSpacing: 1 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getFilteredRequests().map((r) => {
                const lc = LEAVE_COLORS[r.type] || LEAVE_COLORS.vacation
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending
                const isManual = r.source === "manual" || r.source === "bulk_import"
                return (
                  <tr key={r.id}>
                    <td style={{ fontSize: 11, color: TEXT_PRIMARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}`, fontFamily: "'DM Sans', sans-serif" }}>{r.employee.name}</td>
                    <td style={{ padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 6, background: lc.bg, color: lc.text, fontWeight: 500, textTransform: "uppercase" }}>{r.type}</span>
                    </td>
                    <td style={{ fontSize: 10, color: TEXT_SECONDARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{formatShortDate(r.startDate)}</td>
                    <td style={{ fontSize: 10, color: TEXT_SECONDARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{formatShortDate(r.endDate)}</td>
                    <td style={{ fontSize: 11, color: TEXT_PRIMARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}`, fontVariantNumeric: "tabular-nums" }}>{r.totalDays}</td>
                    <td style={{ padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 6, background: sc.bg, color: sc.text, fontWeight: 500, textTransform: "uppercase" }}>{r.status}</span>
                    </td>
                    <td style={{ padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {isManual ? (
                        <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 6, background: "rgba(192,139,136,0.12)", color: ROSE_GOLD, fontWeight: 500 }}>
                          📝 Manual
                        </span>
                      ) : (
                        <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 6, background: "rgba(129,140,248,0.1)", color: INDIGO, fontWeight: 500 }}>
                          📩 Requested
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 10, color: TEXT_TERTIARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{r.reviewedBy?.name || "-"}</td>
                    <td style={{ fontSize: 10, color: TEXT_TERTIARY, padding: "8px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{r.reviewedAt ? formatShortDate(r.reviewedAt) : "-"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Balance Overview */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: "0 0 16px" }}>Team Balances</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {allBalances.map((b) => {
            const vacRemaining = Math.max(0, b.vacationTotal - b.vacationUsed - b.vacationPending)
            const sickRemaining = Math.max(0, b.sickTotal - b.sickUsed)
            const oooRemaining = Math.max(0, b.oooTotal - b.oooUsed)
            return (
              <div key={b.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 14, border: `1px solid ${CARD_BORDER}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: b.employee?.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#fff" }}>
                      {b.employee?.initials}
                    </div>
                    <span style={{ fontSize: 11, color: TEXT_PRIMARY, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{b.employee?.name}</span>
                  </div>
                  <button
                    onClick={() => setShowEditBalanceModal(b)}
                    style={{ background: "rgba(192,139,136,0.1)", border: "none", color: ROSE_GOLD, fontSize: 10, cursor: "pointer", padding: "2px 8px", borderRadius: 4, fontFamily: "'DM Sans', sans-serif" }}
                  >
                    ✏️ Edit Balance
                  </button>
                </div>
                {[
                  { label: "Vacation", used: b.vacationUsed, pending: b.vacationPending, total: b.vacationTotal, remaining: vacRemaining, color: GREEN },
                  { label: "Sick", used: b.sickUsed, pending: 0, total: b.sickTotal, remaining: sickRemaining, color: RED },
                  { label: "OOO", used: b.oooUsed, pending: 0, total: b.oooTotal, remaining: oooRemaining, color: INDIGO },
                ].map((item) => (
                  <div key={item.label} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: TEXT_TERTIARY }}>{item.label}</span>
                      <span style={{ fontSize: 9, color: TEXT_TERTIARY }}>{item.remaining}/{item.total}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 2, background: item.color,
                        width: `${item.total > 0 ? ((item.used + item.pending) / item.total) * 100 : 0}%`,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Manual Leave Modal */}
      {showManualModal && (
        <ManualLeaveModal
          employees={employees}
          onClose={() => setShowManualModal(false)}
          onSuccess={() => { setShowManualModal(false); onRefresh() }}
        />
      )}

      {/* Edit Balance Modal */}
      {showEditBalanceModal && (
        <EditBalanceModal
          balance={showEditBalanceModal}
          onClose={() => setShowEditBalanceModal(null)}
          onSuccess={() => { setShowEditBalanceModal(null); onRefresh() }}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => { setShowBulkImport(false); onRefresh() }}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   MANUAL LEAVE MODAL
   ══════════════════════════════════════════════════ */
function ManualLeaveModal({ employees, onClose, onSuccess }: { employees: Employee[]; onClose: () => void; onSuccess: () => void }) {
  const [employeeId, setEmployeeId] = useState("")
  const [type, setType] = useState("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [halfDay, setHalfDay] = useState(false)
  const [halfDayPeriod, setHalfDayPeriod] = useState("morning")
  const [reason, setReason] = useState("")
  const [reviewNote, setReviewNote] = useState("")
  const [saving, setSaving] = useState(false)

  const totalDays = startDate && endDate
    ? calculateBusinessDays(new Date(startDate), new Date(endDate), halfDay)
    : 0

  const handleSave = async () => {
    if (!employeeId || !startDate || !endDate || totalDays <= 0) return
    setSaving(true)
    try {
      const res = await fetch("/api/leaves/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId, type, startDate, endDate,
          halfDay, halfDayPeriod: halfDay ? halfDayPeriod : null,
          reason: reason || null,
          reviewNote: reviewNote || "Manual entry by admin",
        }),
      })
      if (res.ok) onSuccess()
    } catch { /* silent */ }
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slideUp" style={{ background: CARD_BG, borderRadius: 16, border: `1px solid ${CARD_BORDER}`, width: 440, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(192,139,136,0.03)" }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST, margin: 0 }}>Add Leave Manually</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Employee */}
          <div>
            <label style={labelStyle}>Employee *</label>
            <select className="oxen-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ width: "100%" }}>
              <option value="">Select employee...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>Type *</label>
            <select className="oxen-input" value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%" }}>
              <option value="vacation">Vacation</option>
              <option value="sick">Sick Leave</option>
              <option value="ooo">Out of Office</option>
            </select>
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Start Date *</label>
              <input className="oxen-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: "100%", colorScheme: "dark" }} />
            </div>
            <div>
              <label style={labelStyle}>End Date *</label>
              <input className="oxen-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: "100%", colorScheme: "dark" }} />
            </div>
          </div>

          {/* Half Day */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} style={{ accentColor: ROSE_GOLD }} />
              <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>Half Day</span>
            </label>
            {halfDay && (
              <select className="oxen-input" value={halfDayPeriod} onChange={(e) => setHalfDayPeriod(e.target.value)} style={{ width: 130, fontSize: 11, padding: "4px 8px" }}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
              </select>
            )}
          </div>

          {/* Duration */}
          {totalDays > 0 && (
            <div style={{ background: "rgba(192,139,136,0.08)", borderRadius: 8, padding: "10px 14px", border: `1px solid rgba(192,139,136,0.15)` }}>
              <span style={{ fontSize: 12, color: ROSE_GOLD, fontWeight: 500 }}>
                Duration: {totalDays} business day{totalDays !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label style={labelStyle}>Reason <span style={{ fontWeight: 400, color: TEXT_TERTIARY }}>(optional)</span></label>
            <input className="oxen-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual leave" style={{ width: "100%" }} />
          </div>

          {/* Admin Note */}
          <div>
            <label style={labelStyle}>Reason for manual entry *</label>
            <textarea
              className="oxen-input"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. Pre-system leave — taken before Oxen OS was active"
              rows={2}
              style={{ width: "100%", resize: "vertical" as const, minHeight: 50 }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
            <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={!employeeId || !startDate || !endDate || totalDays <= 0 || saving}
              className="btn-primary"
              style={{ padding: "8px 16px", fontSize: 11, opacity: (!employeeId || !startDate || !endDate || totalDays <= 0 || saving) ? 0.5 : 1 }}
            >
              {saving ? "Adding..." : "Add Leave"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   EDIT BALANCE MODAL (all 6 fields)
   ══════════════════════════════════════════════════ */
function EditBalanceModal({ balance, onClose, onSuccess }: { balance: LeaveBalance & { employee?: Employee }; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    vacationTotal: balance.vacationTotal,
    vacationUsed: balance.vacationUsed,
    sickTotal: balance.sickTotal,
    sickUsed: balance.sickUsed,
    oooTotal: balance.oooTotal,
    oooUsed: balance.oooUsed,
  })
  const [auditNote, setAuditNote] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!auditNote.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/leaves/balance/${balance.employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, auditNote }),
      })
      if (res.ok) onSuccess()
    } catch { /* silent */ }
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slideUp" style={{ background: CARD_BG, borderRadius: 16, border: `1px solid ${CARD_BORDER}`, width: 440 }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(192,139,136,0.03)" }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST, margin: 0 }}>
            Edit Balance — {balance.employee?.name}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Vacation", totalKey: "vacationTotal", usedKey: "vacationUsed", color: GREEN },
            { label: "Sick", totalKey: "sickTotal", usedKey: "sickUsed", color: RED },
            { label: "OOO", totalKey: "oooTotal", usedKey: "oooUsed", color: INDIGO },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: item.color, marginBottom: 6 }}>{item.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 9, color: TEXT_TERTIARY, display: "block", marginBottom: 3, textTransform: "uppercase" }}>Total</label>
                  <input
                    className="oxen-input"
                    type="number"
                    value={form[item.totalKey as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [item.totalKey]: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 9, color: TEXT_TERTIARY, display: "block", marginBottom: 3, textTransform: "uppercase" }}>Used</label>
                  <input
                    className="oxen-input"
                    type="number"
                    step="0.5"
                    value={form[item.usedKey as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [item.usedKey]: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", fontSize: 13 }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Audit note */}
          <div>
            <label style={labelStyle}>Reason for adjustment *</label>
            <textarea
              className="oxen-input"
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
              placeholder="e.g. Correcting pre-system leave days"
              rows={2}
              style={{ width: "100%", resize: "vertical" as const, minHeight: 50 }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
            <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={!auditNote.trim() || saving}
              className="btn-primary"
              style={{ padding: "8px 16px", fontSize: 11, opacity: !auditNote.trim() || saving ? 0.5 : 1 }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   BULK IMPORT MODAL
   ══════════════════════════════════════════════════ */
function BulkImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<{ email: string; type: string; startDate: string; endDate: string; reason: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
      // Skip header row
      const parsed = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
        return {
          email: cols[0] || "",
          type: cols[1] || "vacation",
          startDate: cols[2] || "",
          endDate: cols[3] || "",
          reason: cols[4] || "",
        }
      }).filter((r) => r.email && r.startDate && r.endDate)
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setImporting(true)
    try {
      const res = await fetch("/api/leaves/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: rows }),
      })
      const data = await res.json()
      setResult(data.results)
      if (data.results?.success > 0) setTimeout(() => onSuccess(), 2000)
    } catch { /* silent */ }
    setImporting(false)
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slideUp" style={{ background: CARD_BG, borderRadius: 16, border: `1px solid ${CARD_BORDER}`, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(192,139,136,0.03)" }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST, margin: 0 }}>Import Past Leaves</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Instructions */}
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "12px 16px", border: `1px solid ${CARD_BORDER}` }}>
            <div style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 500, marginBottom: 6 }}>CSV Format Required</div>
            <div style={{ fontSize: 11, color: TEXT_TERTIARY, lineHeight: 1.6, fontFamily: "monospace" }}>
              Employee Email, Type, Start Date, End Date, Reason
            </div>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 6, lineHeight: 1.5 }}>
              • Type: vacation, sick, or ooo<br />
              • Dates: YYYY-MM-DD format<br />
              • All entries will be created as approved with &quot;Bulk import&quot; tag
            </div>
          </div>

          {/* Upload */}
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "rgba(192,139,136,0.12)", border: "none", color: ROSE_GOLD,
                fontSize: 12, padding: "8px 16px", borderRadius: 6, cursor: "pointer",
                fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Upload size={14} /> Upload CSV
            </button>
            {rows.length > 0 && (
              <span style={{ fontSize: 12, color: GREEN, display: "flex", alignItems: "center" }}>
                {rows.length} entries loaded
              </span>
            )}
          </div>

          {/* Preview Table */}
          {rows.length > 0 && (
            <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Email", "Type", "Start", "End", "Reason"].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 9, color: TEXT_TERTIARY, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}`, textTransform: "uppercase", letterSpacing: 1, position: "sticky", top: 0, background: CARD_BG }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 10, color: TEXT_PRIMARY, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{r.email}</td>
                      <td style={{ fontSize: 10, color: TEXT_SECONDARY, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}`, textTransform: "capitalize" }}>{r.type}</td>
                      <td style={{ fontSize: 10, color: TEXT_SECONDARY, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{r.startDate}</td>
                      <td style={{ fontSize: 10, color: TEXT_SECONDARY, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{r.endDate}</td>
                      <td style={{ fontSize: 10, color: TEXT_TERTIARY, padding: "6px 8px", borderBottom: `1px solid ${CARD_BORDER}` }}>{r.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{
              padding: "12px 16px", borderRadius: 8,
              background: result.failed > 0 ? "rgba(251,191,36,0.08)" : "rgba(74,222,128,0.08)",
              border: `1px solid ${result.failed > 0 ? "rgba(251,191,36,0.2)" : "rgba(74,222,128,0.2)"}`,
            }}>
              <div style={{ fontSize: 12, color: GREEN, fontWeight: 500 }}>
                ✅ {result.success} imported successfully
                {result.failed > 0 && <span style={{ color: AMBER, marginLeft: 8 }}>⚠️ {result.failed} failed</span>}
              </div>
              {result.errors.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 10, color: RED, lineHeight: 1.5 }}>
                  {result.errors.slice(0, 5).map((err, i) => <div key={i}>• {err}</div>)}
                  {result.errors.length > 5 && <div>... and {result.errors.length - 5} more errors</div>}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
            <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>
              {result ? "Close" : "Cancel"}
            </button>
            {!result && (
              <button
                onClick={handleImport}
                disabled={rows.length === 0 || importing}
                className="btn-primary"
                style={{ padding: "8px 16px", fontSize: 11, opacity: rows.length === 0 || importing ? 0.5 : 1 }}
              >
                {importing ? "Importing..." : `Import ${rows.length} Entries`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY,
  fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase",
  letterSpacing: 1, display: "block", marginBottom: 4,
}
