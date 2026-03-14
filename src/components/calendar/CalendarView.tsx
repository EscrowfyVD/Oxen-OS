"use client"

import { useMemo } from "react"
import EventCard, { CalendarEvent, EVENT_TYPE_COLORS } from "./EventCard"

interface AbsenceBlock {
  id: string
  employee: { name: string; initials: string }
  type: string
  startDate: string
  endDate: string
}

interface CalendarViewProps {
  events: CalendarEvent[]
  viewMode: "week" | "day" | "month"
  currentDate: Date
  onEventClick: (event: CalendarEvent) => void
  onDayClick?: (date: Date) => void
  ownerColors?: Record<string, string>
  absences?: AbsenceBlock[]
}

const ABSENCE_COLORS: Record<string, { bg: string; text: string }> = {
  vacation: { bg: "rgba(74,222,128,0.15)", text: "#4ade80" },
  sick: { bg: "rgba(248,113,113,0.15)", text: "#f87171" },
  ooo: { bg: "rgba(129,140,248,0.15)", text: "#818cf8" },
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7 AM to 8 PM

function getWeekDates(date: Date): Date[] {
  const startOfWeek = new Date(date)
  const day = startOfWeek.getDay()
  const diff = day === 0 ? -6 : 1 - day
  startOfWeek.setDate(startOfWeek.getDate() + diff)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })
}

function getMonthDates(date: Date): Date[][] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start from Monday
  let startDay = firstDay.getDay() - 1
  if (startDay < 0) startDay = 6

  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - startDay)

  const weeks: Date[][] = []
  const current = new Date(startDate)

  while (current <= lastDay || weeks.length < 5) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
    if (weeks.length >= 6) break
  }

  return weeks
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function CalendarView({
  events,
  viewMode,
  currentDate,
  onEventClick,
  onDayClick,
  ownerColors,
  absences,
}: CalendarViewProps) {
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])
  const monthWeeks = useMemo(() => getMonthDates(currentDate), [currentDate])
  const today = new Date()

  if (viewMode === "month") {
    return (
      <div className="card" style={{ overflow: "hidden" }}>
        {/* Month day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: "1px solid var(--border)",
            background: "rgba(192,139,136,0.02)",
          }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={label}
              style={{
                padding: "10px 8px",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: "var(--text-dim)",
                fontFamily: "'DM Sans', sans-serif",
                borderRight: i < 6 ? "1px solid var(--border)" : "none",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Month grid */}
        {monthWeeks.map((week, wi) => (
          <div
            key={wi}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: wi < monthWeeks.length - 1 ? "1px solid var(--border)" : "none",
              minHeight: 100,
            }}
          >
            {week.map((date, di) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const isToday = isSameDay(date, today)
              const dayEvents = events.filter((e) => isSameDay(new Date(e.start), date))
              const dayAbsences = (absences ?? []).filter((a) => {
                const start = new Date(a.startDate)
                start.setHours(0, 0, 0, 0)
                const end = new Date(a.endDate)
                end.setHours(23, 59, 59, 999)
                return date >= start && date <= end
              })
              const maxVisible = 3
              const totalItems = dayEvents.length + dayAbsences.length
              const overflow = totalItems - maxVisible

              return (
                <div
                  key={di}
                  onClick={() => onDayClick?.(date)}
                  style={{
                    padding: 4,
                    borderRight: di < 6 ? "1px solid var(--border)" : "none",
                    cursor: onDayClick ? "pointer" : "default",
                    borderLeft: isToday ? "3px solid var(--rose)" : "3px solid transparent",
                    background: isToday ? "rgba(192,139,136,0.04)" : "transparent",
                    transition: "background 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 100,
                  }}
                  onMouseEnter={(e) => {
                    if (onDayClick) e.currentTarget.style.background = "rgba(255,255,255,0.02)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isToday ? "rgba(192,139,136,0.04)" : "transparent"
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday
                        ? "var(--rose)"
                        : isCurrentMonth
                          ? "var(--text)"
                          : "var(--text-dim)",
                      fontFamily: "'DM Sans', sans-serif",
                      marginBottom: 4,
                      padding: "2px 4px",
                      opacity: isCurrentMonth ? 1 : 0.4,
                    }}
                  >
                    {date.getDate()}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                    {/* Absence bars */}
                    {dayAbsences.slice(0, maxVisible).map((a) => {
                      const colors = ABSENCE_COLORS[a.type] || ABSENCE_COLORS.vacation
                      return (
                        <div
                          key={`abs-${a.id}`}
                          style={{
                            background: colors.bg,
                            color: colors.text,
                            fontSize: 8,
                            fontWeight: 600,
                            padding: "1px 4px",
                            borderRadius: 3,
                            fontFamily: "'DM Sans', sans-serif",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={`${a.employee.name} - ${a.type}`}
                        >
                          {a.employee.initials} {a.type}
                        </div>
                      )
                    })}
                    {/* Event bars */}
                    {dayEvents.slice(0, Math.max(0, maxVisible - dayAbsences.length)).map((evt) => {
                      const typeColor = evt.type ? EVENT_TYPE_COLORS[evt.type] : undefined
                      const barColor = ownerColors?.[evt.calendarOwner ?? ""] ?? typeColor ?? evt.color ?? "var(--rose)"
                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(evt)
                          }}
                          style={{
                            background: `${barColor}20`,
                            borderLeft: `2px solid ${barColor}`,
                            fontSize: 8,
                            fontWeight: 600,
                            padding: "1px 4px",
                            borderRadius: 3,
                            fontFamily: "'DM Sans', sans-serif",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "var(--text)",
                            cursor: "pointer",
                          }}
                          title={evt.title}
                        >
                          {evt.title}
                        </div>
                      )
                    })}
                    {overflow > 0 && (
                      <div
                        style={{
                          fontSize: 8,
                          color: "var(--text-dim)",
                          fontFamily: "'DM Sans', sans-serif",
                          padding: "0 4px",
                          fontWeight: 500,
                        }}
                      >
                        +{overflow} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  // ── Week / Day view ──
  const displayDates = viewMode === "week" ? weekDates : [currentDate]

  const getEventsForDateAndHour = (date: Date, hour: number) => {
    return events.filter((e) => {
      const start = new Date(e.start)
      return isSameDay(start, date) && start.getHours() === hour
    })
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Day headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            viewMode === "week" ? "56px repeat(7, 1fr)" : "56px 1fr",
          borderBottom: "1px solid var(--border)",
          background: "rgba(192,139,136,0.02)",
        }}
      >
        <div style={{ borderRight: "1px solid var(--border)", padding: 8 }} />
        {displayDates.map((date, i) => {
          const isToday = isSameDay(date, today)
          return (
            <div
              key={i}
              style={{
                padding: "12px 8px",
                textAlign: "center",
                borderRight:
                  i < displayDates.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  color: isToday ? "var(--rose)" : "var(--text-dim)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {viewMode === "week"
                  ? DAY_LABELS[i]
                  : date.toLocaleDateString("en-US", { weekday: "long" })}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 400,
                  fontFamily: "'Bellfair', serif",
                  color: isToday ? "var(--rose)" : "var(--text)",
                  marginTop: 2,
                }}
              >
                {date.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day absences row */}
      {absences && absences.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              viewMode === "week" ? "56px repeat(7, 1fr)" : "56px 1fr",
            borderBottom: "1px solid var(--border)",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          <div
            style={{
              padding: "4px 6px",
              textAlign: "right",
              color: "var(--text-dim)",
              fontSize: 8,
              fontFamily: "'DM Sans', sans-serif",
              borderRight: "1px solid var(--border)",
              fontWeight: 500,
            }}
          >
            ALL DAY
          </div>
          {displayDates.map((date, i) => {
            const dayAbsences = absences.filter((a) => {
              const start = new Date(a.startDate)
              start.setHours(0, 0, 0, 0)
              const end = new Date(a.endDate)
              end.setHours(23, 59, 59, 999)
              return date >= start && date <= end
            })
            return (
              <div
                key={i}
                style={{
                  padding: 2,
                  borderRight: i < displayDates.length - 1 ? "1px solid var(--border)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                {dayAbsences.map((a) => {
                  const colors = ABSENCE_COLORS[a.type] || ABSENCE_COLORS.vacation
                  return (
                    <div
                      key={a.id}
                      style={{
                        background: colors.bg,
                        color: colors.text,
                        fontSize: 8,
                        fontWeight: 600,
                        padding: "2px 4px",
                        borderRadius: 3,
                        fontFamily: "'DM Sans', sans-serif",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={`${a.employee.name} - ${a.type}`}
                    >
                      {a.employee.initials}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid */}
      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}>
        {HOURS.map((hour) => (
          <div
            key={hour}
            style={{
              display: "grid",
              gridTemplateColumns:
                viewMode === "week" ? "56px repeat(7, 1fr)" : "56px 1fr",
              borderBottom: "1px solid var(--border)",
              minHeight: 56,
            }}
          >
            <div
              style={{
                padding: "6px 8px",
                textAlign: "right",
                color: "var(--text-dim)",
                fontSize: 10,
                fontFamily: "'DM Sans', sans-serif",
                borderRight: "1px solid var(--border)",
                fontWeight: 500,
              }}
            >
              {hour === 0
                ? "12 AM"
                : hour < 12
                ? `${hour} AM`
                : hour === 12
                ? "12 PM"
                : `${hour - 12} PM`}
            </div>
            {displayDates.map((date, i) => {
              const cellEvents = getEventsForDateAndHour(date, hour)
              return (
                <div
                  key={i}
                  style={{
                    padding: 3,
                    borderRight:
                      i < displayDates.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    position: "relative",
                  }}
                >
                  {cellEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={onEventClick}
                      ownerColor={
                        event.calendarOwner && ownerColors
                          ? ownerColors[event.calendarOwner]
                          : undefined
                      }
                    />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
