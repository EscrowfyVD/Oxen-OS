"use client"

import { CARD_BORDER, TEXT_TERTIARY, FROST, ROSE_GOLD, LEAVE_COLORS, LEAVE_LABELS } from "./constants"
import type { LeaveRequest } from "./types"

interface YearCalendarViewProps {
  year: number
  yearLeaves: LeaveRequest[]
  onMonthClick: (monthIndex: number) => void
  onPrevYear: () => void
  onNextYear: () => void
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"]

export default function YearCalendarView({ year, yearLeaves, onMonthClick, onPrevYear, onNextYear }: YearCalendarViewProps) {
  const today = new Date()

  const getLeavesForDate = (date: Date) => {
    const d = new Date(date)
    d.setHours(12, 0, 0, 0)
    return yearLeaves.filter((l) => {
      const start = new Date(l.startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(l.endDate)
      end.setHours(23, 59, 59, 999)
      return d >= start && d <= end
    })
  }

  const isCurrentDay = (date: Date) =>
    date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()

  const renderMiniMonth = (monthIndex: number) => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const firstDow = new Date(year, monthIndex, 1).getDay()
    const startOffset = firstDow === 0 ? 6 : firstDow - 1

    const cells: React.ReactNode[] = []
    // Empty cells
    for (let i = 0; i < startOffset; i++) {
      cells.push(<div key={`e-${i}`} style={{ width: 20, height: 20 }} />)
    }
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIndex, d)
      const leaves = getLeavesForDate(date)
      const isCurrent = isCurrentDay(date)
      const isWeekend = date.getDay() === 0 || date.getDay() === 6

      // Determine dot color (use first leave type)
      const dotColor = leaves.length > 0 ? (LEAVE_COLORS[leaves[0].type]?.dot || LEAVE_COLORS.vacation.dot) : null

      const tooltipParts = leaves.map((l) => `${l.employee.name} - ${LEAVE_LABELS[l.type] || l.type}`)

      cells.push(
        <div
          key={d}
          title={tooltipParts.length > 0 ? tooltipParts.join("\n") : undefined}
          style={{
            width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontFamily: "'DM Sans', sans-serif",
            color: isCurrent ? ROSE_GOLD : isWeekend ? TEXT_TERTIARY : "rgba(232,230,227,0.5)",
            fontWeight: isCurrent ? 700 : 400,
            borderRadius: "50%",
            border: isCurrent ? `1.5px solid ${ROSE_GOLD}` : "1.5px solid transparent",
            position: "relative",
            cursor: "default",
          }}
        >
          {d}
          {dotColor && (
            <div style={{
              position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
              width: 4, height: 4, borderRadius: "50%", background: dotColor,
            }} />
          )}
          {leaves.length > 1 && (
            <div style={{
              position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
              display: "flex", gap: 1,
            }}>
              {leaves.slice(0, 3).map((l, idx) => (
                <div key={idx} style={{
                  width: 3, height: 3, borderRadius: "50%",
                  background: LEAVE_COLORS[l.type]?.dot || LEAVE_COLORS.vacation.dot,
                }} />
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        className="card"
        onClick={() => onMonthClick(monthIndex)}
        style={{
          padding: 12, cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(192,139,136,0.2)" }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "" }}
      >
        <div style={{
          fontFamily: "'Bellfair', serif", fontSize: 13, color: FROST,
          marginBottom: 8, textAlign: "center",
        }}>
          {MONTH_NAMES[monthIndex]}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 20px)", gap: 0, justifyContent: "center" }}>
          {DAY_HEADERS.map((d, i) => (
            <div key={i} style={{
              width: 20, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              {d}
            </div>
          ))}
          {cells}
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 24 }}>
        <button
          onClick={onPrevYear}
          style={{ background: "none", border: `1px solid ${CARD_BORDER}`, color: "rgba(232,230,227,0.7)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
        >
          {"\u2190"}
        </button>
        <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 24, color: FROST, margin: 0 }}>
          {year}
        </h2>
        <button
          onClick={onNextYear}
          style={{ background: "none", border: `1px solid ${CARD_BORDER}`, color: "rgba(232,230,227,0.7)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 14 }}
        >
          {"\u2192"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>{renderMiniMonth(i)}</div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}`, justifyContent: "center" }}>
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
