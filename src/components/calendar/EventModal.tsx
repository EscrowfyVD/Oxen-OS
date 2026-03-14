"use client"

import { useState, useEffect } from "react"
import { EVENT_TYPE_COLORS, type CalendarEvent } from "./EventCard"

type ModalMode = "create" | "edit" | "view"

interface EventModalProps {
  mode: ModalMode
  event?: CalendarEvent | null
  onClose: () => void
  onSave: (data: EventFormData) => Promise<void>
  onDelete?: () => Promise<void>
}

export interface EventFormData {
  title: string
  description: string
  startTime: string
  endTime: string
  location: string
  meetLink: string
  attendees: string[]
  type: string
  color: string
  recurring: string
}

const EVENT_TYPES = [
  { value: "team_call", label: "Team Call" },
  { value: "client_call", label: "Client Call" },
  { value: "internal", label: "Internal" },
  { value: "meeting", label: "Meeting" },
  { value: "reminder", label: "Reminder" },
]

const RECURRING_OPTIONS = [
  { value: "none", label: "No Repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

interface Employee {
  id: string
  name: string
  email: string | null
}

export default function EventModal({ mode, event, onClose, onSave, onDelete }: EventModalProps) {
  const isReadOnly = mode === "view"
  const isGoogle = event?.source === "google"

  const now = new Date()
  const defaultStart = new Date(now)
  defaultStart.setMinutes(0, 0, 0)
  defaultStart.setHours(defaultStart.getHours() + 1)
  const defaultEnd = new Date(defaultStart)
  defaultEnd.setHours(defaultEnd.getHours() + 1)

  const [title, setTitle] = useState(event?.title ?? "")
  const [description, setDescription] = useState(event?.description ?? "")
  const [startTime, setStartTime] = useState(
    event?.start ? new Date(event.start).toISOString().slice(0, 16) : defaultStart.toISOString().slice(0, 16)
  )
  const [endTime, setEndTime] = useState(
    event?.end ? new Date(event.end).toISOString().slice(0, 16) : defaultEnd.toISOString().slice(0, 16)
  )
  const [location, setLocation] = useState(event?.location ?? "")
  const [meetLink, setMeetLink] = useState(event?.meetLink ?? "")
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>(event?.attendees ?? [])
  const [type, setType] = useState(event?.type ?? "meeting")
  const [recurring, setRecurring] = useState(event?.recurring ?? "none")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [attendeeSearch, setAttendeeSearch] = useState("")

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required")
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        location: location.trim(),
        meetLink: meetLink.trim(),
        attendees: selectedAttendees,
        type,
        color: EVENT_TYPE_COLORS[type] ?? EVENT_TYPE_COLORS.meeting,
        recurring,
      })
    } catch {
      setError("Failed to save event")
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
    } catch {
      setError("Failed to delete event")
    }
    setDeleting(false)
  }

  const toggleAttendee = (email: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    )
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.email &&
      (emp.name.toLowerCase().includes(attendeeSearch.toLowerCase()) ||
        emp.email.toLowerCase().includes(attendeeSearch.toLowerCase()))
  )

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-input, #0A0C10)",
    border: "1px solid var(--card-border, rgba(255,255,255,0.06))",
    borderRadius: 10,
    color: "var(--text, #F0F0F2)",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    transition: "border-color 0.2s",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-tertiary, rgba(240,240,242,0.3))",
    marginBottom: 6,
    display: "block",
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !deleting) onClose()
      }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          background: "var(--card-bg, #0F1118)",
          border: "1px solid var(--card-border, rgba(255,255,255,0.06))",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--card-border, rgba(255,255,255,0.06))",
            background: "rgba(192,139,136,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${EVENT_TYPE_COLORS[type] ?? "#9B7FD4"}, ${EVENT_TYPE_COLORS[type] ?? "#9B7FD4"}88)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
              }}
            >
              {"\uD83D\uDCC5"}
            </div>
            <div>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text)",
                  fontFamily: "'DM Sans', sans-serif",
                  margin: 0,
                }}
              >
                {mode === "create" ? "New Meeting" : mode === "edit" ? "Edit Meeting" : "Meeting Details"}
              </h2>
              {isGoogle && (
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                  Synced from Google Calendar
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "var(--text-dim)",
              padding: 4,
            }}
          >
            {"\u2715"}
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Title */}
            <div>
              <label style={labelStyle}>Title</label>
              {isReadOnly ? (
                <div style={{ fontSize: 13, color: "var(--text)" }}>{title}</div>
              ) : (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Meeting title"
                  style={inputStyle}
                />
              )}
            </div>

            {/* Date & Time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Start</label>
                {isReadOnly ? (
                  <div style={{ fontSize: 12, color: "var(--text)" }}>
                    {new Date(startTime).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                ) : (
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={inputStyle}
                  />
                )}
              </div>
              <div>
                <label style={labelStyle}>End</label>
                {isReadOnly ? (
                  <div style={{ fontSize: 12, color: "var(--text)" }}>
                    {new Date(endTime).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                ) : (
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={inputStyle}
                  />
                )}
              </div>
            </div>

            {/* Type */}
            <div>
              <label style={labelStyle}>Type</label>
              {isReadOnly ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: EVENT_TYPE_COLORS[type] ?? "var(--rose)",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text)" }}>
                    {EVENT_TYPES.find((t) => t.value === type)?.label ?? type}
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: type === t.value
                          ? `1px solid ${EVENT_TYPE_COLORS[t.value]}`
                          : "1px solid var(--card-border, rgba(255,255,255,0.06))",
                        background: type === t.value
                          ? `${EVENT_TYPE_COLORS[t.value]}15`
                          : "var(--bg-input, #0A0C10)",
                        cursor: "pointer",
                        fontSize: 11,
                        color: "var(--text)",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: EVENT_TYPE_COLORS[t.value],
                        }}
                      />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label style={labelStyle}>Location</label>
              {isReadOnly ? (
                <div style={{ fontSize: 12, color: "var(--text)" }}>{location || "—"}</div>
              ) : (
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Office, Zoom, etc."
                  style={inputStyle}
                />
              )}
            </div>

            {/* Meet Link */}
            <div>
              <label style={labelStyle}>Meet Link</label>
              {isReadOnly ? (
                meetLink ? (
                  <a
                    href={meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "var(--rose)" }}
                  >
                    {meetLink}
                  </a>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>—</div>
                )
              ) : (
                <input
                  type="url"
                  value={meetLink}
                  onChange={(e) => setMeetLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  style={inputStyle}
                />
              )}
            </div>

            {/* Attendees */}
            <div>
              <label style={labelStyle}>Attendees</label>
              {isReadOnly ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {(event?.attendees ?? []).map((email, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        background: "var(--bg-input)",
                        fontSize: 11,
                        color: "var(--text)",
                      }}
                    >
                      {email}
                    </div>
                  ))}
                  {(!event?.attendees || event.attendees.length === 0) && (
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>No attendees</div>
                  )}
                </div>
              ) : (
                <>
                  {/* Selected attendees */}
                  {selectedAttendees.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      {selectedAttendees.map((email) => {
                        const emp = employees.find((e) => e.email === email)
                        return (
                          <div
                            key={email}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "rgba(192,139,136,0.1)",
                              border: "1px solid rgba(192,139,136,0.2)",
                              fontSize: 10,
                              color: "var(--text)",
                            }}
                          >
                            <span>{emp?.name ?? email.split("@")[0]}</span>
                            <button
                              onClick={() => toggleAttendee(email)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--text-dim)",
                                fontSize: 10,
                                padding: 0,
                                lineHeight: 1,
                              }}
                            >
                              {"\u2715"}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {/* Search input */}
                  <input
                    type="text"
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                    placeholder="Search team members..."
                    style={{ ...inputStyle, marginBottom: 4 }}
                  />
                  {/* Dropdown */}
                  {attendeeSearch && (
                    <div
                      style={{
                        maxHeight: 120,
                        overflowY: "auto",
                        border: "1px solid var(--card-border, rgba(255,255,255,0.06))",
                        borderRadius: 8,
                        background: "var(--bg-input, #0A0C10)",
                      }}
                    >
                      {filteredEmployees.map((emp) => {
                        const isSelected = selectedAttendees.includes(emp.email!)
                        return (
                          <button
                            key={emp.id}
                            onClick={() => {
                              toggleAttendee(emp.email!)
                              setAttendeeSearch("")
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              padding: "6px 10px",
                              border: "none",
                              borderBottom: "1px solid rgba(255,255,255,0.03)",
                              background: isSelected ? "rgba(192,139,136,0.08)" : "transparent",
                              cursor: "pointer",
                              fontSize: 11,
                              color: "var(--text)",
                              fontFamily: "'DM Sans', sans-serif",
                              textAlign: "left",
                            }}
                          >
                            <span>{emp.name}</span>
                            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                              {isSelected ? "\u2713" : emp.email?.split("@")[0]}
                            </span>
                          </button>
                        )
                      })}
                      {filteredEmployees.length === 0 && (
                        <div style={{ padding: 8, fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
                          No matches
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              {isReadOnly ? (
                <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {description || "—"}
                </div>
              ) : (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Meeting description..."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              )}
            </div>

            {/* Recurring */}
            {!isReadOnly && (
              <div>
                <label style={labelStyle}>Repeat</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {RECURRING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRecurring(opt.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: recurring === opt.value
                          ? "1px solid var(--rose)"
                          : "1px solid var(--card-border, rgba(255,255,255,0.06))",
                        background: recurring === opt.value
                          ? "rgba(192,139,136,0.1)"
                          : "var(--bg-input, #0A0C10)",
                        cursor: "pointer",
                        fontSize: 11,
                        color: "var(--text)",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isReadOnly && event?.recurring && event.recurring !== "none" && (
              <div>
                <label style={labelStyle}>Repeat</label>
                <div style={{ fontSize: 12, color: "var(--text)" }}>
                  {RECURRING_OPTIONS.find((o) => o.value === event.recurring)?.label ?? event.recurring}
                </div>
              </div>
            )}

            {/* Call Note link for read-only view */}
            {isReadOnly && event?.callNoteId && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <a
                  href={`/calendar/${event.callNoteId}`}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: 10,
                    borderRadius: 10,
                    background: "rgba(192,139,136,0.08)",
                    border: "1px solid rgba(192,139,136,0.2)",
                    color: "var(--rose)",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    textDecoration: "none",
                  }}
                >
                  View Call Notes
                </a>
              </div>
            )}

            {error && (
              <div style={{ fontSize: 12, color: "#f87171", fontFamily: "'DM Sans', sans-serif" }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--card-border, rgba(255,255,255,0.06))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          {/* Left: Delete button for edit mode */}
          <div>
            {mode === "edit" && onDelete && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(248,113,113,0.3)",
                  background: "rgba(248,113,113,0.08)",
                  color: "#f87171",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Delete
              </button>
            )}
            {showDeleteConfirm && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#f87171" }}>Delete this meeting?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "#f87171",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: deleting ? "not-allowed" : "pointer",
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  {deleting ? "..." : "Yes"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-dim)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  No
                </button>
              </div>
            )}
          </div>

          {/* Right: Save / Close */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              className="btn-secondary"
              style={{ fontSize: 12 }}
            >
              {isReadOnly ? "Close" : "Cancel"}
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
                style={{ fontSize: 12, opacity: saving ? 0.5 : 1 }}
              >
                {saving ? "Saving..." : mode === "create" ? "Create Meeting" : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
