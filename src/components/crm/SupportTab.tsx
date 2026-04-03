"use client"

import { useState, useEffect } from "react"

/* ── Design Tokens ── */
const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT = "#F0F0F2"
const TEXT_SEC = "rgba(240,240,242,0.55)"

const GLASS: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
}

const STATUS_COLORS: Record<string, string> = {
  open: "#3B82F6",
  in_progress: "#F59E0B",
  waiting_client: "#8B5CF6",
  resolved: "#10B981",
  closed: "#6B7280",
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444",
  high: "#F97316",
  medium: "#FBBF24",
  low: "#6B7280",
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "#6B7280"
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 500,
        fontFamily: "'DM Sans', sans-serif",
        borderRadius: 20,
        background: `${color}18`,
        color,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] || "#6B7280"
  const label = priority.charAt(0).toUpperCase() + priority.slice(1)
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 500,
        fontFamily: "'DM Sans', sans-serif",
        borderRadius: 20,
        background: `${color}18`,
        color,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  )
}

interface Ticket {
  id: string
  subject: string
  status: string
  priority: string
  channel: string
  createdAt: string
  assignedTo: string | null
}

export default function SupportTab({ contactId }: { contactId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await fetch(`/api/support/tickets?contactId=${contactId}`)
        const data = await res.json()
        setTickets(data.tickets ?? [])
      } catch {
        /* ignore */
      }
      setLoading(false)
    }
    fetchTickets()
  }, [contactId])

  if (loading) {
    return (
      <div style={{ ...GLASS, padding: 20 }}>
        <div style={{ padding: "32px 0", textAlign: "center", color: TEXT_SEC, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
          Loading support tickets...
        </div>
      </div>
    )
  }

  const openCount = tickets.filter((t) => ["open", "in_progress", "waiting_client"].includes(t.status)).length
  const totalCount = tickets.length

  if (totalCount === 0) {
    return (
      <div style={{ ...GLASS, padding: 20 }}>
        <div style={{ padding: "32px 0", textAlign: "center", color: TEXT_SEC, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
          No support tickets for this contact
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...GLASS, padding: 20 }}>
      {/* Summary bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, color: TEXT, margin: 0, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
          Support Tickets
        </h3>
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            borderRadius: 20,
            background: openCount > 0 ? `${STATUS_COLORS.open}18` : `${STATUS_COLORS.closed}18`,
            color: openCount > 0 ? STATUS_COLORS.open : STATUS_COLORS.closed,
            letterSpacing: 0.2,
          }}
        >
          {openCount} open
        </span>
        <span
          style={{
            fontSize: 12,
            color: TEXT_SEC,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {totalCount} total
        </span>
      </div>

      {/* Tickets table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
          <thead>
            <tr>
              {["Subject", "Status", "Priority", "Channel", "Created", "Assigned To"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    fontSize: 10,
                    fontWeight: 600,
                    color: TEXT_SEC,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    borderBottom: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                onClick={() => { window.location.href = `/support/${ticket.id}` }}
                style={{ cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
              >
                <td style={{ padding: "10px 10px", fontSize: 13, color: TEXT, borderBottom: `1px solid ${CARD_BORDER}`, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ticket.subject}
                </td>
                <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                  <StatusBadge status={ticket.status} />
                </td>
                <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: TEXT_SEC, borderBottom: `1px solid ${CARD_BORDER}`, textTransform: "capitalize" }}>
                  {ticket.channel}
                </td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: TEXT_SEC, borderBottom: `1px solid ${CARD_BORDER}`, whiteSpace: "nowrap" }}>
                  {new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: TEXT_SEC, borderBottom: `1px solid ${CARD_BORDER}` }}>
                  {ticket.assignedTo || "Unassigned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
