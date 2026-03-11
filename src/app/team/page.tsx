"use client"

import { useEffect, useState } from "react"
import PageHeader from "@/components/layout/PageHeader"

/* ── Design tokens ── */
const FROST = "#FFFFFF"
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const RED = "#F87171"

/* ── Types ── */
interface Employee {
  id: string
  name: string
  initials: string
  role: string
  department: string
  location: string | null
  email: string | null
  phone: string | null
  telegram: string | null
  whatsapp: string | null
  timezone: string | null
  workHours: string | null
  entity: string | null
  avatarColor: string
  managerId: string | null
  order: number
  isActive: boolean
}

interface OrgEntity {
  id: string
  name: string
  jurisdiction: string | null
  type: string
  parentId: string | null
}

interface MemberForm {
  name: string
  role: string
  entity: string
  email: string
  phone: string
  telegram: string
  whatsapp: string
  timezone: string
  workHours: string
}

const emptyMemberForm = (): MemberForm => ({
  name: "",
  role: "",
  entity: "",
  email: "",
  phone: "",
  telegram: "",
  whatsapp: "",
  timezone: "",
  workHours: "",
})

const initials = (name: string): string =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

export default function TeamPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [orgEntities, setOrgEntities] = useState<OrgEntity[]>([])
  const [search, setSearch] = useState("")
  const [addingMember, setAddingMember] = useState(false)
  const [addForm, setAddForm] = useState<MemberForm>(emptyMemberForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<MemberForm>(emptyMemberForm())

  const fetchEmployees = () => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }

  const fetchEntities = () => {
    fetch("/api/org-entities")
      .then((r) => r.json())
      .then((data) => setOrgEntities(data.entities ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchEmployees()
    fetchEntities()
  }, [])

  /* ── Filtered list ── */
  const filtered = employees.filter((emp) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      (emp.entity ?? "").toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q)
    )
  })

  /* ── CRUD handlers ── */
  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.role.trim()) return
    try {
      await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          initials: initials(addForm.name),
          role: addForm.role,
          department: "Operations",
          entity: addForm.entity || null,
          email: addForm.email || null,
          phone: addForm.phone || null,
          telegram: addForm.telegram || null,
          whatsapp: addForm.whatsapp || null,
          timezone: addForm.timezone || null,
          workHours: addForm.workHours || null,
          avatarColor: "rgba(192,139,136,0.4)",
        }),
      })
      setAddingMember(false)
      setAddForm(emptyMemberForm())
      fetchEmployees()
    } catch {
      // silent
    }
  }

  const handleEditSave = async (id: string) => {
    if (!editForm.name.trim() || !editForm.role.trim()) return
    try {
      await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          initials: initials(editForm.name),
          role: editForm.role,
          entity: editForm.entity || null,
          email: editForm.email || null,
          phone: editForm.phone || null,
          telegram: editForm.telegram || null,
          whatsapp: editForm.whatsapp || null,
          timezone: editForm.timezone || null,
          workHours: editForm.workHours || null,
        }),
      })
      setEditingId(null)
      setEditForm(emptyMemberForm())
      fetchEmployees()
    } catch {
      // silent
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/employees/${id}`, { method: "DELETE" })
      fetchEmployees()
    } catch {
      // silent
    }
  }

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id)
    setEditForm({
      name: emp.name,
      role: emp.role,
      entity: emp.entity ?? "",
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      telegram: emp.telegram ?? "",
      whatsapp: emp.whatsapp ?? "",
      timezone: emp.timezone ?? "",
      workHours: emp.workHours ?? "",
    })
    setAddingMember(false)
  }

  /* ── Shared styles ── */
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid rgba(192,139,136,0.25)",
    background: "rgba(255,255,255,0.04)",
    color: TEXT_PRIMARY,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    width: "100%",
    outline: "none",
    transition: "border-color 0.2s ease",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: TEXT_TERTIARY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
  }

  /* ── Member Form ── */
  const renderMemberForm = (
    form: MemberForm,
    setForm: (f: MemberForm) => void,
    onSave: () => void,
    onCancel: () => void,
    isEdit: boolean
  ) => (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid rgba(192,139,136,0.25)`,
        borderRadius: 12,
        padding: 20,
        animation: "fadeIn 0.3s ease",
      }}
    >
      {/* Row 1: Name, Role, Entity (3 columns) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={labelStyle}>Name</div>
          <input
            style={inputStyle}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name"
            autoFocus
          />
        </div>
        <div>
          <div style={labelStyle}>Role</div>
          <input
            style={inputStyle}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="Job title"
          />
        </div>
        <div>
          <div style={labelStyle}>Entity</div>
          <select
            style={{
              ...inputStyle,
              cursor: "pointer",
              appearance: "none" as const,
            }}
            value={form.entity}
            onChange={(e) => setForm({ ...form, entity: e.target.value })}
          >
            <option value="">None</option>
            {orgEntities.map((ent) => (
              <option key={ent.id} value={ent.name}>
                {ent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Email, Phone (2 columns) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={labelStyle}>Email</div>
          <input
            style={inputStyle}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@example.com"
            type="email"
          />
        </div>
        <div>
          <div style={labelStyle}>Phone</div>
          <input
            style={inputStyle}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 234 567 8900"
          />
        </div>
      </div>

      {/* Row 3: Telegram, WhatsApp (2 columns) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={labelStyle}>Telegram</div>
          <input
            style={inputStyle}
            value={form.telegram}
            onChange={(e) =>
              setForm({ ...form, telegram: e.target.value })
            }
            placeholder="@username"
          />
        </div>
        <div>
          <div style={labelStyle}>WhatsApp</div>
          <input
            style={inputStyle}
            value={form.whatsapp}
            onChange={(e) =>
              setForm({ ...form, whatsapp: e.target.value })
            }
            placeholder="+1 234 567 8900"
          />
        </div>
      </div>

      {/* Row 4: Timezone, Work Hours (2 columns) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={labelStyle}>Timezone</div>
          <input
            style={inputStyle}
            value={form.timezone}
            onChange={(e) =>
              setForm({ ...form, timezone: e.target.value })
            }
            placeholder="CET / EST / PST"
          />
        </div>
        <div>
          <div style={labelStyle}>Work Hours</div>
          <input
            style={inputStyle}
            value={form.workHours}
            onChange={(e) =>
              setForm({ ...form, workHours: e.target.value })
            }
            placeholder="09:00 - 18:00"
          />
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onSave}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            background: GREEN,
            color: "#060709",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
        >
          {isEdit ? "Save Changes" : "Add Member"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: `1px solid ${CARD_BORDER}`,
            background: "transparent",
            color: TEXT_SECONDARY,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )

  /* ── Member Row ── */
  const renderMemberRow = (emp: Employee) => {
    if (editingId === emp.id) {
      return (
        <div key={emp.id}>
          {renderMemberForm(
            editForm,
            setEditForm,
            () => handleEditSave(emp.id),
            () => {
              setEditingId(null)
              setEditForm(emptyMemberForm())
            },
            true
          )}
        </div>
      )
    }

    return (
      <div
        key={emp.id}
        style={{
          padding: "16px 20px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          transition: "all 0.25s ease",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          const row = e.currentTarget
          row.style.borderColor = "rgba(192,139,136,0.15)"
          const actions = row.querySelector(
            "[data-row-actions]"
          ) as HTMLElement | null
          if (actions) actions.style.opacity = "1"
        }}
        onMouseLeave={(e) => {
          const row = e.currentTarget
          row.style.borderColor = CARD_BORDER
          const actions = row.querySelector(
            "[data-row-actions]"
          ) as HTMLElement | null
          if (actions) actions.style.opacity = "0"
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #C08B88, #8B6B68)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 14,
              color: FROST,
              fontWeight: 400,
              lineHeight: 1,
            }}
          >
            {emp.initials || initials(emp.name)}
          </span>
        </div>

        {/* Name + Role */}
        <div style={{ minWidth: 0, flex: "0 0 180px" }}>
          <div
            style={{
              fontSize: 13,
              color: TEXT_PRIMARY,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {emp.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.3,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {emp.role}
          </div>
        </div>

        {/* Entity badge */}
        {emp.entity && (
          <div
            style={{
              fontSize: 9,
              padding: "2px 8px",
              borderRadius: 10,
              background: "rgba(192,139,136,0.1)",
              color: ROSE_GOLD,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              letterSpacing: 0.3,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {emp.entity}
          </div>
        )}

        {/* Contact info */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 14,
            flex: 1,
            minWidth: 0,
          }}
        >
          {emp.email && (
            <span
              style={{
                fontSize: 11,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {"\u2709"} {emp.email}
            </span>
          )}
          {emp.phone && (
            <span
              style={{
                fontSize: 11,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              {"\u260E"} {emp.phone}
            </span>
          )}
          {emp.telegram && (
            <span
              style={{
                fontSize: 11,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              {"\u2708"} {emp.telegram}
            </span>
          )}
        </div>

        {/* Timezone + hours */}
        <div
          style={{
            textAlign: "right",
            flexShrink: 0,
            minWidth: 80,
          }}
        >
          {emp.timezone && (
            <div
              style={{
                fontSize: 10,
                color: TEXT_TERTIARY,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {emp.timezone}
            </div>
          )}
          {emp.workHours && (
            <div
              style={{
                fontSize: 10,
                color: TEXT_TERTIARY,
                fontFamily: "'DM Sans', sans-serif",
                marginTop: 1,
              }}
            >
              {emp.workHours}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div
          data-row-actions=""
          style={{
            display: "flex",
            gap: 6,
            opacity: 0,
            transition: "opacity 0.2s ease",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => startEdit(emp)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: `1px solid ${CARD_BORDER}`,
              background: "rgba(255,255,255,0.04)",
              color: TEXT_SECONDARY,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor =
                "rgba(192,139,136,0.4)"
              e.currentTarget.style.color = ROSE_GOLD
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = CARD_BORDER
              e.currentTarget.style.color = TEXT_SECONDARY
            }}
            title="Edit member"
          >
            {"\u270E"}
          </button>
          <button
            onClick={() => handleDelete(emp.id)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid rgba(248,113,113,0.2)",
              background: "rgba(248,113,113,0.06)",
              color: RED,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "rgba(248,113,113,0.15)"
              e.currentTarget.style.borderColor =
                "rgba(248,113,113,0.4)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "rgba(248,113,113,0.06)"
              e.currentTarget.style.borderColor =
                "rgba(248,113,113,0.2)"
            }}
            title="Delete member"
          >
            {"\u2715"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <PageHeader
        title="Team"
        description={`Internal directory — ${employees.length} members`}
        actions={
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: "rgba(255,255,255,0.04)",
                color: TEXT_PRIMARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                width: 180,
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor =
                  "rgba(192,139,136,0.25)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = CARD_BORDER
              }}
            />
            <button
              className="header-btn"
              onClick={() => {
                setAddingMember(true)
                setEditingId(null)
                setAddForm(emptyMemberForm())
              }}
            >
              + Add Member
            </button>
          </div>
        }
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "20px 0",
        }}
      >
        {/* Add member form */}
        {addingMember && (
          <div style={{ marginBottom: 8 }}>
            {renderMemberForm(
              addForm,
              setAddForm,
              handleAdd,
              () => {
                setAddingMember(false)
                setAddForm(emptyMemberForm())
              },
              false
            )}
          </div>
        )}

        {/* Member rows */}
        {filtered.map((emp) => renderMemberRow(emp))}

        {/* Empty state */}
        {filtered.length === 0 && !addingMember && (
          <div
            style={{
              textAlign: "center",
              padding: 60,
            }}
          >
            <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 12 }}>
              {"\u2687"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {search.trim()
                ? "No team members match your search"
                : "No team members yet"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: TEXT_TERTIARY,
                fontFamily: "'DM Sans', sans-serif",
                marginTop: 4,
              }}
            >
              {search.trim()
                ? "Try a different search term"
                : "Click + Add Member to get started"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
