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
  "#C08B88", // rose
  "#6BA3D6", // blue
  "#7BC47F", // green
  "#B07CD8", // purple
  "#E0A458", // orange
  "#5CB8B2", // teal
  "#D4C75A", // yellow
  "#D87CA3", // pink
]

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [generatingNotes, setGeneratingNotes] = useState<string | null>(null)

  // Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set())
  const [ownerColors, setOwnerColors] = useState<Record<string, string>>({})

  // Fetch team members
  useEffect(() => {
    fetch("/api/calendar/owners")
      .then((r) => r.json())
      .then((data) => {
        const members: TeamMember[] = data.owners ?? []
        setTeamMembers(members)
        // Select all by default
        setSelectedOwners(new Set(members.map((m) => m.email)))
        // Assign colors
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

    // Filter by selected owners
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
        setSyncMessage("Not signed in — please sign in first")
        setSyncing(false)
        return
      }
      const data = await res.json()
      if (res.ok) {
        setSyncMessage(`Synced ${data.synced} events from ${data.users} calendars`)
        fetchEvents()
        // Refresh owners list in case new users synced
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
      setSyncMessage("Network error during sync")
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

  const toggleOwner = (email: string) => {
    setSelectedOwners((prev) => {
      const next = new Set(prev)
      if (next.has(email)) {
        next.delete(email)
      } else {
        next.add(email)
      }
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

  // Filter events client-side for selected owners
  const filteredEvents = events.filter(
    (e) => !e.calendarOwner || selectedOwners.has(e.calendarOwner)
  )

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Team schedule & availability"
        actions={
          <div className="flex items-center gap-3">
            {syncMessage && (
              <span
                className="text-xs"
                style={{
                  color: syncMessage.startsWith("Synced")
                    ? "var(--green)"
                    : "var(--orange)",
                }}
              >
                {syncMessage}
              </span>
            )}
            <button
              className="btn-primary text-sm"
              onClick={handleSync}
              disabled={syncing}
              style={{ opacity: syncing ? 0.6 : 1 }}
            >
              {syncing ? "Syncing..." : "Sync All Calendars"}
            </button>
          </div>
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
        {/* Team filter sidebar */}
        {teamMembers.length > 0 && (
          <div
            className="w-52 shrink-0 card p-4 self-start"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-[10px] font-semibold"
                style={{ color: "var(--text-dim)" }}
              >
                TEAM MEMBERS
              </h3>
              <button
                onClick={toggleAll}
                className="text-[10px] bg-transparent border-none cursor-pointer"
                style={{ color: "var(--rose)" }}
              >
                {selectedOwners.size === teamMembers.length
                  ? "None"
                  : "All"}
              </button>
            </div>
            <div className="space-y-1.5">
              {teamMembers.map((member) => {
                const color = ownerColors[member.email] ?? "var(--rose)"
                const isSelected = selectedOwners.has(member.email)
                return (
                  <button
                    key={member.email}
                    onClick={() => toggleOwner(member.email)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left border-none cursor-pointer transition-all duration-150"
                    style={{
                      background: isSelected ? `${color}15` : "transparent",
                      opacity: isSelected ? 1 : 0.5,
                    }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        background: color,
                        opacity: isSelected ? 1 : 0.3,
                      }}
                    />
                    <div className="min-w-0">
                      <div
                        className="text-xs font-semibold truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {member.name}
                      </div>
                      <div
                        className="text-[10px] truncate"
                        style={{ color: "var(--text-dim)" }}
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
              <div className="flex items-center gap-2 min-w-0">
                {selectedEvent.calendarOwner && ownerColors[selectedEvent.calendarOwner] && (
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: ownerColors[selectedEvent.calendarOwner] }}
                  />
                )}
                <h3
                  className="text-sm font-bold truncate"
                  style={{ color: "var(--text)" }}
                >
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="bg-transparent border-none cursor-pointer text-sm shrink-0 ml-2"
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

              {selectedEvent.calendarOwner && (
                <div>
                  <div
                    className="text-[10px] font-semibold mb-0.5"
                    style={{ color: "var(--text-dim)" }}
                  >
                    CALENDAR
                  </div>
                  <div className="flex items-center gap-1.5">
                    {ownerColors[selectedEvent.calendarOwner] && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: ownerColors[selectedEvent.calendarOwner] }}
                      />
                    )}
                    <div
                      className="text-xs"
                      style={{ color: "var(--text)" }}
                    >
                      {teamMembers.find((m) => m.email === selectedEvent.calendarOwner)?.name ??
                        selectedEvent.calendarOwner}
                    </div>
                  </div>
                </div>
              )}

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
                {!selectedEvent.callNoteId && (
                  <button
                    onClick={() => handleGenerateCallNotes(selectedEvent)}
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
                )}

                {selectedEvent.callNoteId && (
                  <Link
                    href={`/calendar/${selectedEvent.callNoteId}`}
                    className="block w-full text-center text-xs py-2 rounded-lg no-underline"
                    style={{
                      background: "var(--rose-dim)",
                      border: "1px solid var(--border-active)",
                      color: "var(--rose-light)",
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
