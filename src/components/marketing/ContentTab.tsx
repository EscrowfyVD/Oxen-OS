"use client"

import { useState, useMemo } from "react"
import { ShieldCheck } from "lucide-react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, AMBER, RED,
  IDEA_STATUSES, STATUS_COLORS, PLATFORM_COLORS, PRIORITIES,
} from "./constants"
import { CheckModal } from "./ComplianceCheckTab"
import type { ContentIdea } from "./types"

interface ContentTabProps {
  ideas: ContentIdea[]
  onEdit: (idea: ContentIdea) => void
  onAdd: () => void
  onStatusChange: (id: string, status: string) => void
  onRefresh?: () => void
}

export default function ContentTab({ ideas, onEdit, onAdd, onStatusChange, onRefresh }: ContentTabProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [showRejected, setShowRejected] = useState(false)
  const [checkingIdea, setCheckingIdea] = useState<ContentIdea | null>(null)

  const columns = IDEA_STATUSES.filter((s) => s.id !== "rejected")
  const rejectedIdeas = ideas.filter((i) => i.status === "rejected")

  const getColumnIdeas = (status: string) => ideas.filter((i) => i.status === status)

  const handleDragStart = (e: React.DragEvent, ideaId: string) => {
    e.dataTransfer.setData("text/plain", ideaId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverCol(colId)
  }

  const handleDragLeave = () => setDragOverCol(null)

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault()
    setDragOverCol(null)
    const ideaId = e.dataTransfer.getData("text/plain")
    if (ideaId) onStatusChange(ideaId, colId)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
          {ideas.length} content ideas
        </div>
        <button onClick={onAdd} className="btn-primary" style={{ padding: "7px 16px", fontSize: 11 }}>
          + New Idea
        </button>
      </div>

      {/* Kanban board */}
      <div style={{ display: "flex", gap: 12, minHeight: 500 }}>
        {columns.map((col) => {
          const colIdeas = getColumnIdeas(col.id)
          const isDragTarget = dragOverCol === col.id
          return (
            <div
              key={col.id}
              style={{
                flex: 1, minWidth: 0,
                background: isDragTarget ? "rgba(192,139,136,0.06)" : "transparent",
                border: isDragTarget ? "1px dashed rgba(192,139,136,0.3)" : "1px solid transparent",
                borderRadius: 8, padding: 8,
                transition: "all 0.2s ease",
              }}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>{col.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: col.color, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {col.label}
                </span>
                <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginLeft: "auto" }}>
                  {colIdeas.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {colIdeas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} onEdit={onEdit} onDragStart={handleDragStart} onCheckCompliance={setCheckingIdea} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Rejected section (collapsed) */}
      {rejectedIdeas.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowRejected(!showRejected)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span>{showRejected ? "\u25BC" : "\u25B6"}</span>
            <span>\u274C Rejected ({rejectedIdeas.length})</span>
          </button>
          {showRejected && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 8, opacity: 0.5 }}>
              {rejectedIdeas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onEdit={onEdit} onDragStart={handleDragStart} onCheckCompliance={setCheckingIdea} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compliance Check Modal from Content Idea */}
      {checkingIdea && (
        <CheckModal
          onClose={() => setCheckingIdea(null)}
          onSuccess={() => { setCheckingIdea(null); onRefresh?.() }}
          prefill={{
            platform: checkingIdea.platform || undefined,
            contentText: checkingIdea.description || "",
            contentIdeaId: checkingIdea.id,
          }}
        />
      )}
    </div>
  )
}

interface IdeaCardProps {
  idea: ContentIdea
  onEdit: (idea: ContentIdea) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onCheckCompliance: (idea: ContentIdea) => void
}

function IdeaCard({ idea, onEdit, onDragStart, onCheckCompliance }: IdeaCardProps) {
  const platformColor = idea.platform ? PLATFORM_COLORS[idea.platform] || TEXT_TERTIARY : null
  const priorityDef = PRIORITIES.find((p) => p.id === idea.priority)
  const latestCheck = idea.complianceChecks?.[0]

  const complianceBadge = latestCheck ? {
    approved: { emoji: "✅", color: "#34D399", bg: "rgba(52,211,153,0.12)" },
    needs_changes: { emoji: "⚠️", color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
    rejected: { emoji: "❌", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
    checking: { emoji: "🔄", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
    pending: { emoji: "⏳", color: "#9CA3AF", bg: "rgba(156,163,175,0.12)" },
  }[latestCheck.status] : null

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, idea.id)}
      onClick={() => onEdit(idea)}
      style={{
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
        padding: 12, cursor: "pointer", transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.15)" }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = CARD_BORDER }}
    >
      {/* Title */}
      <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 8, lineHeight: 1.3 }}>
        {idea.title}
      </div>

      {/* Badges row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {idea.platform && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
            background: `${platformColor}18`, color: platformColor || TEXT_TERTIARY,
            fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize",
          }}>
            {idea.platform === "twitter" ? "X" : idea.platform}
          </span>
        )}
        {idea.type && (
          <span style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 4,
            background: "rgba(255,255,255,0.04)", color: TEXT_TERTIARY,
            fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize",
          }}>
            {idea.type}
          </span>
        )}
        {/* Compliance badge */}
        {complianceBadge && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
            background: complianceBadge.bg, color: complianceBadge.color,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {complianceBadge.emoji} {latestCheck?.score !== null ? `${latestCheck?.score}` : ""}
          </span>
        )}
        {/* Priority dot */}
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: priorityDef?.color || TEXT_TERTIARY,
          marginLeft: "auto",
        }} title={idea.priority} />
      </div>

      {/* Tags */}
      {idea.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {idea.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{
              fontSize: 8, padding: "1px 5px", borderRadius: 3,
              background: "rgba(192,139,136,0.08)", color: ROSE_GOLD,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {idea.assignedTo && <span>{idea.assignedTo}</span>}
          {idea.scheduledFor && <span>{new Date(idea.scheduledFor).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
        </div>
        {idea.status === "draft" && !latestCheck && (
          <button
            onClick={(e) => { e.stopPropagation(); onCheckCompliance(idea) }}
            style={{
              background: "rgba(192,139,136,0.1)", border: "none", borderRadius: 4,
              padding: "2px 6px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
              fontSize: 9, color: ROSE_GOLD, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            }}
            title="Run compliance check"
          >
            <ShieldCheck size={10} /> Check
          </button>
        )}
      </div>
    </div>
  )
}
