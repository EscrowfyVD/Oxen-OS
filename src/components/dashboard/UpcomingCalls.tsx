"use client"

import { useEffect, useState } from "react"

interface CalEvent {
  id: string
  title: string
  startTime: string
  callNote?: { id: string } | null
}

export default function UpcomingCalls() {
  const [events, setEvents] = useState<CalEvent[]>([])

  useEffect(() => {
    fetch("/api/calendar/events?limit=5&upcoming=true")
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => {})
  }, [])

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
        📅 Upcoming Calls
      </h3>
      {events.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          No upcoming events
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between">
              <div>
                <div className="text-sm" style={{ color: "var(--text)" }}>
                  {e.title}
                </div>
                <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                  {new Date(e.startTime).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              {e.callNote ? (
                <span
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{ background: "rgba(92,184,104,0.15)", color: "var(--green)" }}
                >
                  Notes ready
                </span>
              ) : (
                <span
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{ background: "var(--rose-dim)", color: "var(--rose)" }}
                >
                  No notes
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
