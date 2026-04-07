"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { OWNER_COLORS, CRM_COLORS } from "@/lib/crm-config"

/* ── Design Tokens ── */
const CARD_BG = CRM_COLORS.card_bg
const CARD_BORDER = CRM_COLORS.card_border
const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold

/* ── Kanban Column Definitions ── */
export interface KanbanColumn {
  id: string
  label: string
  color: string
  stages: string[] // lifecycleStage values that map to this column
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "no_status", label: "No Status", color: "#6B7280", stages: [] },
  { id: "lead", label: "Lead", color: "#3B82F6", stages: ["new_lead", "sequence_active"] },
  { id: "qualified", label: "Qualified", color: "#818CF8", stages: ["replied", "meeting_completed"] },
  { id: "follow_up", label: "Follow-up", color: "#FBBF24", stages: ["proposal_sent", "negotiation"] },
  { id: "meeting_booked", label: "Meeting Booked", color: "#A78BFA", stages: ["meeting_booked"] },
  { id: "closed_won", label: "Closed-won", color: "#34D399", stages: ["client"] },
  { id: "closed_lost", label: "Closed-lost", color: "#F87171", stages: ["closed_lost"] },
]

// Map from kanban column back to a lifecycleStage for PATCH
const COLUMN_TO_STAGE: Record<string, string> = {
  no_status: "new_lead",
  lead: "new_lead",
  qualified: "replied",
  follow_up: "proposal_sent",
  meeting_booked: "meeting_booked",
  closed_won: "closed_won",
  closed_lost: "closed_lost",
}

/* ── Acquisition source badge colors ── */
const SOURCE_COLORS: Record<string, { color: string; bg: string }> = {
  outbound: { color: "#34D399", bg: "rgba(52,211,153,0.12)" },
  conference: { color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  inbound: { color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
  referral: { color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
}

function getSourceStyle(source: string | null): { color: string; bg: string } | null {
  if (!source) return null
  const lower = source.toLowerCase()
  if (lower.includes("outbound") || lower.includes("clay")) return SOURCE_COLORS.outbound
  if (lower.includes("conference")) return SOURCE_COLORS.conference
  if (lower.includes("inbound") || lower.includes("website") || lower.includes("calendly")) return SOURCE_COLORS.inbound
  if (lower.includes("referral") || lower.includes("introducer") || lower.includes("partner")) return SOURCE_COLORS.referral
  return null
}

/* ── Avatar Color Generator ── */
function getAvatarColor(name: string): string {
  const colors = ["#C08B88", "#818CF8", "#34D399", "#FBBF24", "#F87171", "#22D3EE", "#A78BFA", "#60A5FA", "#F97316", "#EC4899"]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

/* ── Contact type for Kanban ── */
export interface KanbanContact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  company: { id: string; name: string; website?: string | null } | null
  lifecycleStage: string
  contactType: string
  geoZone: string | null
  dealOwner: string | null
  vertical: string[]
  outreachGroup: string | null
  acquisitionSource: string | null
  acquisitionSourceDetail: string | null
  jobTitle: string | null
  lastInteraction: string | null
  totalInteractions: number
  createdAt: string
}

interface KanbanBoardProps {
  contacts: KanbanContact[]
  loading: boolean
  onStageChange: (contactId: string, newStage: string) => Promise<void>
}

/* ── Assign contact to kanban column ── */
function getColumnForContact(c: KanbanContact): string {
  if (!c.lifecycleStage || c.lifecycleStage === "") return "no_status"
  // Check contactType for client → closed_won
  if (c.contactType === "client") return "closed_won"
  // Check explicit closed_lost
  if (c.lifecycleStage === "closed_lost") return "closed_lost"

  for (const col of KANBAN_COLUMNS) {
    if (col.stages.includes(c.lifecycleStage)) return col.id
  }
  // "new_lead" with no special condition → "lead"
  if (c.lifecycleStage === "new_lead") return "lead"
  return "no_status"
}

/* ════════════════════════════════════════════════════════════════
   KANBAN BOARD COMPONENT
   ════════════════════════════════════════════════════════════════ */
export default function KanbanBoard({ contacts, loading, onStageChange }: KanbanBoardProps) {
  const router = useRouter()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const dragCounter = useRef<Record<string, number>>({})

  // Group contacts into columns
  const columnContacts: Record<string, KanbanContact[]> = {}
  for (const col of KANBAN_COLUMNS) columnContacts[col.id] = []
  for (const c of contacts) {
    const colId = getColumnForContact(c)
    if (columnContacts[colId]) columnContacts[colId].push(c)
    else columnContacts["no_status"].push(c)
  }

  /* ── Drag handlers ── */
  const handleDragStart = useCallback((contactId: string) => {
    setDraggedId(contactId)
  }, [])

  const handleDragEnter = useCallback((colId: string) => {
    if (!dragCounter.current[colId]) dragCounter.current[colId] = 0
    dragCounter.current[colId]++
    setDragOverCol(colId)
  }, [])

  const handleDragLeave = useCallback((colId: string) => {
    if (!dragCounter.current[colId]) dragCounter.current[colId] = 0
    dragCounter.current[colId]--
    if (dragCounter.current[colId] <= 0) {
      dragCounter.current[colId] = 0
      setDragOverCol((prev) => (prev === colId ? null : prev))
    }
  }, [])

  const handleDrop = useCallback(async (colId: string) => {
    dragCounter.current = {}
    setDragOverCol(null)
    if (!draggedId) return
    const contact = contacts.find((c) => c.id === draggedId)
    if (!contact) return
    const currentCol = getColumnForContact(contact)
    if (currentCol === colId) { setDraggedId(null); return }
    const newStage = COLUMN_TO_STAGE[colId]
    if (newStage) {
      await onStageChange(draggedId, newStage)
    }
    setDraggedId(null)
  }, [draggedId, contacts, onStageChange])

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDragOverCol(null)
    dragCounter.current = {}
  }, [])

  if (loading && contacts.length === 0) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center", color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
        Loading contacts...
      </div>
    )
  }

  return (
    <div style={{ padding: "20px 24px", overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 14, minWidth: KANBAN_COLUMNS.length * 270 }}>
        {KANBAN_COLUMNS.map((col) => {
          const items = columnContacts[col.id]
          const isOver = dragOverCol === col.id
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => handleDragEnter(col.id)}
              onDragLeave={() => handleDragLeave(col.id)}
              onDrop={(e) => { e.preventDefault(); handleDrop(col.id) }}
              style={{
                flex: "1 1 0",
                minWidth: 250,
                maxWidth: 320,
                display: "flex",
                flexDirection: "column",
                borderRadius: 12,
                background: isOver ? "rgba(192,139,136,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isOver ? `${ROSE}40` : CARD_BORDER}`,
                transition: "background 0.2s, border-color 0.2s",
              }}
            >
              {/* Column Header */}
              <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{col.label}</span>
                  <span style={{ fontSize: 11, color: TEXT3, fontFamily: "'DM Sans', sans-serif", background: "rgba(255,255,255,0.06)", padding: "1px 7px", borderRadius: 10 }}>{items.length}</span>
                </div>
              </div>

              {/* Cards */}
              <div style={{ padding: "8px 8px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 8, minHeight: 100, overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}>
                {items.length === 0 ? (
                  <div style={{ padding: "20px 10px", textAlign: "center", fontSize: 11, color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>
                    No contacts
                  </div>
                ) : (
                  items.map((c) => {
                    const fullName = `${c.firstName} ${c.lastName}`.trim()
                    const avatarColor = getAvatarColor(fullName)
                    const initials = `${c.firstName?.[0] || ""}${c.lastName?.[0] || ""}`.toUpperCase()
                    const sourceStyle = getSourceStyle(c.acquisitionSource)
                    const ownerColor = OWNER_COLORS[c.dealOwner || ""] || "#9CA3AF"
                    const isDragging = draggedId === c.id

                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => handleDragStart(c.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => router.push(`/crm/contacts/${c.id}`)}
                        style={{
                          background: CARD_BG,
                          border: `1px solid ${CARD_BORDER}`,
                          borderRadius: 10,
                          padding: "12px 14px",
                          cursor: "grab",
                          opacity: isDragging ? 0.4 : 1,
                          transition: "opacity 0.15s, box-shadow 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 2px 12px rgba(0,0,0,0.3)`; e.currentTarget.style.borderColor = `${ROSE}30` }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = CARD_BORDER }}
                      >
                        {/* Avatar + Name */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName}</div>
                          </div>
                        </div>

                        {/* Company */}
                        {c.company?.name && (
                          <div
                            onClick={(e) => { e.stopPropagation(); router.push(`/crm/companies/${c.company!.id}`) }}
                            style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, cursor: "pointer" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={TEXT3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M9 8h1"/><path d="M9 12h1"/><path d="M9 16h1"/><path d="M14 8h1"/><path d="M14 12h1"/><path d="M14 16h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>
                            <span style={{ fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.company.name}</span>
                          </div>
                        )}

                        {/* Job Title */}
                        {c.jobTitle && (
                          <div style={{ fontSize: 11, color: TEXT3, fontFamily: "'DM Sans', sans-serif", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.jobTitle}</div>
                        )}

                        {/* Badges row */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                          {/* Acquisition source */}
                          {sourceStyle && c.acquisitionSource && (
                            <span style={{ display: "inline-block", padding: "2px 7px", fontSize: 10, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", borderRadius: 12, background: sourceStyle.bg, color: sourceStyle.color, whiteSpace: "nowrap" }}>
                              {c.acquisitionSource.split("/")[0].trim()}
                            </span>
                          )}

                          {/* Acquisition detail tag */}
                          {c.acquisitionSourceDetail && (
                            <span style={{ display: "inline-block", padding: "2px 7px", fontSize: 10, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", borderRadius: 12, background: "rgba(192,139,136,0.12)", color: ROSE, whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {c.acquisitionSourceDetail}
                            </span>
                          )}

                          {/* Deal owner */}
                          {c.dealOwner && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", fontSize: 10, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", borderRadius: 12, background: `${ownerColor}18`, color: ownerColor, whiteSpace: "nowrap" }}>
                              <span style={{ width: 12, height: 12, borderRadius: "50%", background: ownerColor, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: "#fff" }}>
                                {c.dealOwner.charAt(0)}
                              </span>
                              {c.dealOwner}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
