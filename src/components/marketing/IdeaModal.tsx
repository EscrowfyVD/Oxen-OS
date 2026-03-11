"use client"

import { useState, useEffect } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, AMBER, RED,
  PLATFORMS, CONTENT_TYPES, PRIORITIES, CONTENT_TAGS, IDEA_STATUSES,
} from "./constants"
import type { ContentIdea, Employee } from "./types"

interface IdeaModalProps {
  idea: ContentIdea | null
  employees: Employee[]
  onClose: () => void
  onSave: () => void
}

interface IdeaForm {
  title: string
  description: string
  platform: string
  type: string
  priority: string
  assignedTo: string
  scheduledFor: string
  tags: string[]
  notes: string
}

const emptyForm: IdeaForm = {
  title: "", description: "", platform: "", type: "", priority: "medium",
  assignedTo: "", scheduledFor: "", tags: [], notes: "",
}

export default function IdeaModal({ idea, employees, onClose, onSave }: IdeaModalProps) {
  const [form, setForm] = useState<IdeaForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (idea) {
      setForm({
        title: idea.title,
        description: idea.description || "",
        platform: idea.platform || "",
        type: idea.type || "",
        priority: idea.priority,
        assignedTo: idea.assignedTo || "",
        scheduledFor: idea.scheduledFor ? idea.scheduledFor.split("T")[0] : "",
        tags: idea.tags || [],
        notes: idea.notes || "",
      })
    } else {
      setForm(emptyForm)
    }
  }, [idea])

  const set = (key: keyof IdeaForm, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const url = idea ? `/api/marketing/ideas/${idea.id}` : "/api/marketing/ideas"
      const method = idea ? "PATCH" : "POST"
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description || null,
          platform: form.platform || null,
          type: form.type || null,
          priority: form.priority,
          assignedTo: form.assignedTo || null,
          scheduledFor: form.scheduledFor || null,
          tags: form.tags,
          notes: form.notes || null,
        }),
      })
      onSave()
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!idea) return
    setSaving(true)
    try {
      await fetch(`/api/marketing/ideas/${idea.id}`, { method: "DELETE" })
      onSave()
    } catch { /* silent */ }
    setSaving(false)
  }

  const handlePublish = async () => {
    if (!idea) return
    setSaving(true)
    try {
      await fetch(`/api/marketing/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published", publishedAt: new Date().toISOString() }),
      })
      onSave()
    } catch { /* silent */ }
    setSaving(false)
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16,
          width: 560, maxHeight: "85vh", overflow: "auto",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: CARD_BG, zIndex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
            {idea ? "Edit Idea" : "New Content Idea"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", fontSize: 18 }}>{"\u2715"}</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <label style={lblSt}>Title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Content idea title..." style={inpSt} />
          </div>

          {/* Description */}
          <div>
            <label style={lblSt}>Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What should the post say?" rows={4} style={{ ...inpSt, resize: "vertical", minHeight: 80 }} />
          </div>

          {/* Platform + Type row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lblSt}>Platform</label>
              <select value={form.platform} onChange={(e) => set("platform", e.target.value)} style={inpSt}>
                <option value="">All / Not specified</option>
                {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lblSt}>Type</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} style={inpSt}>
                <option value="">Not specified</option>
                {CONTENT_TYPES.map((t) => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label style={lblSt}>Priority</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set("priority", p.id)}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 11, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                    border: `1px solid ${form.priority === p.id ? p.color : CARD_BORDER}`,
                    background: form.priority === p.id ? `${p.color}15` : "transparent",
                    color: form.priority === p.id ? p.color : TEXT_TERTIARY,
                    transition: "all 0.15s",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={lblSt}>Tags</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CONTENT_TAGS.map((tag) => {
                const active = form.tags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 10, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      border: `1px solid ${active ? ROSE_GOLD : CARD_BORDER}`,
                      background: active ? "rgba(192,139,136,0.1)" : "transparent",
                      color: active ? ROSE_GOLD : TEXT_TERTIARY,
                      transition: "all 0.15s",
                    }}
                  >
                    {tag.replace(/_/g, " ")}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Assignee + Schedule row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lblSt}>Assign To</label>
              <select value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} style={inpSt}>
                <option value="">Unassigned</option>
                {employees.map((emp) => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lblSt}>Schedule For</label>
              <input type="date" value={form.scheduledFor} onChange={(e) => set("scheduledFor", e.target.value)} style={inpSt} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={lblSt}>Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes..." rows={2} style={{ ...inpSt, resize: "vertical" }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {idea && (
              <button onClick={handleDelete} disabled={saving} style={{
                padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: "rgba(248,113,113,0.1)", color: "#F87171", fontSize: 11,
                fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
              }}>
                Delete
              </button>
            )}
            {idea && idea.status !== "published" && (
              <button onClick={handlePublish} disabled={saving} style={{
                padding: "8px 14px", borderRadius: 8, border: `1px solid ${GREEN}`,
                background: "rgba(52,211,153,0.08)", color: GREEN, fontSize: 11,
                fontFamily: "'DM Sans', sans-serif", fontWeight: 500, cursor: "pointer",
              }}>
                Mark as Published
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn-primary" style={{ padding: "8px 16px", fontSize: 11, opacity: !form.title.trim() ? 0.5 : 1 }}>
              {saving ? "Saving..." : idea ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const lblSt: React.CSSProperties = {
  display: "block", fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase",
  letterSpacing: 1, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
}
const inpSt: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
  background: "rgba(255,255,255,0.02)", color: TEXT_PRIMARY, fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}
