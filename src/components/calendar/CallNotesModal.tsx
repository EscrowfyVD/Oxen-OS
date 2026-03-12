"use client"

import { useState } from "react"

interface CallNotesModalProps {
  event?: {
    id: string
    title: string
    start: string
    attendees?: string[]
    description?: string
  } | null
  onClose: () => void
  onSuccess: (callNoteId: string) => void
}

export default function CallNotesModal({ event, onClose, onSuccess }: CallNotesModalProps) {
  const [title, setTitle] = useState(event?.title ?? "")
  const [date, setDate] = useState(
    event?.start ? new Date(event.start).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  )
  const [attendees, setAttendees] = useState(
    event?.attendees ? event.attendees.join(", ") : ""
  )
  const [agenda, setAgenda] = useState("")
  const [context, setContext] = useState(event?.description ?? "")
  const [questions, setQuestions] = useState("")
  const [participants, setParticipants] = useState("")
  const [previousDecisions, setPreviousDecisions] = useState("")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!title.trim()) {
      setError("Title is required")
      return
    }
    if (!agenda.trim()) {
      setError("Agenda is required")
      return
    }

    setError(null)
    setGenerating(true)

    try {
      const res = await fetch("/api/call-notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          date: new Date(date).toISOString(),
          attendees: attendees.split(",").map((a) => a.trim()).filter(Boolean),
          agenda: agenda.trim(),
          context: context.trim() || undefined,
          questions: questions.trim() || undefined,
          participants: participants.trim() || undefined,
          previousDecisions: previousDecisions.trim() || undefined,
          eventId: event?.id || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Failed to generate call notes")
        setGenerating(false)
        return
      }

      if (data.callNoteId) {
        onSuccess(data.callNoteId)
      } else {
        setError("No call note ID returned")
        setGenerating(false)
      }
    } catch {
      setError("Network error — please try again")
      setGenerating(false)
    }
  }

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
    transition: "border-color 0.2s, box-shadow 0.2s",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
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
        if (e.target === e.currentTarget && !generating) onClose()
      }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: "100%",
          maxWidth: 640,
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
                background: "linear-gradient(135deg, #C08B88, #D4A5A2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
              }}
            >
              {"\uD83D\uDCCB"}
            </div>
            <div>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text, #F0F0F2)",
                  margin: 0,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Prepare Call Notes
              </h2>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary, rgba(240,240,242,0.3))",
                  margin: 0,
                }}
              >
                Sentinel will generate an interactive work page
              </p>
            </div>
          </div>
          {!generating && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                color: "var(--text-tertiary, rgba(240,240,242,0.3))",
                padding: 4,
              }}
            >
              {"\u2715"}
            </button>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Title + Date row */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>
                Title <span style={{ color: "#C08B88" }}>*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting title"
                style={inputStyle}
                disabled={generating}
              />
            </div>
            <div style={{ width: 200, flexShrink: 0 }}>
              <label style={labelStyle}>Date</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...inputStyle, colorScheme: "dark" }}
                disabled={generating}
              />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label style={labelStyle}>Attendees</label>
            <input
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="name@example.com, name2@example.com"
              style={inputStyle}
              disabled={generating}
            />
          </div>

          {/* Agenda (REQUIRED) */}
          <div>
            <label style={labelStyle}>
              Agenda <span style={{ color: "#C08B88" }}>*</span>
            </label>
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder={"1. Review Q1 results\n2. Discuss pipeline updates\n3. Align on next steps"}
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
              disabled={generating}
            />
          </div>

          {/* Context & Prep Work */}
          <div>
            <label style={labelStyle}>Context & Prep Work</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Background info, relevant data, research notes..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              disabled={generating}
            />
          </div>

          {/* Key Questions */}
          <div>
            <label style={labelStyle}>Key Questions to Validate</label>
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder={"- Are we on track for the deadline?\n- What's the budget status?\n- Who owns the next deliverable?"}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              disabled={generating}
            />
          </div>

          {/* Participants & Roles */}
          <div>
            <label style={labelStyle}>Participants & Roles</label>
            <textarea
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder={"Vernon — CEO, decision maker\nAlex — Project lead\nSara — Finance review"}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              disabled={generating}
            />
          </div>

          {/* Previous Decisions */}
          <div>
            <label style={labelStyle}>Previous Decisions / Follow-ups</label>
            <textarea
              value={previousDecisions}
              onChange={(e) => setPreviousDecisions(e.target.value)}
              placeholder="Decisions from last meeting, open items to revisit..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              disabled={generating}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--card-border, rgba(255,255,255,0.06))",
            background: "rgba(192,139,136,0.02)",
            flexShrink: 0,
          }}
        >
          {error && (
            <div
              style={{
                fontSize: 12,
                color: "#EF4444",
                marginBottom: 12,
                padding: "8px 12px",
                background: "rgba(239,68,68,0.08)",
                borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {!generating && (
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: "transparent",
                  border: "1px solid var(--card-border, rgba(255,255,255,0.06))",
                  color: "var(--text-tertiary, rgba(240,240,242,0.3))",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                background: generating
                  ? "rgba(192,139,136,0.15)"
                  : "linear-gradient(135deg, #C08B88, #D4A5A2)",
                border: "none",
                color: generating ? "#C08B88" : "#060709",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: generating ? "wait" : "pointer",
                transition: "all 0.2s",
                minWidth: 200,
              }}
            >
              {generating ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(192,139,136,0.3)",
                      borderTopColor: "#C08B88",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Sentinel is preparing your call notes...
                </span>
              ) : (
                "Generate Call Notes Page"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
