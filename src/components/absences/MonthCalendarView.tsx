"use client"

import { CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, FROST, ROSE_GOLD, LEAVE_COLORS, LEAVE_LABELS } from "./constants"
import { getDaysInMonth, getFirstDayOfMonth, getWeekNumber } from "./helpers"
import type { LeaveRequest } from "./types"

interface MonthCalendarViewProps {
  currentMonth: Date
  calendarLeaves: LeaveRequest[]
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

export default function MonthCalendarView({ currentMonth, calendarLeaves, onPrevMonth, onNextMonth, onToday }: MonthCalendarViewProps) {
  const getLeavesForDay = (day: number) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    dateStr.setHours(12, 0, 0, 0)
    return calendarLeaves.filter((l) => {
      const start = new Date(l.startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(l.endDate)
      end.setHours(23, 59, 59, 999)
      return dateStr >= start && dateStr <= end
    })
  }

  const isToday = (day: number) => {
    const today = new Date()
    return day === today.getDate() && currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()
  }

  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)

  // Build rows for week numbers
  const rows: number[][] = []
  let currentRow: number[] = []
  for (let i = 0; i < firstDay; i++) currentRow.push(0)
  for (let d = 1; d <= daysInMonth; d++) {
    currentRow.push(d)
    if (currentRow.length === 7) {
      rows.push(currentRow)
      currentRow = []
    }
  }
  if (currentRow.length > 0) {
    while (currentRow.length < 7) currentRow.push(0)
    rows.push(currentRow)
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <button
          onClick={onPrevMonth}
          style={{ background: "none", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
        >
          {"\u2190"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: FROST, margin: 0 }}>
            {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <button
            onClick={onToday}
            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_TERTIARY, padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
          >
            Today
          </button>
        </div>
        <button
          onClick={onNextMonth}
          style={{ background: "none", border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
        >
          {"\u2192"}
        </button>
      </div>

      {/* Day headers with week number column */}
      <div style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", gap: 1, marginBottom: 4 }}>
        <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "4px 0", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>
          WK
        </div>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "4px 0", textTransform: "uppercase", letterSpacing: 1 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar rows with week numbers */}
      {rows.map((row, rowIdx) => {
        const firstDayInRow = row.find((d) => d > 0) ?? 1
        const weekDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), firstDayInRow)
        const weekNum = getWeekNumber(weekDate)

        return (
          <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", gap: 1 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif",
              fontWeight: 400, opacity: 0.5,
            }}>
              {weekNum}
            </div>
            {row.map((day, colIdx) => {
              if (day === 0) {
                return <div key={`empty-${rowIdx}-${colIdx}`} style={{ minHeight: 80, background: "rgba(255,255,255,0.01)", borderRadius: 4 }} />
              }
              const leaves = getLeavesForDay(day)
              const today = isToday(day)
              const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
              const isWeekend = d.getDay() === 0 || d.getDay() === 6

              return (
                <div
                  key={day}
                  style={{
                    minHeight: 80, padding: 4,
                    background: today ? "rgba(192,139,136,0.08)" : isWeekend ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)",
                    borderRadius: 4,
                    border: today ? `1px solid rgba(192,139,136,0.2)` : `1px solid transparent`,
                  }}
                >
                  <div style={{
                    fontSize: 11, fontWeight: today ? 600 : 400,
                    color: today ? ROSE_GOLD : isWeekend ? TEXT_TERTIARY : TEXT_SECONDARY,
                    fontFamily: "'DM Sans', sans-serif", marginBottom: 4,
                  }}>
                    {day}
                  </div>
                  {leaves.slice(0, 3).map((l) => {
                    const lc = LEAVE_COLORS[l.type] || LEAVE_COLORS.vacation
                    return (
                      <div
                        key={l.id}
                        style={{
                          fontSize: 8, padding: "1px 4px", borderRadius: 3,
                          background: lc.bg, color: lc.text,
                          marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          height: l.halfDay ? 10 : "auto",
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                        }}
                        title={`${l.employee.name} - ${LEAVE_LABELS[l.type]}${l.halfDay ? ` (${l.halfDayPeriod})` : ""}`}
                      >
                        {l.employee.initials} {l.halfDay ? (l.halfDayPeriod === "morning" ? "AM" : "PM") : ""}
                      </div>
                    )
                  })}
                  {leaves.length > 3 && (
                    <div style={{ fontSize: 8, color: TEXT_TERTIARY }}>+{leaves.length - 3}</div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
        {Object.entries(LEAVE_COLORS).map(([type, colors]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.dot }} />
            <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>{LEAVE_LABELS[type]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
