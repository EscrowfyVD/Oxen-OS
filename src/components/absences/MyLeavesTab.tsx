"use client"

import ProgressRing from "./ProgressRing"
import { CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, FROST, GREEN, RED, INDIGO, LEAVE_COLORS, STATUS_COLORS } from "./constants"
import { formatDate } from "./helpers"
import type { LeaveRequest, LeaveBalance } from "./types"

interface MyLeavesTabProps {
  balance: LeaveBalance | null
  myRequests: LeaveRequest[]
  onRequestLeave: () => void
  onCancel: (id: string) => void
}

export default function MyLeavesTab({ balance, myRequests, onRequestLeave, onCancel }: MyLeavesTabProps) {
  return (
    <div className="fade-in">
      {/* Balance Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {balance && (
          <>
            <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
              <ProgressRing
                used={balance.vacationUsed}
                pending={balance.vacationPending}
                total={balance.vacationTotal}
                color={GREEN}
                pendingColor="rgba(74,222,128,0.35)"
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: GREEN, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Vacation</div>
                <div style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.8 }}>
                  Total: {balance.vacationTotal}<br />
                  Used: {balance.vacationUsed}<br />
                  Pending: {balance.vacationPending}<br />
                  Remaining: {Math.max(0, balance.vacationTotal - balance.vacationUsed - balance.vacationPending)}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
              <ProgressRing
                used={balance.sickUsed}
                pending={0}
                total={balance.sickTotal}
                color={RED}
                pendingColor="rgba(248,113,113,0.35)"
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: RED, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Sick Leave</div>
                <div style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.8 }}>
                  Total: {balance.sickTotal}<br />
                  Used: {balance.sickUsed}<br />
                  Remaining: {Math.max(0, balance.sickTotal - balance.sickUsed)}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
              <ProgressRing
                used={balance.oooUsed}
                pending={0}
                total={balance.oooTotal}
                color={INDIGO}
                pendingColor="rgba(129,140,248,0.35)"
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: INDIGO, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Out of Office</div>
                <div style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.8 }}>
                  Total: {balance.oooTotal}<br />
                  Used: {balance.oooUsed}<br />
                  Remaining: {Math.max(0, balance.oooTotal - balance.oooUsed)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* My Requests List */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: 0 }}>My Requests</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { window.location.href = `/api/leaves/export?scope=my&year=${new Date().getFullYear()}` }}
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, fontSize: 10, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              Export My Leaves
            </button>
            <button
              onClick={onRequestLeave}
              className="btn-primary"
              style={{ padding: "6px 14px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}
            >
              + Request Leave
            </button>
          </div>
        </div>

        {myRequests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
            No leave requests yet. Click &quot;+ Request Leave&quot; to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {myRequests.map((r, i) => {
              const lc = LEAVE_COLORS[r.type] || LEAVE_COLORS.vacation
              const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
                    borderBottom: i < myRequests.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                  }}
                >
                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: lc.bg, color: lc.text, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>
                    {r.type}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {formatDate(r.startDate)} - {formatDate(r.endDate)}
                    </div>
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 2 }}>
                      {r.totalDays} day{r.totalDays !== 1 ? "s" : ""}{r.halfDay ? ` (${r.halfDayPeriod})` : ""}{r.reason ? ` \u00B7 ${r.reason}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: sc.bg, color: sc.text, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>
                    {r.status}
                  </span>
                  {r.status === "pending" && (
                    <button
                      onClick={() => onCancel(r.id)}
                      style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", color: RED, fontSize: 10, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                    >
                      Cancel
                    </button>
                  )}
                  {r.reviewedBy && (
                    <div style={{ fontSize: 9, color: TEXT_TERTIARY, flexShrink: 0 }}>
                      by {r.reviewedBy.name}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
