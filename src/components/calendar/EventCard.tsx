"use client"

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
}

interface EventCardProps {
  event: CalendarEvent
  onClick: (event: CalendarEvent) => void
  style?: React.CSSProperties
  ownerColor?: string
}

export default function EventCard({ event, onClick, style, ownerColor }: EventCardProps) {
  const color = ownerColor ?? event.color ?? "var(--rose)"
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
      className="w-full text-left rounded-lg px-2.5 py-1.5 cursor-pointer border-none transition-all duration-150"
      style={{
        background: `${color}20`,
        borderLeft: `3px solid ${color}`,
        ...style,
      }}
    >
      <div
        className="text-xs font-semibold truncate"
        style={{ color: "var(--text)" }}
      >
        {event.title}
      </div>
      <div
        className="text-[10px] mt-0.5 flex items-center gap-1"
        style={{ color: "var(--text-dim)" }}
      >
        <span>{startTime} - {endTime}</span>
        {event.calendarOwner && (
          <>
            <span style={{ color }}>{"·"}</span>
            <span className="truncate" style={{ color, maxWidth: 80 }}>
              {event.calendarOwner.split("@")[0]}
            </span>
          </>
        )}
      </div>
    </button>
  )
}
