"use client"

import { useEffect, useState, useCallback } from "react"
import PageHeader from "@/components/layout/PageHeader"
import CalendarView from "@/components/calendar/CalendarView"
import type { CalendarEvent } from "@/components/calendar/EventCard"
import Link from "next/link"

type ViewMode = "week" | "day"

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [generatingNotes, setGeneratingNotes] = useState<string | null>(null)

  const fetchEvents = useCallback(() => {
    const start = new Date(currentDate)
    start.setDate(start.getDate() - 7)
    const end = new Date(currentDate)
    end.setDate(end.getDate() + 7)

    fetch(
      `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`
    )
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => {})
  }, [currentDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch("/api/calendar/sync", { method: "POST" })
      fetchEvents()
    } catch {
      // handle error silently
    }
    setSyncing(false)
  }

  const handleGenerateCallNotes = async (eventId: string) => {
    setGeneratingNotes(eventId)
    try {
      await fetch("/api/call-notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      })
      fetchEvents()
    } catch {
      // handle error silently
    }
    setGeneratingNotes(null)
  }

  const navigateDate = (direction: number) => {
    const newDate = new Date(currentDate)
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + direction * 7)
    } else {
      newDate.setDate(newDate.getDate() + direction)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const formatDateRange = () => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    }
    const start = new Date(currentDate)
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diff)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const startStr = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    const endStr = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    return `${startStr} - ${endStr}`
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Meetings and schedule"
        actions={
          <button
            className="btn-primary text-sm"
            onClick={handleSync}
            disabled={syncing}
            style={{ opacity: syncing ? 0.6 : 1 }}
          >
            {syncing ? "Syncing..." : "Sync Calendar"}
          </button>
        }
      />

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateDate(-1)}
            className="p-2 rounded-lg cursor-pointer border-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: 14,
            }}
          >
            {"\u2190"}
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-mid)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Today
          </button>
          <button
            onClick={() => navigateDate(1)}
            className="p-2 rounded-lg cursor-pointer border-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontSize: 14,
            }}
          >
            {"\u2192"}
          </button>
          <span
            className="text-sm font-semibold ml-2"
            style={{ color: "var(--text)" }}
          >
            {formatDateRange()}
          </span>
        </div>

        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setViewMode("week")}
            className="px-3 py-1.5 text-xs font-semibold cursor-pointer border-none"
            style={{
              background:
                viewMode === "week" ? "var(--rose-dim)" : "transparent",
              color:
                viewMode === "week" ? "var(--rose)" : "var(--text-dim)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode("day")}
            className="px-3 py-1.5 text-xs font-semibold cursor-pointer border-none"
            style={{
              background:
                viewMode === "day" ? "var(--rose-dim)" : "transparent",
              color:
                viewMode === "day" ? "var(--rose)" : "var(--text-dim)",
              fontFamily: "'DM Sans', sans-serif",
              borderLeft: "1px solid var(--border)",
            }}
          >
            Day
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          <CalendarView
            events={events}
            viewMode={viewMode}
            currentDate={currentDate}
            onEventClick={(event) => setSelectedEvent(event)}
          />
        </div>

        {/* Event detail side panel */}
        {selectedEvent && (
          <div
            className="w-80 shrink-0 card p-5 self-start"
            style={{
              border: "1px solid var(--border)",
              animation: "slideIn 0.2s ease",
            }}
          >
            <style>{`
              @keyframes slideIn {
                from { opacity: 0; transform: translateX(10px); }
                to { opacity: 1; transform: translateX(0); }
              }
            `}</style>

            <div className="flex items-start justify-between mb-4">
              <h3
                className="text-sm font-bold"
                style={{ color: "var(--text)" }}
              >
                {selectedEvent.title}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="bg-transparent border-none cursor-pointer text-sm"
                style={{ color: "var(--text-dim)" }}
              >
                {"\u2715"}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div
                  className="text-[10px] font-semibold mb-0.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  TIME
                </div>
                <div
                  className="text-xs"
                  style={{ color: "var(--text)" }}
                >
                  {new Date(selectedEvent.start).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {new Date(selectedEvent.end).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              {selectedEvent.location && (
                <div>
                  <div
                    className="text-[10px] font-semibold mb-0.5"
                    style={{ color: "var(--text-dim)" }}
                  >
                    LOCATION
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--text)" }}
                  >
                    {selectedEvent.location}
                  </div>
                </div>
              )}

              {selectedEvent.description && (
                <div>
                  <div
                    className="text-[10px] font-semibold mb-0.5"
                    style={{ color: "var(--text-dim)" }}
                  >
                    DESCRIPTION
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--text-mid)" }}
                  >
                    {selectedEvent.description}
                  </div>
                </div>
              )}

              {selectedEvent.attendees &&
                selectedEvent.attendees.length > 0 && (
                  <div>
                    <div
                      className="text-[10px] font-semibold mb-1"
                      style={{ color: "var(--text-dim)" }}
                    >
                      ATTENDEES
                    </div>
                    <div className="space-y-1">
                      {selectedEvent.attendees.map((attendee, i) => (
                        <div
                          key={i}
                          className="text-xs"
                          style={{ color: "var(--text)" }}
                        >
                          {attendee}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div
                className="pt-3 space-y-2"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <button
                  onClick={() =>
                    handleGenerateCallNotes(selectedEvent.id)
                  }
                  disabled={generatingNotes === selectedEvent.id}
                  className="w-full btn-primary text-xs"
                  style={{
                    opacity:
                      generatingNotes === selectedEvent.id ? 0.6 : 1,
                  }}
                >
                  {generatingNotes === selectedEvent.id
                    ? "Generating..."
                    : "Generate Call Notes"}
                </button>

                {selectedEvent.callNoteId && (
                  <Link
                    href={`/calendar/${selectedEvent.callNoteId}`}
                    className="block w-full text-center text-xs py-2 rounded-lg no-underline"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-mid)",
                    }}
                  >
                    View Call Notes
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
