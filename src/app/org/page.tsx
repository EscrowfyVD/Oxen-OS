"use client"

import { useEffect, useState } from "react"
import PageHeader from "@/components/layout/PageHeader"
import DepartmentCard from "@/components/org/DepartmentCard"
import PersonCard, { Employee } from "@/components/org/PersonCard"
import EditEmployeeModal from "@/components/org/EditEmployeeModal"

const DEPT_COLORS: Record<string, { bg: string; avatar: string; text: string }> = {
  Advisory: {
    bg: "rgba(91,155,191,0.15)",
    avatar: "rgba(91,155,191,0.35)",
    text: "#5B9BBF",
  },
  Shareholders: {
    bg: "rgba(192,139,136,0.2)",
    avatar: "rgba(192,139,136,0.4)",
    text: "#C08B88",
  },
  Operations: {
    bg: "rgba(92,184,104,0.15)",
    avatar: "rgba(92,184,104,0.35)",
    text: "#5CB868",
  },
  Finance: {
    bg: "rgba(229,196,83,0.15)",
    avatar: "rgba(229,196,83,0.35)",
    text: "#E5C453",
  },
  Sales: {
    bg: "rgba(155,127,212,0.15)",
    avatar: "rgba(155,127,212,0.35)",
    text: "#9B7FD4",
  },
  Compliance: {
    bg: "rgba(212,136,91,0.15)",
    avatar: "rgba(212,136,91,0.35)",
    text: "#D4885B",
  },
  Support: {
    bg: "rgba(91,184,168,0.15)",
    avatar: "rgba(91,184,168,0.35)",
    text: "#5BB8A8",
  },
  Tech: {
    bg: "rgba(91,155,191,0.2)",
    avatar: "rgba(91,155,191,0.4)",
    text: "#5B9BBF",
  },
  "Account Management": {
    bg: "rgba(155,127,212,0.15)",
    avatar: "rgba(155,127,212,0.35)",
    text: "#9B7FD4",
  },
}

function getDefaultColors() {
  return { bg: "rgba(192,139,136,0.12)", avatar: "rgba(192,139,136,0.3)", text: "#C08B88" }
}

type ViewMode = "department" | "hierarchy"

export default function OrgPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("department")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [isNew, setIsNew] = useState(false)

  const fetchEmployees = () => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const departments = employees.reduce<Record<string, Employee[]>>(
    (acc, emp) => {
      const dept = emp.department || "Other"
      if (!acc[dept]) acc[dept] = []
      acc[dept].push(emp)
      return acc
    },
    {}
  )

  const handlePersonClick = (employee: Employee) => {
    setEditingEmployee(employee)
    setIsNew(false)
    setModalOpen(true)
  }

  const handleAddNew = () => {
    setEditingEmployee(null)
    setIsNew(true)
    setModalOpen(true)
  }

  const handleSave = async (employee: Employee) => {
    try {
      if (isNew) {
        await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(employee),
        })
      } else {
        await fetch(`/api/employees/${employee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(employee),
        })
      }
      setModalOpen(false)
      fetchEmployees()
    } catch {
      // handle error silently
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/employees/${id}`, { method: "DELETE" })
      setModalOpen(false)
      fetchEmployees()
    } catch {
      // handle error silently
    }
  }

  const deptOrder = Object.keys(DEPT_COLORS)
  const sortedDepts = Object.keys(departments).sort((a, b) => {
    const ai = deptOrder.indexOf(a)
    const bi = deptOrder.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <div className="page-content">
      <PageHeader
        title="Organigramme"
        description="Team structure and organization"
        actions={
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="toggle-group">
              <button
                onClick={() => setViewMode("department")}
                className={`toggle-btn ${viewMode === "department" ? "active" : ""}`}
              >
                Department
              </button>
              <button
                onClick={() => setViewMode("hierarchy")}
                className={`toggle-btn ${viewMode === "hierarchy" ? "active" : ""}`}
              >
                All Members
              </button>
            </div>
            <button className="btn-primary" onClick={handleAddNew}>
              + Add Employee
            </button>
          </div>
        }
      />

      {/* Team count highlight */}
      {employees.length > 0 && (
        <div className="highlight-box" style={{ marginBottom: 20 }}>
          <div className="flex items-center gap-4">
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 28,
                fontWeight: 700,
                color: "var(--rose)",
              }}
            >
              {employees.length}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                Team Members
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                Across {Object.keys(departments).length} departments
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === "department" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {sortedDepts.map((dept) => {
            const colors = DEPT_COLORS[dept] ?? getDefaultColors()
            return (
              <DepartmentCard
                key={dept}
                department={dept}
                employees={departments[dept]}
                bgColor={colors.bg}
                avatarColor={colors.avatar}
                textColor={colors.text}
                onPersonClick={handlePersonClick}
              />
            )
          })}
          {employees.length === 0 && (
            <div
              className="flex flex-col items-center justify-center"
              style={{ padding: "64px 0", color: "var(--text-dim)" }}
            >
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>{"\uD83D\uDC65"}</div>
              <div style={{ fontSize: 13 }}>
                No employees found. Add your first team member to get started.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div
            className="card"
            style={{ overflow: "hidden" }}
          >
            <div className="card-header">
              <span style={{ fontSize: 14 }}>{"\uD83D\uDC65"}</span>
              <span>All Team Members</span>
              <span
                className="badge"
                style={{ marginLeft: "auto" }}
              >
                {employees.length}
              </span>
            </div>
            <div
              style={{
                padding: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                gap: 8,
              }}
            >
              {employees.map((emp) => {
                const colors = DEPT_COLORS[emp.department] ?? getDefaultColors()
                return (
                  <PersonCard
                    key={emp.id}
                    employee={emp}
                    color={colors.avatar}
                    textColor={colors.text}
                    onClick={() => handlePersonClick(emp)}
                  />
                )
              })}
            </div>
          </div>
          {employees.length === 0 && (
            <div
              className="flex flex-col items-center justify-center"
              style={{ padding: "64px 0", color: "var(--text-dim)" }}
            >
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>{"\uD83D\uDC65"}</div>
              <div style={{ fontSize: 13 }}>
                No employees found. Add your first team member to get started.
              </div>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <EditEmployeeModal
          employee={editingEmployee}
          isNew={isNew}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
