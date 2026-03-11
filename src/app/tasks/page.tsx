"use client"

import { useState, useEffect, useCallback } from "react"

/* ── Design tokens ── */
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"
const INDIGO = "#818CF8"
const RED = "#F87171"
const FROST = "#FFFFFF"

/* ── Tag color palette ── */
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  compliance: { bg: "rgba(251,191,36,0.12)", text: "#FBBF24" },
  onboarding: { bg: "rgba(52,211,153,0.12)", text: "#34D399" },
  tech: { bg: "rgba(129,140,248,0.12)", text: "#818CF8" },
  sales: { bg: "rgba(192,139,136,0.12)", text: "#C08B88" },
}

const PRIORITY_COLORS: Record<string, string> = {
  high: RED,
  medium: AMBER,
  low: TEXT_TERTIARY,
}

/* ── Column definitions ── */
const COLUMNS = [
  { id: "todo", label: "To Do", accent: RED },
  { id: "inprogress", label: "In Progress", accent: AMBER },
  { id: "done", label: "Done", accent: GREEN },
]

const FILTER_TAGS = ["all", "compliance", "onboarding", "tech", "sales"]

/* ── Types ── */
interface Task {
  id: string
  title: string
  tag: string
  priority: string
  assignee: string | null
  deadline: string | null
  column: string
  order?: number
}

/* ── TaskCard (inline component) ── */
function TaskCard({ task }: { task: Task }) {
  const tagStyle = TAG_COLORS[task.tag] || { bg: "rgba(255,255,255,0.06)", text: TEXT_SECONDARY }
  const priorityColor = PRIORITY_COLORS[task.priority] || TEXT_TERTIARY

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", task.id)
    e.dataTransfer.effectAllowed = "move"
  }

  const formatDeadline = (iso: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        padding: "12px 14px",
        cursor: "grab",
        transition: "all 0.2s ease",
        marginBottom: 8,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = "rgba(192,139,136,0.2)"
        el.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = CARD_BORDER
        el.style.transform = "translateY(0)"
      }}
    >
      {/* Title row with priority dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: priorityColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 12,
            color: TEXT_PRIMARY,
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.4,
          }}
        >
          {task.title}
        </span>
      </div>

      {/* Tag pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 10,
            background: tagStyle.bg,
            color: tagStyle.text,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {task.tag}
        </span>
      </div>

      {/* Assignee + deadline */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {task.assignee && (
          <span
            style={{
              fontSize: 10,
              color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {task.assignee}
          </span>
        )}
        {task.deadline && (
          <span
            style={{
              fontSize: 10,
              color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
              fontVariantNumeric: "tabular-nums",
              marginLeft: "auto",
            }}
          >
            {formatDeadline(task.deadline)}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Main Tasks Page ── */
export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeFilter, setActiveFilter] = useState("all")
  const [showModal, setShowModal] = useState(false)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  /* Form state */
  const [formTitle, setFormTitle] = useState("")
  const [formTag, setFormTag] = useState("compliance")
  const [formPriority, setFormPriority] = useState("medium")
  const [formAssignee, setFormAssignee] = useState("")
  const [formDeadline, setFormDeadline] = useState("")

  /* ── Fetch tasks ── */
  const fetchTasks = useCallback(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  /* ── Filtered tasks ── */
  const filtered =
    activeFilter === "all" ? tasks : tasks.filter((t) => t.tag === activeFilter)

  const getColumnTasks = (colId: string) => filtered.filter((t) => t.column === colId)

  /* ── Drag & drop handlers ── */
  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverCol(colId)
  }

  const handleDragLeave = () => {
    setDragOverCol(null)
  }

  const handleDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault()
    setDragOverCol(null)
    const taskId = e.dataTransfer.getData("text/plain")
    if (!taskId) return

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column: colId }),
      })
      fetchTasks()
    } catch {
      /* silent */
    }
  }

  /* ── Create task ── */
  const handleCreateTask = async () => {
    if (!formTitle.trim()) return

    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          tag: formTag,
          priority: formPriority,
          assignee: formAssignee.trim() || null,
          deadline: formDeadline || null,
          column: "todo",
        }),
      })
      setFormTitle("")
      setFormTag("compliance")
      setFormPriority("medium")
      setFormAssignee("")
      setFormDeadline("")
      setShowModal(false)
      fetchTasks()
    } catch {
      /* silent */
    }
  }

  /* ── Column stats ── */
  const getHighPriorityCount = (colId: string) =>
    tasks.filter((t) => t.column === colId && t.priority === "high").length

  return (
    <div className="page-content" style={{ padding: 0 }}>
      {/* ── Header ── */}
      <div
        className="sticky-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          background: "rgba(6,7,9,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${CARD_BORDER}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 28,
              fontWeight: 400,
              color: FROST,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Tasks
          </h1>
          <p
            style={{
              fontSize: 12,
              color: TEXT_TERTIARY,
              marginTop: 4,
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.4,
            }}
          >
            Kanban board &mdash; drag cards to update status
          </p>
        </div>
        <button className="header-btn" onClick={() => setShowModal(true)}>
          New Task
        </button>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding: "28px 32px" }}>
        {/* ── Filter row ── */}
        <div
          className="fade-in"
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            animationDelay: "0.05s",
          }}
        >
          {FILTER_TAGS.map((tag) => (
            <button
              key={tag}
              className={`filter-btn${activeFilter === tag ? " active" : ""}`}
              onClick={() => setActiveFilter(tag)}
            >
              {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Kanban Board ── */}
        <div
          className="card fade-in"
          style={{
            padding: 16,
            marginBottom: 20,
            animationDelay: "0.1s",
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            {COLUMNS.map((col) => {
              const colTasks = getColumnTasks(col.id)
              const isDragTarget = dragOverCol === col.id

              return (
                <div
                  key={col.id}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: isDragTarget
                      ? "rgba(192,139,136,0.04)"
                      : "transparent",
                    borderRadius: 8,
                    padding: 8,
                    transition: "background 0.2s ease",
                  }}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  {/* Column header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 12,
                      paddingBottom: 8,
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: col.accent,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: TEXT_SECONDARY,
                        textTransform: "uppercase",
                        letterSpacing: 1.5,
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      {col.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: TEXT_TERTIARY,
                        fontFamily: "'DM Sans', sans-serif",
                        marginLeft: "auto",
                      }}
                    >
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Column body */}
                  <div style={{ minHeight: 100 }}>
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                    {colTasks.length === 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: TEXT_TERTIARY,
                          textAlign: "center",
                          padding: "32px 0",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Drop tasks here
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Column Stats ── */}
        <div
          className="fade-in"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            animationDelay: "0.15s",
          }}
        >
          {COLUMNS.map((col) => {
            const count = tasks.filter((t) => t.column === col.id).length
            const highCount = getHighPriorityCount(col.id)

            return (
              <div
                key={col.id}
                className="card"
                style={{ padding: "16px 20px", overflow: "hidden" }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: TEXT_TERTIARY,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  {col.label}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "'Bellfair', serif",
                      fontSize: 24,
                      fontWeight: 400,
                      color: FROST,
                      lineHeight: 1,
                    }}
                  >
                    {count}
                  </span>
                  {highCount > 0 && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "rgba(248,113,113,0.12)",
                        color: RED,
                        fontWeight: 500,
                        fontFamily: "'DM Sans', sans-serif",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {highCount} high
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── New Task Modal ── */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div
            className="animate-slideUp"
            style={{
              width: 420,
              background: "#0F1118",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <span
                style={{
                  fontFamily: "'Bellfair', serif",
                  fontSize: 18,
                  color: FROST,
                }}
              >
                New Task
              </span>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: TEXT_TERTIARY,
                  fontSize: 18,
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Title */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: TEXT_TERTIARY,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 6,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                  }}
                >
                  Title
                </label>
                <input
                  className="oxen-input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Enter task title..."
                  autoFocus
                />
              </div>

              {/* Tag + Priority row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      color: TEXT_TERTIARY,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 6,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                    }}
                  >
                    Tag
                  </label>
                  <select
                    className="oxen-input"
                    value={formTag}
                    onChange={(e) => setFormTag(e.target.value)}
                    style={{ appearance: "none" }}
                  >
                    <option value="compliance">Compliance</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="tech">Tech</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10,
                      color: TEXT_TERTIARY,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 6,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                    }}
                  >
                    Priority
                  </label>
                  <select
                    className="oxen-input"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    style={{ appearance: "none" }}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: TEXT_TERTIARY,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 6,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                  }}
                >
                  Assignee
                </label>
                <input
                  className="oxen-input"
                  value={formAssignee}
                  onChange={(e) => setFormAssignee(e.target.value)}
                  placeholder="e.g. Arthur"
                />
              </div>

              {/* Deadline */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: TEXT_TERTIARY,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 6,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                  }}
                >
                  Deadline
                </label>
                <input
                  className="oxen-input"
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "0 20px 20px",
              }}
            >
              <button
                className="btn-secondary"
                onClick={() => setShowModal(false)}
                style={{ padding: "8px 18px" }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateTask}
                disabled={!formTitle.trim()}
                style={{ padding: "8px 18px" }}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
