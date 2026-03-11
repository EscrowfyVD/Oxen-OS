"use client"

import { useState, useEffect, useCallback } from "react"

/* ── Design tokens ── */
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"
const INDIGO = "#818CF8"
const RED = "#F87171"
const PURPLE = "#A78BFA"
const YELLOW = "#FDE68A"
const FROST = "#FFFFFF"

/* ── Tag color palette (6 tags) ── */
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  compliance: { bg: "rgba(251,191,36,0.12)", text: AMBER },
  onboarding: { bg: "rgba(52,211,153,0.12)", text: GREEN },
  tech:       { bg: "rgba(129,140,248,0.12)", text: INDIGO },
  sales:      { bg: "rgba(192,139,136,0.12)", text: ROSE_GOLD },
  legal:      { bg: "rgba(167,139,250,0.12)", text: PURPLE },
  finance:    { bg: "rgba(253,230,138,0.12)", text: YELLOW },
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

const FILTER_TAGS = ["all", "compliance", "onboarding", "tech", "sales", "legal", "finance"]

/* ── Types ── */
interface Task {
  id: string
  title: string
  description: string | null
  tag: string
  priority: string
  assignee: string | null
  deadline: string | null
  column: string
  order?: number
}

interface Employee {
  id: string
  name: string
  initials: string
  role: string
}

interface TaskFormData {
  title: string
  description: string
  tag: string
  priority: string
  assignee: string
  deadline: string
}

/* ── Shared label style ── */
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 6,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
}

/* ── TaskCard (inline component) ── */
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
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
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        padding: "12px 14px",
        cursor: "grab",
        transition: "all 0.2s ease",
        marginBottom: 8,
        position: "relative",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = "rgba(192,139,136,0.2)"
        el.style.transform = "translateY(-1px)"
        el.style.cursor = "pointer"
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = CARD_BORDER
        el.style.transform = "translateY(0)"
      }}
    >
      {/* Priority dot — top right */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: priorityColor,
        }}
      />

      {/* Title */}
      <div
        style={{
          fontSize: 12,
          color: TEXT_PRIMARY,
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.4,
          marginBottom: 6,
          paddingRight: 16,
        }}
      >
        {task.title}
      </div>

      {/* Description preview */}
      {task.description && (
        <div
          style={{
            fontSize: 10,
            color: TEXT_TERTIARY,
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.4,
            marginBottom: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.description}
        </div>
      )}

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
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeFilter, setActiveFilter] = useState("all")
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  /* Form state */
  const [form, setForm] = useState<TaskFormData>({
    title: "",
    description: "",
    tag: "compliance",
    priority: "medium",
    assignee: "",
    deadline: "",
  })

  /* ── Fetch tasks ── */
  const fetchTasks = useCallback(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks ?? []))
      .catch(() => {})
  }, [])

  /* ── Fetch employees for assignee dropdown ── */
  const fetchEmployees = useCallback(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchEmployees()
  }, [fetchTasks, fetchEmployees])

  /* ── Filtered tasks ── */
  const filtered =
    activeFilter === "all" ? tasks : tasks.filter((t) => t.tag === activeFilter)

  const getColumnTasks = (colId: string) => filtered.filter((t) => t.column === colId)

  /* ── Reset form ── */
  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      tag: "compliance",
      priority: "medium",
      assignee: "",
      deadline: "",
    })
    setEditingTask(null)
  }

  /* ── Open create modal ── */
  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  /* ── Open edit modal (click on card) ── */
  const openEdit = (task: Task) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || "",
      tag: task.tag,
      priority: task.priority,
      assignee: task.assignee || "",
      deadline: task.deadline ? task.deadline.split("T")[0] : "",
    })
    setShowModal(true)
  }

  /* ── Close modal ── */
  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

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
    if (!form.title.trim()) return

    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          tag: form.tag,
          priority: form.priority,
          assignee: form.assignee || null,
          deadline: form.deadline || null,
          column: "todo",
        }),
      })
      closeModal()
      fetchTasks()
    } catch {
      /* silent */
    }
  }

  /* ── Update task ── */
  const handleUpdateTask = async () => {
    if (!editingTask || !form.title.trim()) return

    try {
      await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          tag: form.tag,
          priority: form.priority,
          assignee: form.assignee || null,
          deadline: form.deadline || null,
        }),
      })
      closeModal()
      fetchTasks()
    } catch {
      /* silent */
    }
  }

  /* ── Delete task ── */
  const handleDeleteTask = async () => {
    if (!editingTask) return

    try {
      await fetch(`/api/tasks/${editingTask.id}`, { method: "DELETE" })
      closeModal()
      fetchTasks()
    } catch {
      /* silent */
    }
  }

  /* ── Move task to column (from modal) ── */
  const handleMoveTask = async (newColumn: string) => {
    if (!editingTask) return

    try {
      await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column: newColumn }),
      })
      setEditingTask({ ...editingTask, column: newColumn })
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
            Kanban board &mdash; drag cards to update status, click to edit
          </p>
        </div>
        <button className="header-btn" onClick={openCreate}>
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
            flexWrap: "wrap",
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
                      ? "rgba(192,139,136,0.06)"
                      : "transparent",
                    border: isDragTarget
                      ? "1px dashed rgba(192,139,136,0.3)"
                      : "1px solid transparent",
                    borderRadius: 8,
                    padding: 8,
                    transition: "all 0.2s ease",
                    boxShadow: isDragTarget
                      ? "inset 0 0 20px rgba(192,139,136,0.05)"
                      : "none",
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
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => openEdit(task)}
                      />
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
                      fontSize: 28,
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

      {/* ── Create / Edit Task Modal ── */}
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
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div
            className="animate-slideUp"
            style={{
              width: 480,
              maxHeight: "85vh",
              overflowY: "auto",
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12,
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
                position: "sticky",
                top: 0,
                background: CARD_BG,
                zIndex: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "'Bellfair', serif",
                  fontSize: 18,
                  color: FROST,
                }}
              >
                {editingTask ? "Edit Task" : "New Task"}
              </span>
              <button
                onClick={closeModal}
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
                <label style={labelStyle}>Title</label>
                <input
                  className="oxen-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Enter task title..."
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  className="oxen-input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Add details, notes, links..."
                  rows={3}
                  style={{
                    resize: "vertical",
                    minHeight: 60,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                />
              </div>

              {/* Tag + Priority row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Tag</label>
                  <select
                    className="oxen-input"
                    value={form.tag}
                    onChange={(e) => setForm({ ...form, tag: e.target.value })}
                    style={{ appearance: "none" }}
                  >
                    <option value="compliance">Compliance</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="tech">Tech</option>
                    <option value="sales">Sales</option>
                    <option value="legal">Legal</option>
                    <option value="finance">Finance</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select
                    className="oxen-input"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    style={{ appearance: "none" }}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Assignee (dropdown from Employee table) */}
              <div>
                <label style={labelStyle}>Assignee</label>
                <select
                  className="oxen-input"
                  value={form.assignee}
                  onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                  style={{ appearance: "none" }}
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} — {emp.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Deadline */}
              <div>
                <label style={labelStyle}>Deadline</label>
                <input
                  className="oxen-input"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  style={{ colorScheme: "dark" }}
                />
              </div>

              {/* Status buttons (only when editing) */}
              {editingTask && (
                <div>
                  <label style={labelStyle}>Status</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {COLUMNS.map((col) => (
                      <button
                        key={col.id}
                        onClick={() => handleMoveTask(col.id)}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          fontSize: 11,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                          letterSpacing: 0.5,
                          border: `1px solid ${
                            editingTask.column === col.id
                              ? col.accent
                              : "rgba(255,255,255,0.06)"
                          }`,
                          borderRadius: 6,
                          background:
                            editingTask.column === col.id
                              ? `${col.accent}18`
                              : "transparent",
                          color:
                            editingTask.column === col.id
                              ? col.accent
                              : TEXT_SECONDARY,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px 20px",
              }}
            >
              {/* Left side: delete button (edit mode only) */}
              <div>
                {editingTask && (
                  <button
                    onClick={handleDeleteTask}
                    style={{
                      background: "rgba(248,113,113,0.08)",
                      border: `1px solid rgba(248,113,113,0.2)`,
                      color: RED,
                      fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                      padding: "8px 16px",
                      borderRadius: 6,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget
                      el.style.background = "rgba(248,113,113,0.15)"
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget
                      el.style.background = "rgba(248,113,113,0.08)"
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>

              {/* Right side: cancel + save/create */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn-secondary"
                  onClick={closeModal}
                  style={{ padding: "8px 18px" }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={editingTask ? handleUpdateTask : handleCreateTask}
                  disabled={!form.title.trim()}
                  style={{ padding: "8px 18px" }}
                >
                  {editingTask ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
