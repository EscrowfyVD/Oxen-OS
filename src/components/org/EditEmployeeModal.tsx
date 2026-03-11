"use client"

import { useState, useEffect } from "react"
import type { Employee } from "./PersonCard"

const DEPARTMENTS = [
  "Advisory",
  "Shareholders",
  "Operations",
  "Finance",
  "Sales",
  "Compliance",
  "Support",
  "Tech",
  "Account Management",
]

interface EditEmployeeModalProps {
  employee: Employee | null
  isNew: boolean
  onClose: () => void
  onSave: (employee: Employee) => void
  onDelete?: (id: string) => void
}

export default function EditEmployeeModal({
  employee,
  isNew,
  onClose,
  onSave,
  onDelete,
}: EditEmployeeModalProps) {
  const [form, setForm] = useState<Employee>({
    id: "",
    name: "",
    initials: "",
    role: "",
    department: DEPARTMENTS[0],
    location: "",
    email: "",
  })

  useEffect(() => {
    if (employee) {
      setForm(employee)
    } else {
      setForm({
        id: "",
        name: "",
        initials: "",
        role: "",
        department: DEPARTMENTS[0],
        location: "",
        email: "",
      })
    }
  }, [employee])

  const handleChange = (field: keyof Employee, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="card animate-slideUp w-full max-w-lg mx-4"
        style={{
          background: "var(--bg-elevated)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {isNew ? "Add Employee" : "Edit Employee"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "var(--text-dim)",
              padding: 4,
            }}
          >
            {"\u2715"}
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div
            className="grid grid-cols-2 gap-4"
            style={{ marginBottom: 16 }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-mid)",
                  marginBottom: 6,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="oxen-input"
                required
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-mid)",
                  marginBottom: 6,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Initials
              </label>
              <input
                type="text"
                value={form.initials}
                onChange={(e) => handleChange("initials", e.target.value)}
                className="oxen-input"
                maxLength={3}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-mid)",
                marginBottom: 6,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Role
            </label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => handleChange("role", e.target.value)}
              className="oxen-input"
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-mid)",
                marginBottom: 6,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Department
            </label>
            <select
              value={form.department}
              onChange={(e) => handleChange("department", e.target.value)}
              className="oxen-input"
              style={{ cursor: "pointer", appearance: "none" as const }}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-mid)",
                marginBottom: 6,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
              className="oxen-input"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-mid)",
                marginBottom: 6,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="oxen-input"
            />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary flex-1">
              {isNew ? "Add Employee" : "Save Changes"}
            </button>
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(form.id)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "rgba(220,60,60,0.12)",
                  color: "#DC3C3C",
                  border: "1px solid rgba(220,60,60,0.2)",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
