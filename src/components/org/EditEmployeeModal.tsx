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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-mid)",
    marginBottom: 4,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg mx-4 p-6"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--text)" }}
          >
            {isNew ? "Add Employee" : "Edit Employee"}
          </h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-xl"
            style={{ color: "var(--text-dim)" }}
          >
            {"\u2715"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Initials</label>
              <input
                type="text"
                value={form.initials}
                onChange={(e) => handleChange("initials", e.target.value)}
                style={inputStyle}
                maxLength={3}
                required
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Role</label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => handleChange("role", e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Department</label>
            <select
              value={form.department}
              onChange={(e) => handleChange("department", e.target.value)}
              style={{
                ...inputStyle,
                cursor: "pointer",
                appearance: "none" as const,
              }}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {isNew ? "Add Employee" : "Save Changes"}
            </button>
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(form.id)}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
                style={{
                  background: "rgba(220,60,60,0.12)",
                  color: "#DC3C3C",
                  border: "1px solid rgba(220,60,60,0.2)",
                  fontFamily: "'DM Sans', sans-serif",
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
