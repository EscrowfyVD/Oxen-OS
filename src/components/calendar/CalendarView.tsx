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
  const diff = day === 0 ? -6 : 1 - day // Monday start
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
    <div
      className="card overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* Day headers */}
      <div
        className="grid"
        style={{
          gridTemplateColumns:
            viewMode === "week"
              ? "60px repeat(7, 1fr)"
              : "60px 1fr",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="p-2"
          style={{ borderRight: "1px solid var(--border)" }}
        />
        {displayDates.map((date, i) => {
          const isToday = isSameDay(date, today)
          return (
            <div
              key={i}
              className="p-3 text-center"
              style={{
                borderRight:
                  i < displayDates.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <div
                className="text-[10px] font-semibold"
                style={{
                  color: isToday ? "var(--rose)" : "var(--text-dim)",
                }}
              >
                {viewMode === "week"
                  ? DAY_LABELS[i]
                  : date.toLocaleDateString("en-US", { weekday: "long" })}
              </div>
              <div
                className="text-lg font-bold"
                style={{
                  color: isToday ? "var(--rose)" : "var(--text)",
                }}
              >
                {date.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 280px)" }}
      >
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="grid"
            style={{
              gridTemplateColumns:
                viewMode === "week"
                  ? "60px repeat(7, 1fr)"
                  : "60px 1fr",
              borderBottom: "1px solid var(--border)",
              minHeight: 60,
            }}
          >
            <div
              className="p-2 text-right"
              style={{
                color: "var(--text-dim)",
                fontSize: 10,
                borderRight: "1px solid var(--border)",
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
                  className="p-1 relative"
                  style={{
                    borderRight:
                      i < displayDates.length - 1
                        ? "1px solid var(--border)"
                        : "none",
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
