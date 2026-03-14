"use client"

import { useState } from "react"
import MonthCalendarView from "./MonthCalendarView"
import YearCalendarView from "./YearCalendarView"
import WhoIsOutPanel from "./WhoIsOutPanel"
import { CARD_BORDER, TEXT_PRIMARY, TEXT_TERTIARY, ROSE_GOLD } from "./constants"
import type { LeaveRequest, WhoIsOut } from "./types"

interface CalendarTabProps {
  currentMonth: Date
  calendarLeaves: LeaveRequest[]
  yearLeaves: LeaveRequest[]
  whoIsOut: { today: WhoIsOut[]; thisWeek: WhoIsOut[]; thisMonth: WhoIsOut[] }
  pendingCount: number
  isAdmin: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onSetMonth: (date: Date) => void
  onQuickApprove: (id: string) => void
  onGoToAdmin: () => void
  pendingRequests: Array<{ id: string; employee: { name: string; initials: string; avatarColor: string }; type: string; startDate: string; endDate: string; totalDays: number; reason: string | null }>
}

type CalViewMode = "month" | "year"

export default function CalendarTab({
  currentMonth, calendarLeaves, yearLeaves, whoIsOut, pendingCount, isAdmin,
  onPrevMonth, onNextMonth, onToday, onSetMonth,
  onQuickApprove, onGoToAdmin, pendingRequests,
}: CalendarTabProps) {
  const [viewMode, setViewMode] = useState<CalViewMode>("month")
  const [yearViewYear, setYearViewYear] = useState(new Date().getFullYear())

  const handleMonthClick = (monthIndex: number) => {
    onSetMonth(new Date(yearViewYear, monthIndex, 1))
    setViewMode("month")
  }

  return (
    <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
      <div>
        {/* View mode toggle */}
        <div style={{ display: "flex", gap: 2, marginBottom: 16, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3, width: "fit-content" }}>
          {(["month", "year"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "5px 16px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                border: "none", borderRadius: 6, cursor: "pointer", transition: "all 0.15s",
                background: viewMode === mode ? "rgba(192,139,136,0.15)" : "transparent",
                color: viewMode === mode ? TEXT_PRIMARY : TEXT_TERTIARY,
                textTransform: "capitalize",
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {viewMode === "month" ? (
          <MonthCalendarView
            currentMonth={currentMonth}
            calendarLeaves={calendarLeaves}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onToday={onToday}
          />
        ) : (
          <YearCalendarView
            year={yearViewYear}
            yearLeaves={yearLeaves}
            onMonthClick={handleMonthClick}
            onPrevYear={() => setYearViewYear((y) => y - 1)}
            onNextYear={() => setYearViewYear((y) => y + 1)}
          />
        )}
      </div>

      <WhoIsOutPanel
        whoIsOut={whoIsOut}
        isAdmin={isAdmin}
        pendingRequests={pendingRequests}
        onQuickApprove={onQuickApprove}
        onGoToAdmin={onGoToAdmin}
      />
    </div>
  )
}
