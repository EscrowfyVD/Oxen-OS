"use client"

import { useState, useEffect } from "react"
import { CRM_COLORS } from "@/lib/crm-config"
import type { IntentFeedSignalView } from "./types"

const TEXT = CRM_COLORS.text_primary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const CARD_BORDER = CRM_COLORS.card_border

interface Employee {
  id: string
  name: string
}

interface CreateTaskFromSignalModalProps {
  signal: IntentFeedSignalView
  onClose: () => void
  onSuccess: (message: string) => void
}

// Pre-fill task title from the signal — name + signal type label is
// the most actionable form. Falls back gracefully if the signal has
// no contact attached (company-only signals).
function buildDefaultTitle(signal: IntentFeedSignalView): string {
  if (signal.contact) {
    return `Follow up ${signal.contact.name} — ${signal.signalTypeLabel}`
  }
  if (signal.company) {
    return `Follow up ${signal.company.name} — ${signal.signalTypeLabel}`
  }
  return `Follow up — ${signal.signalTypeLabel}`
}

function buildDefaultDescription(signal: IntentFeedSignalView): string {
  const lines: string[] = []
  lines.push(`Signal: ${signal.signalTypeLabel} (${signal.signalTypeCode})`)
  lines.push(`Source: ${signal.source} · ${signal.points} pt · ${new Date(signal.createdAt).toISOString().slice(0, 10)}`)
  if (signal.detail) lines.push(`Detail: ${signal.detail}`)
  if (signal.sourceUrl) lines.push(`URL: ${signal.sourceUrl}`)
  lines.push(`Signal ID: ${signal.id}`)
  return lines.join("\n")
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

const modalStyle: React.CSSProperties = {
  background: "var(--modal-bg)",
  border: `1px solid ${CARD_BORDER}`,
  borderTop: `2px solid ${ROSE}`,
  borderRadius: 16,
  padding: 24,
  width: 560,
  maxHeight: "88vh",
  overflowY: "auto",
  color: TEXT,
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-input)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8,
  padding: "8px 12px",
  color: TEXT,
  fontSize: 12,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: TEXT3,
  fontFamily: "'DM Sans', sans-serif",
  marginBottom: 4,
}

const TAG_OPTIONS = ["sales", "compliance", "tech", "legal", "finance", "onboarding"]
const PRIORITY_OPTIONS = ["low", "medium", "high"]

export default function CreateTaskFromSignalModal({
  signal,
  onClose,
  onSuccess,
}: CreateTaskFromSignalModalProps) {
  const [title, setTitle] = useState(buildDefaultTitle(signal))
  const [description, setDescription] = useState(buildDefaultDescription(signal))
  const [tag, setTag] = useState("sales")
  const [priority, setPriority] = useState("medium")
  const [deadline, setDeadline] = useState("")
  const [assignee, setAssignee] = useState("")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((data: { employees: Employee[] }) =>
        setEmployees(data.employees ?? []),
      )
      .catch(() => setEmployees([]))
  }, [])

  async function handleSubmit() {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          tag,
          priority,
          assignee: assignee || null,
          deadline: deadline || null,
          contactId: signal.contact?.id ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        onSuccess(`Failed to create task: ${data.error || "Unknown"}`)
        return
      }
      onSuccess("Task created")
    } catch {
      onSuccess("Network error creating task")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2
          style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 20,
            margin: "0 0 6px 0",
          }}
        >
          Create task from signal
        </h2>
        <p
          style={{
            fontSize: 11,
            color: TEXT3,
            marginTop: 0,
            marginBottom: 18,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Pre-filled from {signal.signalTypeLabel}
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Title</label>
          <input
            style={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Tag</label>
            <select
              style={inputStyle}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              {TAG_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select
              style={inputStyle}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          <div>
            <label style={labelStyle}>Assignee</label>
            <select
              style={inputStyle}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">(unassigned)</option>
              {employees.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input
              type="date"
              style={inputStyle}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 8,
              padding: "8px 16px",
              color: TEXT3,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            style={{
              background: ROSE,
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              color: "#1A1A1A",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: submitting || !title.trim() ? "default" : "pointer",
              opacity: submitting || !title.trim() ? 0.5 : 1,
            }}
          >
            {submitting ? "Creating…" : "Create task"}
          </button>
        </div>
      </div>
    </div>
  )
}
