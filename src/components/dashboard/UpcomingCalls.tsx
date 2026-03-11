"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

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
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-header">
        <span style={{ fontSize: 14 }}>{"\uD83D\uDCC5"}</span>
        <span>Upcoming Calls</span>
      </div>
      <div className="card-body">
        {events.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center"
            style={{ padding: "24px 0", color: "var(--text-dim)" }}
          >
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>{"\uD83D\uDCC5"}</div>
            <div style={{ fontSize: 12 }}>No upcoming events</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map((e) => (
              <Link
                key={e.id}
                href={e.callNote ? `/calendar/${e.callNote.id}` : "/calendar"}
                className="no-underline flex items-center justify-between"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(el) => {
                  el.currentTarget.style.borderColor = "rgba(192,139,136,0.30)"
                }}
                onMouseLeave={(el) => {
                  el.currentTarget.style.borderColor = "rgba(192,139,136,0.10)"
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--text)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {e.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)",
                      marginTop: 2,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
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
                    style={{
                      fontSize: 10,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "rgba(92,184,104,0.15)",
                      color: "var(--green)",
                      fontWeight: 600,
                    }}
                  >
                    Notes ready
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "var(--rose-dim)",
                      color: "var(--rose)",
                      fontWeight: 500,
                    }}
                  >
                    No notes
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
