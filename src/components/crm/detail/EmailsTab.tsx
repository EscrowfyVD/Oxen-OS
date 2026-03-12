"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, CYAN, AMBER, ROSE_GOLD, labelStyle,
} from "@/components/crm/constants"

interface Email {
  id: string
  threadId: string
  subject: string
  snippet: string
  from: string
  to: string
  date: string
  direction: "inbound" | "outbound"
  bodyText: string
}

interface EmailsTabProps {
  contactId: string
  contactEmail: string | null
}

const relativeDate = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export default function EmailsTab({ contactId, contactEmail }: EmailsTabProps) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; matched: number } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchEmails = useCallback(() => {
    setLoading(true)
    fetch(`/api/contacts/${contactId}/emails`)
      .then((r) => r.json())
      .then((data) => {
        setEmails(data.emails ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [contactId])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const r = await fetch("/api/email/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await r.json()
      setSyncResult({
        synced: data.synced ?? 0,
        matched: data.matched ?? 0,
      })
      fetchEmails()
    } catch { /* silent */ }
    setSyncing(false)
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
      }}>
        <div>
          <span style={{
            fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST,
          }}>
            Email History
          </span>
          {contactEmail && (
            <span style={{
              fontSize: 10, color: TEXT_TERTIARY, marginLeft: 10,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {contactEmail}
            </span>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            cursor: syncing ? "wait" : "pointer",
            background: syncing
              ? "rgba(251,191,36,0.08)"
              : "linear-gradient(135deg, rgba(192,139,136,0.15), rgba(192,139,136,0.08))",
            border: `1px solid ${syncing ? "rgba(251,191,36,0.2)" : "rgba(192,139,136,0.25)"}`,
            color: syncing ? AMBER : ROSE_GOLD,
          }}
        >
          {syncing ? "Syncing..." : "Sync Emails"}
        </button>
      </div>

      {/* ── Sync Status Bar ── */}
      {syncResult && (
        <div style={{
          padding: "8px 16px",
          background: "rgba(52,211,153,0.06)",
          border: `1px solid rgba(52,211,153,0.15)`,
          borderRadius: 8,
          fontSize: 11,
          color: GREEN,
          fontFamily: "'DM Sans', sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{ fontSize: 13 }}>{"\u2705"}</span>
          Synced {syncResult.synced} emails, {syncResult.matched} matched to contacts
        </div>
      )}

      {/* ── Email List ── */}
      <div style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {loading && (
          <div className="ai-shimmer" style={{ height: 120, margin: 16, borderRadius: 8 }} />
        )}

        {!loading && emails.length === 0 && (
          <div style={{
            padding: "40px 20px",
            textAlign: "center",
            color: TEXT_TERTIARY,
            fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            No emails synced yet. Click Sync Emails to import from Gmail.
          </div>
        )}

        {!loading && emails.map((email, i) => {
          const isExpanded = expandedId === email.id
          const dirColor = email.direction === "inbound" ? CYAN : GREEN
          const dirArrow = email.direction === "inbound" ? "\u2193" : "\u2191"

          return (
            <div key={email.id}>
              {/* Email Row */}
              <div
                onClick={() => toggleExpand(email.id)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  borderBottom: i < emails.length - 1 || isExpanded
                    ? `1px solid ${CARD_BORDER}`
                    : "none",
                  transition: "background 0.15s",
                  background: isExpanded ? "rgba(255,255,255,0.02)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.015)"
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded) e.currentTarget.style.background = "transparent"
                }}
              >
                {/* Direction Arrow */}
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: `${dirColor}12`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: dirColor,
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  {dirArrow}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Subject */}
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                    fontFamily: "'DM Sans', sans-serif",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: 3,
                  }}>
                    {email.subject || "(No Subject)"}
                  </div>

                  {/* Snippet */}
                  <div style={{
                    fontSize: 11,
                    color: TEXT_TERTIARY,
                    fontFamily: "'DM Sans', sans-serif",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: 4,
                  }}>
                    {email.snippet}
                  </div>

                  {/* From / To */}
                  <div style={{
                    fontSize: 10,
                    color: TEXT_TERTIARY,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {email.direction === "inbound" ? "From" : "To"}: {email.direction === "inbound" ? email.from : email.to}
                  </div>
                </div>

                {/* Date */}
                <div style={{
                  fontSize: 9,
                  color: TEXT_TERTIARY,
                  fontFamily: "'DM Sans', sans-serif",
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  {relativeDate(email.date)}
                </div>
              </div>

              {/* Expanded Body */}
              {isExpanded && (
                <div style={{
                  padding: "12px 16px 16px 50px",
                  background: "rgba(255,255,255,0.02)",
                  borderBottom: i < emails.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                }}>
                  <div style={{
                    display: "flex", gap: 12, marginBottom: 10,
                    fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif",
                  }}>
                    <span>From: <span style={{ color: TEXT_SECONDARY }}>{email.from}</span></span>
                    <span>To: <span style={{ color: TEXT_SECONDARY }}>{email.to}</span></span>
                    <span>{new Date(email.date).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}</span>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: TEXT_SECONDARY,
                    fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    maxHeight: 300,
                    overflowY: "auto",
                    padding: "8px 0",
                  }}>
                    {email.bodyText}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
