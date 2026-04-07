"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import PageHeader from "@/components/layout/PageHeader"
import CalendarView from "@/components/calendar/CalendarView"
import CallNotesModal from "@/components/calendar/CallNotesModal"
import EventModal, { type EventFormData } from "@/components/calendar/EventModal"
import type { CalendarEvent } from "@/components/calendar/EventCard"
import Link from "next/link"

type ViewMode = "week" | "day" | "month"

interface TeamMember {
  email: string
  name: string
  image: string | null
}

interface CallNoteItem {
  id: string
  title: string
  date: string
  createdBy: string
  createdAt: string
  eventId: string | null
  event?: {
    id: string
    title: string
    startTime: string
    attendees: string[]
  } | null
}

const TEAM_COLORS = [
  "#C08B88", "#6BA3D6", "#7BC47F", "#B07CD8",
  "#E0A458", "#5CB8B2", "#D4C75A", "#D87CA3",
]

export default function CalendarPage() {
  const router = useRouter()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set())
  const [ownerColors, setOwnerColors] = useState<Record<string, string>>({})
  const [absences, setAbsences] = useState<Array<{ id: string; employee: { name: string; initials: string }; type: string; startDate: string; endDate: string }>>([])

  // Event Modal state
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventModalMode, setEventModalMode] = useState<"create" | "edit" | "view">("create")
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  // Call Notes state
  const [callNotes, setCallNotes] = useState<CallNoteItem[]>([])
  const [showCallNotesModal, setShowCallNotesModal] = useState(false)
  const [modalEvent, setModalEvent] = useState<{ id: string; title: string; start: string; attendees?: string[]; description?: string } | null>(null)
  const [searchCallNotes, setSearchCallNotes] = useState("")
  const uploadRef = useRef<HTMLInputElement>(null)

  // Fetch call notes
  const fetchCallNotes = useCallback(() => {
    fetch("/api/call-notes")
      .then((r) => r.json())
      .then((data) => setCallNotes(data.notes ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchCallNotes()
  }, [fetchCallNotes])

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
    const end = new Date(currentDate)

    if (viewMode === "month") {
      start.setDate(1)
      start.setDate(start.getDate() - 7) // padding
      end.setMonth(end.getMonth() + 1, 7) // padding
    } else {
      start.setDate(start.getDate() - 14)
      end.setDate(end.getDate() + 14)
    }

    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
    })

    if (selectedOwners.size > 0 && selectedOwners.size < teamMembers.length) {
      params.set("owners", Array.from(selectedOwners).join(","))
    }

    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => {})
  }, [currentDate, selectedOwners, teamMembers.length, viewMode])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Fetch approved absences
  useEffect(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)
    if (viewMode === "month") {
      start.setDate(1)
      start.setDate(start.getDate() - 7)
      end.setMonth(end.getMonth() + 1, 7)
    } else {
      start.setDate(start.getDate() - 14)
      end.setDate(end.getDate() + 14)
    }
    fetch(`/api/leaves?all=true&status=approved&startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
      .then((r) => r.json())
      .then((data) => {
        const reqs = data.requests ?? []
        setAbsences(reqs.map((r: { id: string; employee: { name: string; initials: string }; type: string; startDate: string; endDate: string }) => ({
          id: r.id,
          employee: { name: r.employee.name, initials: r.employee.initials },
          type: r.type,
          startDate: r.startDate,
          endDate: r.endDate,
        })))
      })
      .catch(() => {})
  }, [currentDate, viewMode])

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
        const errCount = data.errors?.length ?? 0
        const errDetail = data.errors?.map((e: { email: string; error: string }) => e.error).join("; ") ?? ""
        if (data.synced === 0 && errCount > 0) {
          setSyncMessage(`Sync failed: ${errDetail}`)
        } else if (errCount > 0) {
          setSyncMessage(`Synced ${data.synced} events (${errCount} error: ${errDetail})`)
        } else {
          setSyncMessage(`Synced ${data.synced} events from ${data.users} calendar${data.users > 1 ? "s" : ""}`)
        }

        // Refresh owners
        try {
          const ownersRes = await fetch("/api/calendar/owners")
          const ownersData = await ownersRes.json()
          const members: TeamMember[] = ownersData.owners ?? []
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
        } catch { /* silent */ }

        fetchEvents()
      } else {
        setSyncMessage(data.error ?? "Sync failed")
      }
    } catch {
      setSyncMessage("Network error")
    }
    setSyncing(false)
    setTimeout(() => setSyncMessage(null), 8000)
  }

  const handleUploadHTML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const htmlContent = await file.text()
      const res = await fetch("/api/call-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name.replace(/\.html?$/i, ""),
          date: new Date().toISOString(),
          htmlContent,
        }),
      })
      if (res.ok) fetchCallNotes()
    } catch { /* silent */ }
    if (uploadRef.current) uploadRef.current.value = ""
  }

  const openPrepareModal = (event?: CalendarEvent) => {
    if (event) {
      setModalEvent({
        id: event.id,
        title: event.title,
        start: event.start,
        attendees: event.attendees,
        description: event.description,
      })
    } else {
      setModalEvent(null)
    }
    setShowCallNotesModal(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    if (event.source === "internal") {
      setEditingEvent(event)
      setEventModalMode("edit")
      setShowEventModal(true)
    } else {
      setEditingEvent(event)
      setEventModalMode("view")
      setShowEventModal(true)
    }
  }

  const handleCreateEvent = async (data: EventFormData) => {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to create")
    setShowEventModal(false)
    setEditingEvent(null)
    fetchEvents()
  }

  const handleUpdateEvent = async (data: EventFormData) => {
    if (!editingEvent) return
    const res = await fetch(`/api/events/${editingEvent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to update")
    setShowEventModal(false)
    setEditingEvent(null)
    setSelectedEvent(null)
    fetchEvents()
  }

  const handleDeleteEvent = async () => {
    if (!editingEvent) return
    const res = await fetch(`/api/events/${editingEvent.id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete")
    setShowEventModal(false)
    setEditingEvent(null)
    setSelectedEvent(null)
    fetchEvents()
  }

  const navigateDate = (direction: number) => {
    const newDate = new Date(currentDate)
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + direction)
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + direction * 7)
    } else {
      newDate.setDate(newDate.getDate() + direction)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => setCurrentDate(new Date())

  const handleDayClick = (date: Date) => {
    setCurrentDate(date)
    setViewMode("day")
  }

  const formatDateRange = () => {
    if (viewMode === "month") {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    }
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

  const filteredEvents = teamMembers.length === 0
    ? events
    : events.filter(
        (e) => !e.calendarOwner || selectedOwners.has(e.calendarOwner)
      )

  const filteredCallNotes = callNotes.filter((n) =>
    !searchCallNotes || n.title.toLowerCase().includes(searchCallNotes.toLowerCase())
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
              onClick={() => {
                setEditingEvent(null)
                setEventModalMode("create")
                setShowEventModal(true)
              }}
              style={{ fontSize: 12 }}
            >
              + New Meeting
            </button>
            <button
              className="btn-secondary"
              onClick={() => openPrepareModal()}
              style={{ fontSize: 12 }}
            >
              {"\uD83D\uDCCB"} Call Notes
            </button>
            <label
              className="btn-secondary"
              style={{
                fontSize: 12,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {"\u2B06"} Upload
              <input
                ref={uploadRef}
                type="file"
                accept=".html,.htm"
                onChange={handleUploadHTML}
                style={{ display: "none" }}
              />
            </label>
            <button
              className="btn-secondary"
              onClick={handleSync}
              disabled={syncing}
              style={{ fontSize: 12 }}
            >
              {syncing ? "Syncing..." : "Sync"}
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
          {(["day", "week", "month"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`toggle-btn ${viewMode === mode ? "active" : ""}`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
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
                borderBottom: "1px solid var(--surface-elevated)",
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
            onEventClick={handleEventClick}
            onDayClick={handleDayClick}
            ownerColors={ownerColors}
            absences={absences}
          />
        </div>

        {/* Event detail side panel (quick view for week/day) */}
        {selectedEvent && !showEventModal && (
          <div
            className="w-80 shrink-0 card self-start animate-slideIn"
            style={{ overflow: "hidden" }}
          >
            <div
              className="flex items-start justify-between"
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--surface-elevated)",
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
                {/* Source badge */}
                <div style={{ display: "flex", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: selectedEvent.source === "google"
                        ? "var(--card-border)"
                        : "rgba(155,127,212,0.12)",
                      color: selectedEvent.source === "google"
                        ? "var(--text-dim)"
                        : "#9B7FD4",
                      fontFamily: "'DM Sans', sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {selectedEvent.source === "google" ? "Google" : "Internal"}
                  </span>
                </div>

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

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Edit button for internal events */}
                  {selectedEvent.source === "internal" && (
                    <button
                      onClick={() => handleEventClick(selectedEvent)}
                      className="btn-secondary w-full"
                      style={{ fontSize: 12 }}
                    >
                      Edit Meeting
                    </button>
                  )}

                  {!selectedEvent.callNoteId && (
                    <button
                      onClick={() => openPrepareModal(selectedEvent)}
                      className="btn-primary w-full"
                      style={{ fontSize: 12 }}
                    >
                      Prepare Call Notes
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

      {/* Call Notes List */}
      {callNotes.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 400,
                fontFamily: "'Bellfair', serif",
                color: "var(--text)",
                margin: 0,
              }}
            >
              Call Notes
            </h2>
            <input
              type="text"
              value={searchCallNotes}
              onChange={(e) => setSearchCallNotes(e.target.value)}
              placeholder="Search call notes..."
              style={{
                padding: "7px 14px",
                background: "var(--bg-input, #0A0C10)",
                border: "1px solid var(--card-border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
                width: 220,
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {filteredCallNotes.map((note) => (
              <Link
                key={note.id}
                href={`/calendar/${note.id}`}
                className="card no-underline"
                style={{
                  display: "block",
                  overflow: "hidden",
                  transition: "all 0.2s",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--surface-elevated)",
                    background: "rgba(192,139,136,0.02)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                      fontFamily: "'DM Sans', sans-serif",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {note.title}
                  </div>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>
                      {new Date(note.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span style={{ opacity: 0.4 }}>{"\u2022"}</span>
                    <span>{note.createdBy}</span>
                  </div>
                  {note.event && note.event.attendees && note.event.attendees.length > 0 && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-dim)",
                        marginTop: 6,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {note.event.attendees.slice(0, 3).join(", ")}
                      {note.event.attendees.length > 3 && ` +${note.event.attendees.length - 3}`}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Call Notes Modal */}
      {showCallNotesModal && (
        <CallNotesModal
          event={modalEvent}
          onClose={() => {
            setShowCallNotesModal(false)
            setModalEvent(null)
          }}
          onSuccess={(callNoteId) => {
            setShowCallNotesModal(false)
            setModalEvent(null)
            fetchCallNotes()
            router.push(`/calendar/${callNoteId}`)
          }}
        />
      )}

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          mode={eventModalMode}
          event={editingEvent}
          onClose={() => {
            setShowEventModal(false)
            setEditingEvent(null)
          }}
          onSave={eventModalMode === "create" ? handleCreateEvent : handleUpdateEvent}
          onDelete={eventModalMode === "edit" ? handleDeleteEvent : undefined}
        />
      )}
    </div>
  )
}
