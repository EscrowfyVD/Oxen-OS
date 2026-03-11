"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  GREEN, AMBER, RED, BLUE, PURPLE, ROSE_GOLD,
  STATUSES, STATUS_COLORS, PRIORITIES, PRIORITY_COLORS,
  CHANNELS, CATEGORIES, CATEGORY_LABELS,
  fmtDateTime, fmtDuration, timeAgo, labelStyle, inputStyle,
} from "@/components/support/constants"
import type { SupportTicket, SupportMessage, Employee } from "@/components/support/types"

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  /* Message input */
  const [messageText, setMessageText] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)

  /* Contact search for linking */
  const [contactSearch, setContactSearch] = useState("")
  const [contactResults, setContactResults] = useState<Array<{ id: string; name: string; email: string | null; company: string | null }>>([])

  const fetchTicket = useCallback(() => {
    fetch(`/api/support/tickets/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTicket(data.ticket ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const fetchEmployees = useCallback(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => {
        setEmployees((data.employees ?? []).map((e: Record<string, string>) => ({
          id: e.id,
          name: e.name,
          initials: e.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?",
          role: e.role ?? "",
        })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchTicket()
    fetchEmployees()
  }, [fetchTicket, fetchEmployees])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [ticket?.messages])

  /* ── Handlers ── */
  const sendMessage = async () => {
    if (!messageText.trim() || !ticket) return
    setSending(true)
    try {
      await fetch(`/api/support/tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: isInternal ? "Agent" : (ticket.assignedTo || "Agent"),
          content: messageText.trim(),
          isInternal,
        }),
      })
      setMessageText("")
      fetchTicket()
    } catch { /* silent */ }
    setSending(false)
  }

  const updateTicket = async (field: string, value: string | null) => {
    if (!ticket) return
    try {
      await fetch(`/api/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      fetchTicket()
    } catch { /* silent */ }
  }

  const searchContacts = async (q: string) => {
    setContactSearch(q)
    if (q.length < 2) { setContactResults([]); return }
    try {
      const r = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&limit=5`)
      const data = await r.json()
      setContactResults((data.contacts ?? []).map((c: Record<string, string | null>) => ({
        id: c.id, name: c.name, email: c.email, company: c.company,
      })))
    } catch { setContactResults([]) }
  }

  const linkContact = async (contactId: string) => {
    await updateTicket("contactId", contactId)
    setContactSearch("")
    setContactResults([])
  }

  if (loading) {
    return (
      <div className="page-content" style={{ padding: 40, background: "#060709", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", color: TEXT_TERTIARY, fontSize: 13 }}>Loading ticket...</div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="page-content" style={{ padding: 40, background: "#060709", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", color: TEXT_TERTIARY, fontSize: 13 }}>Ticket not found</div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/support" style={{ color: ROSE_GOLD, fontSize: 12 }}>Back to Support</Link>
        </div>
      </div>
    )
  }

  const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS.open
  const pc = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium
  const chDef = CHANNELS.find((c) => c.id === ticket.channel)

  return (
    <div className="page-content fade-in" style={{ padding: 0, background: "#060709", minHeight: "100vh" }}>
      {/* Top Bar */}
      <div style={{
        padding: "16px 28px", borderBottom: `1px solid ${CARD_BORDER}`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link href="/support" style={{ color: TEXT_TERTIARY, textDecoration: "none", fontSize: 18, lineHeight: 1 }}>{"\u2190"}</Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 500,
              color: TEXT_PRIMARY, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {ticket.subject}
            </h1>
            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500, background: sc.bg, color: sc.text, fontFamily: "'DM Sans', sans-serif" }}>
              {ticket.status.replace(/_/g, " ")}
            </span>
            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500, background: pc.bg, color: pc.text, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>
              {ticket.priority}
            </span>
            {chDef && (
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500, background: `${chDef.color}15`, color: chDef.color, fontFamily: "'DM Sans', sans-serif" }}>
                {chDef.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content: chat area + sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", height: "calc(100vh - 120px)" }}>
        {/* Chat area */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: `1px solid ${CARD_BORDER}` }}>
          {/* Client info */}
          <div style={{
            padding: "12px 24px", borderBottom: `1px solid ${CARD_BORDER}`,
            display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.01)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #60A5FA, #3B82F6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#FFF" }}>
                {ticket.clientName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                {ticket.clientName}
              </div>
              <div style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                {ticket.clientEmail || "No email"}
                {ticket.contact && (
                  <> · <Link href={`/crm/${ticket.contact.id}`} style={{ color: ROSE_GOLD, textDecoration: "none" }}>CRM: {ticket.contact.name}</Link></>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            {ticket.messages.map((msg) => {
              const isClient = msg.sender === "client"
              const msgBg = msg.isInternal
                ? "rgba(251,191,36,0.06)"
                : isClient
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(192,139,136,0.06)"
              const msgBorder = msg.isInternal
                ? "rgba(251,191,36,0.15)"
                : `rgba(255,255,255,0.06)`
              const align = isClient ? "flex-start" : "flex-end"

              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: align }}>
                  <div style={{
                    maxWidth: "70%", padding: "10px 14px", borderRadius: 12,
                    background: msgBg, border: `1px solid ${msgBorder}`,
                    ...(isClient
                      ? { borderTopLeftRadius: 4 }
                      : { borderTopRightRadius: 4 }),
                  }}>
                    {msg.isInternal && (
                      <div style={{
                        fontSize: 9, fontWeight: 600, color: AMBER, textTransform: "uppercase",
                        letterSpacing: 1, marginBottom: 4, fontFamily: "'DM Sans', sans-serif",
                      }}>
                        Internal Note
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                        color: isClient ? BLUE : ROSE_GOLD,
                      }}>
                        {isClient ? ticket.clientName : msg.sender}
                      </span>
                      <span style={{ fontSize: 9, color: TEXT_TERTIARY }}>{timeAgo(msg.createdAt)}</span>
                    </div>
                    <div style={{
                      fontSize: 12, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif",
                      lineHeight: 1.5, whiteSpace: "pre-wrap",
                    }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            })}
            {ticket.messages.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: TEXT_TERTIARY, fontSize: 12 }}>
                No messages yet
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: "12px 24px", borderTop: `1px solid ${CARD_BORDER}`,
            background: isInternal ? "rgba(251,191,36,0.03)" : "transparent",
          }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => setIsInternal(false)}
                style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                  border: `1px solid ${!isInternal ? ROSE_GOLD : CARD_BORDER}`,
                  background: !isInternal ? "rgba(192,139,136,0.1)" : "transparent",
                  color: !isInternal ? ROSE_GOLD : TEXT_TERTIARY,
                }}
              >
                Reply
              </button>
              <button
                onClick={() => setIsInternal(true)}
                style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                  border: `1px solid ${isInternal ? AMBER : CARD_BORDER}`,
                  background: isInternal ? "rgba(251,191,36,0.1)" : "transparent",
                  color: isInternal ? AMBER : TEXT_TERTIARY,
                }}
              >
                Internal Note
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendMessage()
                }}
                placeholder={isInternal ? "Add an internal note..." : "Type your reply..."}
                rows={2}
                style={{
                  ...inputStyle, flex: 1, resize: "vertical", minHeight: 44,
                  borderColor: isInternal ? "rgba(251,191,36,0.2)" : CARD_BORDER,
                }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !messageText.trim()}
                className="btn-primary"
                style={{
                  padding: "8px 18px", fontSize: 11, alignSelf: "flex-end",
                  opacity: !messageText.trim() ? 0.5 : 1,
                  background: isInternal ? AMBER : undefined,
                }}
              >
                {sending ? "..." : isInternal ? "Add Note" : "Send Reply"}
              </button>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={ticket.status}
              onChange={(e) => updateTicket("status", e.target.value)}
              style={inputStyle}
            >
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label style={labelStyle}>Priority</label>
            <select
              value={ticket.priority}
              onChange={(e) => updateTicket("priority", e.target.value)}
              style={inputStyle}
            >
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          {/* Assigned To */}
          <div>
            <label style={labelStyle}>Assigned To</label>
            <select
              value={ticket.assignedTo || ""}
              onChange={(e) => updateTicket("assignedTo", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">Unassigned</option>
              {employees.map((emp) => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
            </select>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <select
              value={ticket.category || ""}
              onChange={(e) => updateTicket("category", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">Not specified</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {/* Link to CRM Contact */}
          <div>
            <label style={labelStyle}>CRM Contact</label>
            {ticket.contact ? (
              <div style={{
                padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)",
                border: `1px solid ${CARD_BORDER}`,
              }}>
                <Link href={`/crm/${ticket.contact.id}`} style={{ color: ROSE_GOLD, textDecoration: "none", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                  {ticket.contact.name}
                </Link>
                {ticket.contact.company && (
                  <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 2 }}>{ticket.contact.company}</div>
                )}
                <button
                  onClick={() => updateTicket("contactId", null)}
                  style={{
                    marginTop: 6, padding: "2px 8px", borderRadius: 4, fontSize: 9,
                    background: "rgba(248,113,113,0.1)", color: RED, border: "none",
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Unlink
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => searchContacts(e.target.value)}
                  placeholder="Search contacts..."
                  style={inputStyle}
                />
                {contactResults.length > 0 && (
                  <div style={{
                    marginTop: 4, background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
                    borderRadius: 8, overflow: "hidden",
                  }}>
                    {contactResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => linkContact(c.id)}
                        style={{
                          width: "100%", padding: "8px 10px", border: "none", background: "transparent",
                          color: TEXT_PRIMARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                          cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${CARD_BORDER}`,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {c.name}
                        {c.company && <span style={{ color: TEXT_TERTIARY, marginLeft: 4 }}>({c.company})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ticket Timeline */}
          <div>
            <label style={labelStyle}>Timeline</label>
            <div style={{
              padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)",
              border: `1px solid ${CARD_BORDER}`, display: "flex", flexDirection: "column", gap: 8,
            }}>
              <TimelineItem label="Created" date={ticket.createdAt} color={BLUE} />
              {ticket.firstResponseAt && (
                <TimelineItem label="First Response" date={ticket.firstResponseAt} color={ROSE_GOLD} />
              )}
              {ticket.resolvedAt && (
                <TimelineItem label="Resolved" date={ticket.resolvedAt} color={GREEN} />
              )}
              {ticket.firstResponseAt && (
                <div style={{ fontSize: 9, color: TEXT_TERTIARY, paddingLeft: 14 }}>
                  Response time: {fmtDuration(new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime())}
                </div>
              )}
              {ticket.resolvedAt && (
                <div style={{ fontSize: 9, color: TEXT_TERTIARY, paddingLeft: 14 }}>
                  Resolution time: {fmtDuration(new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime())}
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div style={{ fontSize: 10, color: TEXT_TERTIARY, display: "flex", flexDirection: "column", gap: 4, fontFamily: "'DM Sans', sans-serif" }}>
            <div>ID: <span style={{ color: TEXT_SECONDARY }}>{ticket.id.slice(0, 8)}...</span></div>
            <div>Created: <span style={{ color: TEXT_SECONDARY }}>{fmtDateTime(ticket.createdAt)}</span></div>
            <div>Updated: <span style={{ color: TEXT_SECONDARY }}>{fmtDateTime(ticket.updatedAt)}</span></div>
            <div>Channel: <span style={{ color: chDef?.color || TEXT_SECONDARY }}>{chDef?.label || ticket.channel}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineItem({ label, date, color }: { label: string; date: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 9, color: TEXT_TERTIARY, marginLeft: "auto" }}>{fmtDateTime(date)}</span>
    </div>
  )
}
