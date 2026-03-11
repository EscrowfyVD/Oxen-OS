"use client"

import { useEffect, useState, useCallback } from "react"
import PageHeader from "@/components/layout/PageHeader"
import CalendarView from "@/components/calendar/CalendarView"
import type { CalendarEvent } from "@/components/calendar/EventCard"
import Link from "next/link"

type ViewMode = "week" | "day"

interface TeamMember {
  email: string
  name: string
  image: string | null
}

const TEAM_COLORS = [
  "#C08B88", "#6BA3D6", "#7BC47F", "#B07CD8",
  "#E0A458", "#5CB8B2", "#D4C75A", "#D87CA3",
]

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [generatingNotes, setGeneratingNotes] = useState<string | null>(null)

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set())
  const [ownerColors, setOwnerColors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch("/api/calendar/owners")
      .then((r) => r.json())
      .then((data) => {
        const members: TeamMember[] = data.owners ?? []
        setTeamMembers(members)
        setSelectedOwners(new Set(members.map((m) => m.email)))
        const colors: Record<string, string> = {}
        members.forEach((m, i) => {
          colors[m.email] = TEAM_COLORS[i % TEAM_COLORS.length]
        })
        setOwnerColors(colors)
      })
      .catch(() => {})
  }, [])

  const fetchEvents = useCallback(() => {
    const start = new Date(currentDate)
    start.setDate(start.getDate() - 14)
    const end = new Date(currentDate)
    end.setDate(end.getDate() + 14)

    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    })

    if (selectedOwners.size > 0 && selectedOwners.size < teamMembers.length) {
      params.set("owners", Array.from(selectedOwners).join(","))
    }

    fetch(`/api/calendar/events?${params}`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => {})
  }, [currentDate, selectedOwners, teamMembers.length])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch("/api/calendar/sync-all", { method: "POST" })
      if (res.status === 401) {
        setSyncMessage("Not signed in")
        setSyncing(false)
        return
      }
      const data = await res.json()
      if (res.ok) {
        setSyncMessage(`Synced ${data.synced} events from ${data.users} calendars`)
        fetchEvents()
        fetch("/api/calendar/owners")
          .then((r) => r.json())
          .then((d) => {
            const members: TeamMember[] = d.owners ?? []
            setTeamMembers(members)
            setSelectedOwners((prev) => {
              const next = new Set(prev)
              members.forEach((m) => next.add(m.email))
              return next
            })
            setOwnerColors((prev) => {
              const colors = { ...prev }
              members.forEach((m, i) => {
                if (!colors[m.email]) {
                  colors[m.email] = TEAM_COLORS[i % TEAM_COLORS.length]
                }
              })
              return colors
            })
          })
          .catch(() => {})
      } else {
        setSyncMessage(data.error ?? "Sync failed")
      }
    } catch {
      setSyncMessage("Network error")
    }
    setSyncing(false)
    setTimeout(() => setSyncMessage(null), 5000)
  }

  const handleGenerateCallNotes = async (event: CalendarEvent) => {
    setGeneratingNotes(event.id)
    try {
      const res = await fetch("/api/call-notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      })
      const data = await res.json()
      if (res.ok) {
        fetchEvents()
        if (data.callNoteId) {
          setSelectedEvent({ ...event, callNoteId: data.callNoteId })
        }
      }
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

  const goToToday = () => setCurrentDate(new Date())

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
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    return `${startStr} \u2013 ${endStr}`
  }

  const toggleOwner = (email: string) => {
    setSelectedOwners((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedOwners.size === teamMembers.length) {
      setSelectedOwners(new Set())
    } else {
      setSelectedOwners(new Set(teamMembers.map((m) => m.email)))
    }
  }

  const filteredEvents = events.filter(
    (e) => !e.calendarOwner || selectedOwners.has(e.calendarOwner)
  )

  return (
    <div className="page-content">
      <PageHeader
        title="Calendar"
        description="Team schedule & availability"
        actions={
          <div className="flex items-center gap-3">
            {syncMessage && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: syncMessage.startsWith("Synced") ? "var(--green)" : "var(--orange)",
                }}
              >
                {syncMessage}
              </span>
            )}
            <button
              className="btn-primary"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? "Syncing..." : "Sync All Calendars"}
            </button>
          </div>
        }
      />

      {/* Controls */}
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateDate(-1)}
            className="btn-secondary"
            style={{ padding: "8px 12px", fontSize: 14 }}
          >
            {"\u2190"}
          </button>
          <button
            onClick={goToToday}
            className="btn-secondary"
            style={{ padding: "7px 14px", fontSize: 12 }}
          >
            Today
          </button>
          <button
            onClick={() => navigateDate(1)}
            className="btn-secondary"
            style={{ padding: "8px 12px", fontSize: 14 }}
          >
            {"\u2192"}
          </button>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text)",
              marginLeft: 8,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {formatDateRange()}
          </span>
        </div>

        <div className="toggle-group">
          <button
            onClick={() => setViewMode("week")}
            className={`toggle-btn ${viewMode === "week" ? "active" : ""}`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode("day")}
            className={`toggle-btn ${viewMode === "day" ? "active" : ""}`}
          >
            Day
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Team filter sidebar */}
        {teamMembers.length > 0 && (
          <div
            className="w-52 shrink-0 card self-start"
            style={{ overflow: "hidden" }}
          >
            <div
              className="flex items-center justify-between"
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: "rgba(192,139,136,0.02)",
              }}
            >
              <span className="section-label">TEAM MEMBERS</span>
              <button
                onClick={toggleAll}
                style={{
                  fontSize: 10,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--rose)",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                }}
              >
                {selectedOwners.size === teamMembers.length ? "None" : "All"}
              </button>
            </div>
            <div style={{ padding: 8 }}>
              {teamMembers.map((member) => {
                const color = ownerColors[member.email] ?? "var(--rose)"
                const isSelected = selectedOwners.has(member.email)
                return (
                  <button
                    key={member.email}
                    onClick={() => toggleOwner(member.email)}
                    className="w-full flex items-center gap-2 text-left border-none cursor-pointer"
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: isSelected ? `${color}12` : "transparent",
                      opacity: isSelected ? 1 : 0.5,
                      transition: "all 0.15s ease",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: color,
                        opacity: isSelected ? 1 : 0.3,
                        flexShrink: 0,
                      }}
                    />
                    <div className="min-w-0">
                      <div
                        className="truncate"
                        style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}
                      >
                        {member.name}
                      </div>
                      <div
                        className="truncate"
                        style={{ fontSize: 10, color: "var(--text-dim)" }}
                      >
                        {member.email.split("@")[0]}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          <CalendarView
            events={filteredEvents}
            viewMode={viewMode}
            currentDate={currentDate}
            onEventClick={(event) => setSelectedEvent(event)}
            ownerColors={ownerColors}
          />
        </div>

        {/* Event detail side panel */}
        {selectedEvent && (
          <div
            className="w-80 shrink-0 card self-start animate-slideIn"
            style={{ overflow: "hidden" }}
          >
            {/* Panel header */}
            <div
              className="flex items-start justify-between"
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: "rgba(192,139,136,0.02)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {selectedEvent.calendarOwner && ownerColors[selectedEvent.calendarOwner] && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: ownerColors[selectedEvent.calendarOwner],
                      flexShrink: 0,
                    }}
                  />
                )}
                <h3
                  className="truncate"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--text-dim)",
                  padding: 2,
                  marginLeft: 8,
                }}
              >
                {"\u2715"}
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div className="section-label" style={{ marginBottom: 4 }}>TIME</div>
                  <div style={{ fontSize: 12, color: "var(--text)" }}>
                    {new Date(selectedEvent.start).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    {"\u2013"}{" "}
                    {new Date(selectedEvent.end).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {selectedEvent.calendarOwner && (
                  <div>
                    <div className="section-label" style={{ marginBottom: 4 }}>CALENDAR</div>
                    <div className="flex items-center gap-2">
                      {ownerColors[selectedEvent.calendarOwner] && (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: ownerColors[selectedEvent.calendarOwner],
                          }}
                        />
                      )}
                      <div style={{ fontSize: 12, color: "var(--text)" }}>
                        {teamMembers.find((m) => m.email === selectedEvent.calendarOwner)?.name ??
                          selectedEvent.calendarOwner}
                      </div>
                    </div>
                  </div>
                )}

                {selectedEvent.location && (
                  <div>
                    <div className="section-label" style={{ marginBottom: 4 }}>LOCATION</div>
                    <div style={{ fontSize: 12, color: "var(--text)" }}>
                      {selectedEvent.location}
                    </div>
                  </div>
                )}

                {selectedEvent.description && (
                  <div>
                    <div className="section-label" style={{ marginBottom: 4 }}>DESCRIPTION</div>
                    <div style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.5 }}>
                      {selectedEvent.description}
                    </div>
                  </div>
                )}

                {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                  <div>
                    <div className="section-label" style={{ marginBottom: 6 }}>ATTENDEES</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {selectedEvent.attendees.map((attendee, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2"
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "var(--bg-input)",
                            fontSize: 11,
                            color: "var(--text)",
                          }}
                        >
                          {attendee}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  {!selectedEvent.callNoteId && (
                    <button
                      onClick={() => handleGenerateCallNotes(selectedEvent)}
                      disabled={generatingNotes === selectedEvent.id}
                      className="btn-primary w-full"
                      style={{ fontSize: 12 }}
                    >
                      {generatingNotes === selectedEvent.id
                        ? "Generating..."
                        : "Generate Call Notes"}
                    </button>
                  )}

                  {selectedEvent.callNoteId && (
                    <Link
                      href={`/calendar/${selectedEvent.callNoteId}`}
                      className="block w-full text-center no-underline"
                      style={{
                        padding: "10px",
                        borderRadius: 10,
                        background: "var(--rose-dim)",
                        border: "1px solid var(--border-active)",
                        color: "var(--rose-light)",
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      View Call Notes
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
