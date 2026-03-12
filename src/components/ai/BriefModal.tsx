"use client"

import Link from "next/link"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, BRIEF_SECTIONS, fmtDateTime,
} from "./constants"
import type { MeetingBrief } from "./types"

interface BriefModalProps {
  brief: MeetingBrief
  onClose: () => void
}

export default function BriefModal({ brief, onClose }: BriefModalProps) {
  const bc = brief.briefContent

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0C0E14", border: `1px solid ${CARD_BORDER}`, borderRadius: 20,
          width: 640, maxHeight: "88vh", overflow: "auto",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}`,
          position: "sticky", top: 0, background: "#0C0E14", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, color: ROSE_GOLD, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Meeting Brief
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 400, color: TEXT_PRIMARY, fontFamily: "'Bellfair', serif", margin: 0, lineHeight: 1.3 }}>
                {brief.title}
              </h2>
              <div style={{ fontSize: 11, color: TEXT_TERTIARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                {fmtDateTime(brief.meetingDate)}
                {brief.attendees.length > 0 && ` · ${brief.attendees.join(", ")}`}
              </div>
              {brief.contact && (
                <Link href={`/crm/${brief.contact.id}`} style={{
                  fontSize: 11, color: ROSE_GOLD, textDecoration: "none",
                  fontFamily: "'DM Sans', sans-serif", display: "inline-block", marginTop: 4,
                }}>
                  {brief.contact.company || brief.contact.name}
                </Link>
              )}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", fontSize: 20, padding: 4 }}>{"\u2715"}</button>
          </div>
        </div>

        {/* Brief content */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {BRIEF_SECTIONS.map((section) => {
            const value = bc[section.key as keyof typeof bc]
            if (!value) return null

            return (
              <div key={section.key}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                }}>
                  <span style={{ fontSize: 14 }}>{section.icon}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY,
                    fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}>
                    {section.label}
                  </span>
                </div>

                <div style={{
                  padding: "12px 16px", borderRadius: 10,
                  background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
                }}>
                  {Array.isArray(value) ? (
                    <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                      {(value as string[]).map((item, i) => (
                        <li key={i} style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6, margin: 0, fontFamily: "'DM Sans', sans-serif", whiteSpace: "pre-wrap" }}>
                      {value as string}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${CARD_BORDER}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
          position: "sticky", bottom: 0, background: "#0C0E14",
        }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
