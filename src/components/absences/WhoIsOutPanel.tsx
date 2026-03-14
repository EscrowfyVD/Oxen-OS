"use client"

import { CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, FROST, GREEN, RED, AMBER, LEAVE_COLORS, LEAVE_LABELS } from "./constants"
import { formatShortDate } from "./helpers"
import { getAvatarGradient } from "@/lib/avatar"
import type { WhoIsOut } from "./types"

interface WhoIsOutPanelProps {
  whoIsOut: { today: WhoIsOut[]; thisWeek: WhoIsOut[]; thisMonth: WhoIsOut[] }
  isAdmin: boolean
  pendingRequests: Array<{
    id: string
    employee: { name: string; initials: string; avatarColor: string }
    type: string
    startDate: string
    endDate: string
    totalDays: number
    reason: string | null
  }>
  onQuickApprove: (id: string) => void
  onGoToAdmin: () => void
}

export default function WhoIsOutPanel({ whoIsOut, isAdmin, pendingRequests, onQuickApprove, onGoToAdmin }: WhoIsOutPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Who's Out Today */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: FROST, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
          Who{"'"}s Out Today
        </div>
        {whoIsOut.today.length === 0 ? (
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
            Full team available today
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {whoIsOut.today.map((w) => {
              const lc = LEAVE_COLORS[w.type] || LEAVE_COLORS.vacation
              const backDate = new Date(w.endDate)
              backDate.setDate(backDate.getDate() + 1)
              return (
                <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: getAvatarGradient(w.employee.avatarColor), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
                    {w.employee.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{w.employee.name}</div>
                    <div style={{ fontSize: 9, color: TEXT_TERTIARY }}>back {formatShortDate(backDate)}</div>
                  </div>
                  <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 8, background: lc.bg, color: lc.text, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {w.type}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Who's Out This Week */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: FROST, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
          This Week
        </div>
        {whoIsOut.thisWeek.length === 0 ? (
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
            No absences this week
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {whoIsOut.thisWeek.map((w) => {
              const lc = LEAVE_COLORS[w.type] || LEAVE_COLORS.vacation
              return (
                <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: getAvatarGradient(w.employee.avatarColor), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
                    {w.employee.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {w.employee.name}
                    </div>
                    <div style={{ fontSize: 9, color: TEXT_TERTIARY }}>
                      {formatShortDate(w.startDate)} - {formatShortDate(w.endDate)}
                    </div>
                  </div>
                  <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: lc.bg, color: lc.text, fontWeight: 500 }}>
                    {w.type}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Who's Out This Month */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: FROST, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
          This Month
        </div>
        {whoIsOut.thisMonth.length === 0 ? (
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
            No absences this month
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {whoIsOut.thisMonth.map((w) => {
                const lc = LEAVE_COLORS[w.type] || LEAVE_COLORS.vacation
                return (
                  <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: getAvatarGradient(w.employee.avatarColor), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 600, color: "#fff", flexShrink: 0 }}>
                      {w.employee.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {w.employee.name}
                      </div>
                      <div style={{ fontSize: 9, color: TEXT_TERTIARY }}>
                        {formatShortDate(w.startDate)} - {formatShortDate(w.endDate)}
                        {w.totalDays ? ` (${w.totalDays}d)` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: lc.bg, color: lc.text, fontWeight: 500 }}>
                      {w.type}
                    </span>
                  </div>
                )
              })}
            </div>
            {whoIsOut.thisMonth.length > 0 && (
              <div style={{ fontSize: 9, color: TEXT_TERTIARY, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${CARD_BORDER}`, fontFamily: "'DM Sans', sans-serif" }}>
                {(() => {
                  const totalDays = whoIsOut.thisMonth.reduce((sum, w) => sum + (w.totalDays || 0), 0)
                  const uniqueMembers = new Set(whoIsOut.thisMonth.map((w) => w.employee.id)).size
                  return `${totalDays} total days across ${uniqueMembers} member${uniqueMembers !== 1 ? "s" : ""}`
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pending Requests (admin) */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="card" style={{ padding: 16, border: `1px solid rgba(251,191,36,0.15)` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: AMBER, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
            Pending Requests ({pendingRequests.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingRequests.slice(0, 5).map((r) => {
              const lc = LEAVE_COLORS[r.type] || LEAVE_COLORS.vacation
              return (
                <div key={r.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: TEXT_PRIMARY, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{r.employee.name}</span>
                    <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: lc.bg, color: lc.text, fontWeight: 500 }}>{r.type}</span>
                  </div>
                  <div style={{ fontSize: 9, color: TEXT_TERTIARY, marginBottom: 6 }}>
                    {formatShortDate(r.startDate)} - {formatShortDate(r.endDate)} ({r.totalDays}d)
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => onQuickApprove(r.id)} style={{ background: "rgba(74,222,128,0.12)", border: "none", color: GREEN, fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer", fontWeight: 500 }}>
                      Approve
                    </button>
                    <button onClick={onGoToAdmin} style={{ background: "rgba(248,113,113,0.08)", border: "none", color: RED, fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer", fontWeight: 500 }}>
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
