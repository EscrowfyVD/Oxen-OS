"use client"

import { useState } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, AMBER, fmtDateTime,
} from "./constants"
import type { MeetingBrief, CalendarEvent } from "./types"

interface BriefsSectionProps {
  briefs: MeetingBrief[]
  events: CalendarEvent[]
  onGenerateBrief: (event: CalendarEvent) => void
  onViewBrief: (brief: MeetingBrief) => void
  generatingId: string | null
}

export default function BriefsSection({ briefs, events, onGenerateBrief, onViewBrief, generatingId }: BriefsSectionProps) {
  // Match events with briefs
  const eventBriefMap: Record<string, MeetingBrief> = {}
  for (const b of briefs) {
    if (b.eventId) eventBriefMap[b.eventId] = b
  }

  // Filter to upcoming 7 days
  const now = new Date()
  const weekFromNow = new Date()
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  const upcomingEvents = events
    .filter((e) => new Date(e.start) >= now && new Date(e.start) <= weekFromNow)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  // Also show briefs without matching events
  const standaloneBriefs = briefs.filter((b) => !b.eventId && new Date(b.meetingDate) >= now)

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 400, color: TEXT_PRIMARY, fontFamily: "'Bellfair', serif", margin: "0 0 14px" }}>
        Upcoming Meetings
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {upcomingEvents.map((event) => {
          const brief = eventBriefMap[event.id]
          const isGenerating = generatingId === event.id
          const isPast = new Date(event.start) < now

          return (
            <div
              key={event.id}
              style={{
                background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
                padding: "14px 16px", display: "flex", alignItems: "center", gap: 14,
              }}
            >
              {/* Date/Time */}
              <div style={{
                flexShrink: 0, textAlign: "center", width: 50,
                padding: "6px 0", borderRadius: 8,
                background: "rgba(192,139,136,0.06)", border: "1px solid rgba(192,139,136,0.1)",
              }}>
                <div style={{ fontSize: 18, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY, lineHeight: 1 }}>
                  {new Date(event.start).getDate()}
                </div>
                <div style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase" }}>
                  {new Date(event.start).toLocaleDateString("en-GB", { month: "short" })}
                </div>
                <div style={{ fontSize: 9, color: ROSE_GOLD, marginTop: 2 }}>
                  {new Date(event.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY,
                  fontFamily: "'DM Sans', sans-serif",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {event.title}
                </div>
                {event.attendees.length > 0 && (
                  <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>
                    {event.attendees.slice(0, 3).join(", ")}
                    {event.attendees.length > 3 && ` +${event.attendees.length - 3}`}
                  </div>
                )}
              </div>

              {/* Brief status / action */}
              <div style={{ flexShrink: 0 }}>
                {brief ? (
                  <button
                    onClick={() => onViewBrief(brief)}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                      background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)",
                      color: GREEN, display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{"\u2705"}</span> View Brief
                  </button>
                ) : (
                  <button
                    onClick={() => onGenerateBrief(event)}
                    disabled={isGenerating}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", cursor: isGenerating ? "wait" : "pointer",
                      background: isGenerating
                        ? "rgba(251,191,36,0.08)"
                        : "linear-gradient(135deg, rgba(192,139,136,0.15), rgba(192,139,136,0.08))",
                      border: `1px solid ${isGenerating ? "rgba(251,191,36,0.2)" : "rgba(192,139,136,0.25)"}`,
                      color: isGenerating ? AMBER : ROSE_GOLD,
                    }}
                  >
                    {isGenerating ? "Generating..." : "Generate Brief"}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Standalone briefs */}
        {standaloneBriefs.map((brief) => (
          <div
            key={brief.id}
            style={{
              background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
              padding: "14px 16px", display: "flex", alignItems: "center", gap: 14,
            }}
          >
            <div style={{
              flexShrink: 0, textAlign: "center", width: 50,
              padding: "6px 0", borderRadius: 8,
              background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.1)",
            }}>
              <div style={{ fontSize: 18, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY, lineHeight: 1 }}>
                {new Date(brief.meetingDate).getDate()}
              </div>
              <div style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase" }}>
                {new Date(brief.meetingDate).toLocaleDateString("en-GB", { month: "short" })}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                {brief.title}
              </div>
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 3 }}>
                Brief generated · {brief.contact?.company || brief.contact?.name || ""}
              </div>
            </div>

            <button
              onClick={() => onViewBrief(brief)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)",
                color: GREEN,
              }}
            >
              View Brief
            </button>
          </div>
        ))}

        {upcomingEvents.length === 0 && standaloneBriefs.length === 0 && (
          <div style={{
            textAlign: "center", padding: "30px 20px", color: TEXT_TERTIARY, fontSize: 12,
            background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
          }}>
            No upcoming meetings in the next 7 days
          </div>
        )}
      </div>
    </div>
  )
}
