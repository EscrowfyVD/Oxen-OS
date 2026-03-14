"use client"

import { useState } from "react"
import { CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, FROST, GREEN, RED, AMBER, INDIGO, LEAVE_COLORS, STATUS_COLORS } from "./constants"
import { formatDate, formatShortDate } from "./helpers"
import type { LeaveRequest, LeaveBalance, Employee } from "./types"

interface AdminTabProps {
  pendingRequests: LeaveRequest[]
  allRequests: LeaveRequest[]
  allBalances: Array<LeaveBalance & { employee?: Employee }>
  employees: Employee[]
  onApprove: (id: string, note: string) => void
  onReject: (id: string, note: string) => void
  onEditQuota: (balance: LeaveBalance & { employee?: Employee }) => void
}

export default function AdminTab({ pendingRequests, allRequests, allBalances, employees, onApprove, onReject, onEditQuota }: AdminTabProps) {
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterEmployee, setFilterEmployee] = useState("all")
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState("")

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

  // Check if a pending request is over-balance
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
      return {
        total, used, pending, available,
        requested: request.totalDays,
        overage: request.totalDays - available,
      }
    }
    return null
  }

  return (
    <div className="fade-in">
      {/* Pending Approvals */}
      <div className="card" style={{ padding: 20, marginBottom: 24, border: `1px solid rgba(251,191,36,0.1)` }}>
        <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: AMBER, margin: "0 0 16px" }}>
          Pending Approvals ({pendingRequests.length})
        </h3>
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
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: r.employee.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
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

                  {/* Balance warning banner */}
                  {warning && (
                    <div style={{
                      marginTop: 8, padding: "8px 12px", borderRadius: 6,
                      background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)",
                    }}>
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
                {["Employee", "Type", "Start", "End", "Days", "Status", "Reviewed By", "Date"].map((h) => (
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
                    onClick={() => onEditQuota(b)}
                    style={{ background: "none", border: "none", color: TEXT_TERTIARY, fontSize: 10, cursor: "pointer", padding: "2px 6px" }}
                  >
                    Edit
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
    </div>
  )
}
