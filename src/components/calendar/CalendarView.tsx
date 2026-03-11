"use client"

import { useMemo } from "react"
import EventCard, { CalendarEvent } from "./EventCard"

interface CalendarViewProps {
  events: CalendarEvent[]
  viewMode: "week" | "day"
  currentDate: Date
  onEventClick: (event: CalendarEvent) => void
  ownerColors?: Record<string, string>
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
  ownerColors,
}: CalendarViewProps) {
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])
  const displayDates = viewMode === "week" ? weekDates : [currentDate]
  const today = new Date()

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
