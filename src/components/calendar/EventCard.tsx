"use client"

export const EVENT_TYPE_COLORS: Record<string, string> = {
  team_call: "#C08B88",
  client_call: "#5CB868",
  internal: "#5B9BBF",
  meeting: "#9B7FD4",
  reminder: "#E5C453",
  google_synced: "rgba(255,255,255,0.15)",
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: string
  end: string
  color?: string
  attendees?: string[]
  location?: string
  calendarOwner?: string
  callNoteId?: string
  source?: "google" | "internal"
  type?: string
  meetLink?: string
  recurring?: string | null
  googleEventId?: string
}

interface EventCardProps {
  event: CalendarEvent
  onClick: (event: CalendarEvent) => void
  style?: React.CSSProperties
  ownerColor?: string
}

export default function EventCard({ event, onClick, style, ownerColor }: EventCardProps) {
  const typeColor = event.type ? EVENT_TYPE_COLORS[event.type] : undefined
  const color = ownerColor ?? typeColor ?? event.color ?? "var(--rose)"
  const startTime = new Date(event.start).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
  const endTime = new Date(event.end).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })

  return (
    <button
      onClick={() => onClick(event)}
      className="w-full text-left cursor-pointer border-none"
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        background: `${color}15`,
        borderLeft: `3px solid ${color}`,
        transition: "all 0.15s ease",
        fontFamily: "'DM Sans', sans-serif",
        marginBottom: 2,
        position: "relative",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}25`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}15`
      }}
    >
      <div
        className="truncate"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text)",
          paddingRight: 14,
        }}
      >
        {event.title}
      </div>
      <div
        className="flex items-center gap-1"
        style={{
          fontSize: 10,
          color: "var(--text-dim)",
          marginTop: 2,
        }}
      >
        <span>{startTime} - {endTime}</span>
        {event.calendarOwner && (
          <>
            <span style={{ color, opacity: 0.7 }}>{"\u00B7"}</span>
            <span className="truncate" style={{ color, maxWidth: 70, fontSize: 9 }}>
              {event.calendarOwner.split("@")[0]}
            </span>
          </>
        )}
        {event.recurring && event.recurring !== "none" && (
          <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 2 }} title="Recurring">
            {"\u21BB"}
          </span>
        )}
      </div>
      {/* Source indicator */}
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          fontSize: 7,
          fontWeight: 700,
          lineHeight: 1,
          opacity: 0.4,
        }}
        title={event.source === "google" ? "Google Calendar" : "Internal"}
      >
        {event.source === "google" ? "G" : "\u25CF"}
      </div>
    </button>
  )
}
