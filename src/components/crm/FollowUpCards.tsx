"use client"

import { useEffect, useState, useCallback } from "react"

// ─── Types ──────────────────────────────────────────────

interface FollowUpContact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  company: { name: string } | null
}

interface FollowUpDeal {
  id: string
  dealName: string
  stage: string
  dealValue: number | null
  dealOwner: string | null
}

interface FollowUp {
  id: string
  contactId: string
  dealId: string | null
  reason: string
  suggestedAction: string
  draftMessage: string | null
  status: string
  assignee: string
  createdAt: string
  contact: FollowUpContact
  deal: FollowUpDeal | null
}

interface DraftContent {
  subject: string
  body: string
}

// ─── Design tokens ──────────────────────────────────────

const CARD_BG = "var(--card-bg)"
const CARD_BORDER = "var(--card-border)"
const TEXT = "var(--text-primary)"
const TEXT_SEC = "var(--text-secondary)"
const ROSE = "#C08B88"
const AMBER = "#FBBF24"
const GREEN = "#34D399"

const STAGE_LABELS: Record<string, string> = {
  replied: "Replied",
  meeting_booked: "Meeting Booked",
  meeting_completed: "Meeting Completed",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
}

const REASON_LABELS: Record<string, string> = {
  no_response_5_days: "No response for 5+ days",
  meeting_no_followup: "Meeting with no follow-up sent",
  proposal_no_response: "Proposal sent, no response for 5+ days",
  conversation_stalled: "No activity for 7+ days",
}

// ─── Helper ─────────────────────────────────────────────

function parseDraft(raw: string | null): DraftContent {
  if (!raw) return { subject: "", body: "" }
  try {
    const parsed = JSON.parse(raw)
    return { subject: parsed.subject || "", body: parsed.body || "" }
  } catch {
    return { subject: "", body: raw }
  }
}

// ─── Component ──────────────────────────────────────────

export default function FollowUpCards({ assignee }: { assignee?: string }) {
  const [followups, setFollowups] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({})

  const fetchFollowups = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: "pending" })
      if (assignee) params.set("assignee", assignee)
      const res = await fetch(`/api/crm/ai/followups?${params}`)
      if (res.ok) {
        const data = await res.json()
        setFollowups(data.followups || [])
      }
    } catch (err) {
      console.error("Failed to fetch follow-ups:", err)
    } finally {
      setLoading(false)
    }
  }, [assignee])

  useEffect(() => {
    fetchFollowups()
  }, [fetchFollowups])

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/crm/ai/followups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setFollowups((prev) => prev.filter((f) => f.id !== id))
      }
    } catch (err) {
      console.error("Failed to update follow-up:", err)
    }
  }

  const handleSend = (followup: FollowUp) => {
    const draft = parseDraft(followup.draftMessage)
    const email = followup.contact.email || ""
    const subject = encodeURIComponent(draft.subject)
    const body = encodeURIComponent(draft.body)
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank")
    updateStatus(followup.id, "sent")
  }

  const handleEdit = (followup: FollowUp) => {
    if (editingId === followup.id) {
      setEditingId(null)
    } else {
      const draft = parseDraft(followup.draftMessage)
      setEditDrafts((prev) => ({ ...prev, [followup.id]: draft.body }))
      setEditingId(followup.id)
    }
  }

  // ─── Styles ─────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  }

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "4px",
  }

  const headerTitleStyle: React.CSSProperties = {
    fontSize: "16px",
    fontWeight: 600,
    color: TEXT,
    margin: 0,
  }

  const badgeStyle: React.CSSProperties = {
    background: ROSE,
    color: "#fff",
    borderRadius: "10px",
    padding: "2px 8px",
    fontSize: "12px",
    fontWeight: 600,
  }

  const cardStyle: React.CSSProperties = {
    background: CARD_BG,
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: "12px",
    padding: "16px",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--surface-hover)",
  }

  const stageBadgeStyle: React.CSSProperties = {
    display: "inline-block",
    background: "rgba(192,139,136,0.15)",
    color: ROSE,
    borderRadius: "6px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 500,
    marginLeft: "8px",
  }

  const reasonStyle: React.CSSProperties = {
    color: AMBER,
    fontSize: "13px",
    fontWeight: 500,
    margin: "8px 0 4px",
  }

  const previewStyle: React.CSSProperties = {
    color: TEXT_SEC,
    fontSize: "13px",
    lineHeight: 1.5,
    margin: "8px 0 12px",
    cursor: "pointer",
  }

  const btnRowStyle: React.CSSProperties = {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  }

  const btnBase: React.CSSProperties = {
    padding: "6px 14px",
    borderRadius: "8px",
    border: "1px solid var(--card-border)",
    background: "var(--surface-input)",
    color: TEXT,
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s",
  }

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "100px",
    background: "var(--surface-elevated)",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: "8px",
    color: TEXT,
    fontSize: "13px",
    lineHeight: 1.5,
    padding: "10px",
    resize: "vertical",
    fontFamily: "inherit",
    marginBottom: "12px",
  }

  const emptyStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "40px 20px",
    color: TEXT_SEC,
    fontSize: "14px",
  }

  // ─── Render ─────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...containerStyle }}>
        <div style={headerStyle}>
          <h3 style={headerTitleStyle}>{"\u{1F916}"} AI Follow-up Suggestions</h3>
        </div>
        <div style={{ color: TEXT_SEC, fontSize: "13px", padding: "20px 0" }}>
          Loading suggestions...
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={headerTitleStyle}>{"\u{1F916}"} AI Follow-up Suggestions</h3>
        {followups.length > 0 && (
          <span style={badgeStyle}>{followups.length}</span>
        )}
      </div>

      {followups.length === 0 ? (
        <div style={{ ...cardStyle, ...emptyStyle }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>{"\u2705"}</div>
          <div>All caught up! No follow-ups needed.</div>
        </div>
      ) : (
        followups.map((fu) => {
          const draft = parseDraft(fu.draftMessage)
          const isExpanded = expandedId === fu.id
          const isEditing = editingId === fu.id
          const companyName =
            fu.deal?.dealName
              ? fu.deal.dealName
              : fu.contact.company?.name || "Unknown"
          const contactName = `${fu.contact.firstName} ${fu.contact.lastName}`
          const preview = isExpanded
            ? draft.body
            : draft.body.slice(0, 100) + (draft.body.length > 100 ? "..." : "")

          return (
            <div key={fu.id} style={cardStyle}>
              {/* Contact + Stage */}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ color: TEXT, fontSize: "14px", fontWeight: 600 }}>
                  {contactName}
                </span>
                <span style={{ color: TEXT_SEC, fontSize: "13px", marginLeft: "6px" }}>
                  at {fu.contact.company?.name || "Unknown"}
                </span>
                {fu.deal && (
                  <span style={stageBadgeStyle}>
                    {STAGE_LABELS[fu.deal.stage] || fu.deal.stage}
                  </span>
                )}
              </div>

              {/* Reason */}
              <div style={reasonStyle}>
                {REASON_LABELS[fu.reason] || fu.reason.replace(/_/g, " ")}
              </div>

              {/* Draft preview or editor */}
              {isEditing ? (
                <textarea
                  style={textareaStyle}
                  value={editDrafts[fu.id] || ""}
                  onChange={(e) =>
                    setEditDrafts((prev) => ({
                      ...prev,
                      [fu.id]: e.target.value,
                    }))
                  }
                />
              ) : (
                <div
                  style={previewStyle}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : fu.id)
                  }
                  title="Click to expand/collapse"
                >
                  {draft.subject && (
                    <div style={{ fontWeight: 500, color: TEXT, marginBottom: "4px" }}>
                      {draft.subject}
                    </div>
                  )}
                  {preview}
                </div>
              )}

              {/* Action buttons */}
              <div style={btnRowStyle}>
                <button
                  style={{ ...btnBase, borderColor: "rgba(52,211,153,0.3)", color: GREEN }}
                  onClick={() => handleSend(fu)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(52,211,153,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--surface-input)")
                  }
                >
                  {"\u2709\uFE0F"} Send
                </button>
                <button
                  style={{
                    ...btnBase,
                    borderColor: isEditing
                      ? "rgba(251,191,36,0.3)"
                      : "rgba(255,255,255,0.1)",
                    color: isEditing ? AMBER : TEXT,
                  }}
                  onClick={() => handleEdit(fu)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(251,191,36,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--surface-input)")
                  }
                >
                  {"\u270F\uFE0F"} {isEditing ? "Done" : "Edit"}
                </button>
                <button
                  style={{
                    ...btnBase,
                    borderColor: "rgba(248,113,113,0.3)",
                    color: "#F87171",
                  }}
                  onClick={() => updateStatus(fu.id, "dismissed")}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(248,113,113,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--surface-input)")
                  }
                >
                  {"\u{1F507}"} Dismiss
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
