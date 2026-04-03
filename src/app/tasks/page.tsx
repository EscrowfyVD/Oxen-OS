"use client"

import { useState, useEffect, useCallback, useMemo } from "react"

/* ── Design tokens ── */
const CARD_BG = "rgba(15,17,24,0.6)"
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
const TEAL = "#5BB8A8"
const FROST = "#FFFFFF"

/* ── Tag color palette (7 tags) ── */
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  compliance: { bg: "rgba(251,191,36,0.12)", text: AMBER },
  onboarding: { bg: "rgba(52,211,153,0.12)", text: GREEN },
  tech:       { bg: "rgba(129,140,248,0.12)", text: INDIGO },
  sales:      { bg: "rgba(192,139,136,0.12)", text: ROSE_GOLD },
  legal:      { bg: "rgba(167,139,250,0.12)", text: PURPLE },
  finance:    { bg: "rgba(253,230,138,0.12)", text: YELLOW },
  support:    { bg: "rgba(91,184,168,0.12)", text: TEAL },
}

const PRIORITY_COLORS: Record<string, string> = {
  high: RED,
  medium: AMBER,
  low: TEXT_TERTIARY,
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

/* ── Column definitions ── */
const COLUMNS_DEFAULT = [
  { id: "todo", label: "To Do", accent: RED },
  { id: "inprogress", label: "In Progress", accent: AMBER },
  { id: "done", label: "Done", accent: GREEN },
]

const COLUMNS_SUPPORT = [
  { id: "todo", label: "To Do", accent: RED },
  { id: "inprogress", label: "In Progress", accent: AMBER },
  { id: "waiting_client", label: "Waiting Client", accent: AMBER },
  { id: "done", label: "Done", accent: GREEN },
]

const FILTER_TAGS = ["all", "compliance", "onboarding", "tech", "sales", "legal", "finance", "support"]

type ViewMode = "my" | "all" | "support"

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
  supportTicketId?: string | null
  contactId?: string | null
  supportTicket?: { id: string; subject: string; clientName: string; status: string } | null
  contact?: { id: string; name: string; company: string | null } | null
}

interface Employee {
  id: string
  name: string
  initials: string
  role: string
}

interface SupportTicketOption {
  id: string
  subject: string
  clientName: string
}

interface ContactOption {
  id: string
  name: string
  company: string | null
}

interface TaskFormData {
  title: string
  description: string
  tag: string
  priority: string
  assignee: string
  deadline: string
  supportTicketId: string
  contactId: string
}

interface MeData {
  name: string
  roleLevel: string
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

/* ── Helpers ── */
function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false
  const d = new Date(deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

function isDueToday(deadline: string | null): boolean {
  if (!deadline) return false
  const d = new Date(deadline)
  const today = new Date()
  return d.toDateString() === today.toDateString()
}

function isDueThisWeek(deadline: string | null): boolean {
  if (!deadline) return false
  const d = new Date(deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()))
  return d > today && d <= endOfWeek
}

function formatDeadline(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

/* ── TaskCard (inline component) ── */
function TaskCard({
  task,
  onClick,
  onLeaveNames,
  showOverdueBadge,
  viewMode,
}: {
  task: Task
  onClick: () => void
  onLeaveNames?: Set<string>
  showOverdueBadge?: boolean
  viewMode?: ViewMode
}) {
  const tagStyle = TAG_COLORS[task.tag] || { bg: "rgba(255,255,255,0.06)", text: TEXT_SECONDARY }
  const priorityColor = PRIORITY_COLORS[task.priority] || TEXT_TERTIARY
  const overdue = showOverdueBadge && isOverdue(task.deadline) && task.column !== "done"
  const dueToday = isDueToday(task.deadline) && task.column !== "done"
  const dueThisWeek = isDueThisWeek(task.deadline) && task.column !== "done" && !dueToday

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", task.id)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${dueToday ? "rgba(251,191,36,0.35)" : CARD_BORDER}`,
        borderRadius: 8,
        padding: "12px 14px",
        cursor: "grab",
        transition: "all 0.2s ease",
        marginBottom: 8,
        position: "relative",
        boxShadow: dueToday ? "0 0 12px rgba(251,191,36,0.08)" : "none",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = "rgba(192,139,136,0.2)"
        el.style.transform = "translateY(-1px)"
        el.style.cursor = "pointer"
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = dueToday ? "rgba(251,191,36,0.35)" : CARD_BORDER
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

      {/* Overdue badge */}
      {overdue && (
        <div
          style={{
            fontSize: 8,
            fontWeight: 600,
            color: RED,
            background: "rgba(248,113,113,0.12)",
            padding: "2px 6px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 6,
            display: "inline-block",
          }}
        >
          OVERDUE
        </div>
      )}

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

      {/* Tag pill + due this week label */}
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
        {dueThisWeek && (
          <span
            style={{
              fontSize: 8,
              color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
              fontStyle: "italic",
            }}
          >
            This week
          </span>
        )}
      </div>

      {/* Client name for support view */}
      {viewMode === "support" && task.supportTicket && (
        <div
          style={{
            fontSize: 10,
            color: TEAL,
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ opacity: 0.7 }}>{"\u{1F464}"}</span>
          {task.supportTicket.clientName}
        </div>
      )}
      {viewMode === "support" && !task.supportTicket && task.contact && (
        <div
          style={{
            fontSize: 10,
            color: TEAL,
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span style={{ opacity: 0.7 }}>{"\u{1F464}"}</span>
          {task.contact.name}
        </div>
      )}

      {/* Assignee + deadline */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {task.assignee && (
          <span
            style={{
              fontSize: 10,
              color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {onLeaveNames?.has(task.assignee) && (
              <span title="On leave today" style={{ color: AMBER, fontSize: 11 }}>{"\u26A0"}</span>
            )}
            {task.assignee}
          </span>
        )}
        {task.deadline && (
          <span
            style={{
              fontSize: 10,
              color: overdue ? RED : TEXT_TERTIARY,
              fontWeight: overdue ? 600 : 400,
              fontFamily: "'DM Sans', sans-serif",
              fontVariantNumeric: "tabular-nums",
              marginLeft: "auto",
            }}
          >
            {formatDeadline(task.deadline)}
          </span>
        )}
      </div>

      {/* Support ticket link */}
      {viewMode === "support" && task.supportTicket && (
        <div
          style={{
            marginTop: 6,
            fontSize: 9,
            color: TEAL,
            fontFamily: "'DM Sans', sans-serif",
            opacity: 0.7,
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation()
            window.location.href = `/support/${task.supportTicket!.id}`
          }}
        >
          {"\u2192"} View ticket
        </div>
      )}
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
  const [onLeaveNames, setOnLeaveNames] = useState<Set<string>>(new Set())
  const [me, setMe] = useState<MeData | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("my")
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [supportTickets, setSupportTickets] = useState<SupportTicketOption[]>([])

  const isAdmin = me?.roleLevel === "super_admin" || me?.roleLevel === "admin"
  const isManager = isAdmin || me?.roleLevel === "manager"

  /* Form state */
  const [form, setForm] = useState<TaskFormData>({
    title: "",
    description: "",
    tag: "compliance",
    priority: "medium",
    assignee: "",
    deadline: "",
    supportTicketId: "",
    contactId: "",
  })

  /* ── Fetch current user ── */
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.employee) {
          setMe({ name: data.employee.name, roleLevel: data.employee.roleLevel ?? "member" })
        }
      })
      .catch(() => {})
  }, [])

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

  /* ── Fetch contacts + tickets for modal dropdowns ── */
  const fetchContacts = useCallback(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((data) => setContacts((data.contacts ?? []).map((c: ContactOption) => ({ id: c.id, name: c.name, company: c.company }))))
      .catch(() => {})
  }, [])

  const fetchSupportTickets = useCallback(() => {
    fetch("/api/support/tickets")
      .then((r) => r.json())
      .then((data) => setSupportTickets((data.tickets ?? []).map((t: SupportTicketOption) => ({ id: t.id, subject: t.subject, clientName: t.clientName }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchEmployees()
    fetchContacts()
    fetchSupportTickets()
    fetch("/api/leaves/who-is-out")
      .then((r) => r.json())
      .then((data) => {
        const names = new Set<string>((data.today ?? []).map((w: { employee: { name: string } }) => w.employee.name))
        setOnLeaveNames(names)
      })
      .catch(() => {})
  }, [fetchTasks, fetchEmployees, fetchContacts, fetchSupportTickets])

  /* ── Columns based on view ── */
  const columns = viewMode === "support" ? COLUMNS_SUPPORT : COLUMNS_DEFAULT

  /* ── Filtered tasks ── */
  const filtered = useMemo(() => {
    let result = tasks

    // View filter
    if (viewMode === "my" && me) {
      result = result.filter((t) => t.assignee === me.name)
    } else if (viewMode === "support") {
      result = result.filter((t) => t.tag === "support")
    } else if (viewMode === "all") {
      // show all
    }

    // Tag filter (only applies to "all" and "my" views)
    if (viewMode !== "support" && activeFilter !== "all") {
      result = result.filter((t) => t.tag === activeFilter)
    }

    return result
  }, [tasks, viewMode, me, activeFilter])

  /* ── Sort tasks for My Tasks: overdue pinned, then priority, then deadline ── */
  const getSortedColumnTasks = useCallback((colId: string) => {
    const colTasks = filtered.filter((t) => t.column === colId)

    if (viewMode === "my") {
      return colTasks.sort((a, b) => {
        // Overdue tasks pinned at top of "todo" column
        if (colId === "todo") {
          const aOver = isOverdue(a.deadline) ? 0 : 1
          const bOver = isOverdue(b.deadline) ? 0 : 1
          if (aOver !== bOver) return aOver - bOver
        }
        // Then by priority (high first)
        const aPri = PRIORITY_ORDER[a.priority] ?? 1
        const bPri = PRIORITY_ORDER[b.priority] ?? 1
        if (aPri !== bPri) return aPri - bPri
        // Then by deadline (soonest first, null last)
        if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        if (a.deadline) return -1
        if (b.deadline) return 1
        return 0
      })
    }

    return colTasks
  }, [filtered, viewMode])

  /* ── My Tasks stats ── */
  const myStats = useMemo(() => {
    if (!me) return { todo: 0, inprogress: 0, overdue: 0 }
    const myTasks = tasks.filter((t) => t.assignee === me.name)
    return {
      todo: myTasks.filter((t) => t.column === "todo").length,
      inprogress: myTasks.filter((t) => t.column === "inprogress").length,
      overdue: myTasks.filter((t) => t.column !== "done" && isOverdue(t.deadline)).length,
    }
  }, [tasks, me])

  /* ── Support stats ── */
  const supportStats = useMemo(() => {
    const supportTasks = tasks.filter((t) => t.tag === "support")
    return {
      todo: supportTasks.filter((t) => t.column === "todo").length,
      inprogress: supportTasks.filter((t) => t.column === "inprogress").length,
      waitingClient: supportTasks.filter((t) => t.column === "waiting_client").length,
      done: supportTasks.filter((t) => t.column === "done").length,
    }
  }, [tasks])

  /* ── Reset form ── */
  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      tag: "compliance",
      priority: "medium",
      assignee: "",
      deadline: "",
      supportTicketId: "",
      contactId: "",
    })
    setEditingTask(null)
  }

  /* ── Open create modal ── */
  const openCreate = () => {
    resetForm()
    if (viewMode === "support") {
      setForm((f) => ({ ...f, tag: "support" }))
    }
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
      supportTicketId: task.supportTicketId || "",
      contactId: task.contactId || "",
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
          supportTicketId: form.supportTicketId || null,
          contactId: form.contactId || null,
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
          supportTicketId: form.supportTicketId || null,
          contactId: form.contactId || null,
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

  /* ── Column stats (adapts to view) ── */
  const getHighPriorityCount = (colId: string) =>
    filtered.filter((t) => t.column === colId && t.priority === "high").length

  /* ── Subtitle based on view ── */
  const getSubtitle = () => {
    if (viewMode === "my") {
      const open = myStats.todo
      const inProg = myStats.inprogress
      return `Your tasks \u2014 ${open} open, ${inProg} in progress`
    }
    if (viewMode === "support") {
      const open = supportStats.todo + supportStats.inprogress + supportStats.waitingClient
      return `Customer Support Tasks \u2014 ${open} open`
    }
    return "Kanban board \u2014 drag cards to update status, click to edit"
  }

  /* ── Available views ── */
  const availableViews: { id: ViewMode; label: string }[] = useMemo(() => {
    const views: { id: ViewMode; label: string }[] = [{ id: "my", label: "My Tasks" }]
    if (isManager) views.push({ id: "all", label: "All Tasks" })
    views.push({ id: "support", label: "Customer Support" })
    return views
  }, [isManager])

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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div>
            <h1
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 32,
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
              {getSubtitle()}
            </p>
          </div>

          {/* View toggle */}
          <div className="toggle-group">
            {availableViews.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setViewMode(v.id)
                  setActiveFilter("all")
                }}
                className={`toggle-btn ${viewMode === v.id ? "active" : ""}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <button className="header-btn" onClick={openCreate}>
          New Task
        </button>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding: "28px 32px" }}>
        {/* ── Personal summary bar (My Tasks view) ── */}
        {viewMode === "my" && me && (
          <div
            className="card fade-in"
            style={{
              padding: "14px 20px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 24,
              animationDelay: "0.02s",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
                color: TEXT_SECONDARY,
              }}
            >
              You have{" "}
              <span style={{ color: FROST, fontWeight: 600 }}>{myStats.todo}</span> tasks to do,{" "}
              <span style={{ color: FROST, fontWeight: 600 }}>{myStats.inprogress}</span> in progress
              {myStats.overdue > 0 && (
                <>
                  ,{" "}
                  <span style={{ color: RED, fontWeight: 600 }}>{myStats.overdue} overdue</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* ── Filter row (not shown in support view) ── */}
        {viewMode !== "support" && (
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
        )}

        {/* ── Empty state for My Tasks ── */}
        {viewMode === "my" && me && filtered.length === 0 && (
          <div
            className="card fade-in"
            style={{
              padding: "48px 20px",
              textAlign: "center",
              animationDelay: "0.1s",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>{"\u2705"}</div>
            <div
              style={{
                fontSize: 14,
                color: TEXT_PRIMARY,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              You&apos;re all caught up
            </div>
            <div
              style={{
                fontSize: 12,
                color: TEXT_TERTIARY,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              No tasks assigned to you
            </div>
          </div>
        )}

        {/* ── Kanban Board ── */}
        {!(viewMode === "my" && me && filtered.length === 0) && (
          <div
            className="card fade-in"
            style={{
              padding: 16,
              marginBottom: 20,
              animationDelay: "0.1s",
            }}
          >
            <div style={{ display: "flex", gap: 16 }}>
              {columns.map((col) => {
                const colTasks = getSortedColumnTasks(col.id)
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
                          onLeaveNames={onLeaveNames}
                          showOverdueBadge={viewMode === "my"}
                          viewMode={viewMode}
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
        )}

        {/* ── Column Stats ── */}
        <div
          className="fade-in"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
            gap: 16,
            animationDelay: "0.15s",
          }}
        >
          {columns.map((col) => {
            const count = filtered.filter((t) => t.column === col.id).length
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
                      fontSize: 32,
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
              borderRadius: 14,
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
                    <option value="support">Support</option>
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

              {/* Linked Contact (optional) */}
              <div>
                <label style={labelStyle}>Linked Contact</label>
                <select
                  className="oxen-input"
                  value={form.contactId}
                  onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                  style={{ appearance: "none" }}
                >
                  <option value="">None</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.company ? ` — ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Linked Support Ticket (only if tag is support) */}
              {form.tag === "support" && (
                <div>
                  <label style={labelStyle}>Linked Support Ticket</label>
                  <select
                    className="oxen-input"
                    value={form.supportTicketId}
                    onChange={(e) => setForm({ ...form, supportTicketId: e.target.value })}
                    style={{ appearance: "none" }}
                  >
                    <option value="">None</option>
                    {supportTickets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.subject} — {t.clientName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status buttons (only when editing) */}
              {editingTask && (
                <div>
                  <label style={labelStyle}>Status</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {columns.map((col) => (
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
