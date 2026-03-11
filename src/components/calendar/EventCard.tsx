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
  callNoteId?: string
}

interface EventCardProps {
  event: CalendarEvent
  onClick: (event: CalendarEvent) => void
  style?: React.CSSProperties
}

const EVENT_COLORS = [
  "var(--blue)",
  "var(--green)",
  "var(--purple)",
  "var(--orange)",
  "var(--teal)",
  "var(--yellow)",
  "var(--rose)",
]

function getEventColor(event: CalendarEvent): string {
  if (event.color) return event.color
  // Deterministic color from title
  let hash = 0
  for (let i = 0; i < event.title.length; i++) {
    hash = event.title.charCodeAt(i) + ((hash << 5) - hash)
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length]
}

export default function EventCard({ event, onClick, style }: EventCardProps) {
  const color = getEventColor(event)
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
        className="text-[10px] mt-0.5"
        style={{ color: "var(--text-dim)" }}
      >
        {startTime} - {endTime}
      </div>
    </button>
  )
}
