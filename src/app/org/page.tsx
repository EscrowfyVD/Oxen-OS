"use client"

import { useEffect, useState } from "react"
import PageHeader from "@/components/layout/PageHeader"
import DepartmentCard from "@/components/org/DepartmentCard"
import PersonCard, { Employee } from "@/components/org/PersonCard"
import EditEmployeeModal from "@/components/org/EditEmployeeModal"

const DEPT_COLORS: Record<string, { bg: string; avatar: string }> = {
  Advisory: {
    bg: "rgba(91,155,191,0.15)",
    avatar: "rgba(91,155,191,0.35)",
  },
  Shareholders: {
    bg: "rgba(192,139,136,0.2)",
    avatar: "rgba(192,139,136,0.4)",
  },
  Operations: {
    bg: "rgba(92,184,104,0.15)",
    avatar: "rgba(92,184,104,0.35)",
  },
  Finance: {
    bg: "rgba(229,196,83,0.15)",
    avatar: "rgba(229,196,83,0.35)",
  },
  Sales: {
    bg: "rgba(155,127,212,0.15)",
    avatar: "rgba(155,127,212,0.35)",
  },
  Compliance: {
    bg: "rgba(212,136,91,0.15)",
    avatar: "rgba(212,136,91,0.35)",
  },
  Support: {
    bg: "rgba(91,184,168,0.15)",
    avatar: "rgba(91,184,168,0.35)",
  },
  Tech: {
    bg: "rgba(91,155,191,0.2)",
    avatar: "rgba(91,155,191,0.4)",
  },
  "Account Management": {
    bg: "rgba(155,127,212,0.15)",
    avatar: "rgba(155,127,212,0.35)",
  },
}

function getDefaultColors() {
  return { bg: "rgba(192,139,136,0.12)", avatar: "rgba(192,139,136,0.3)" }
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
    <div>
      <PageHeader
        title="Organigramme"
        description="Team structure and organization"
        actions={
          <div className="flex items-center gap-3">
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => setViewMode("department")}
                className="px-3 py-1.5 text-xs font-semibold cursor-pointer border-none"
                style={{
                  background:
                    viewMode === "department"
                      ? "var(--rose-dim)"
                      : "transparent",
                  color:
                    viewMode === "department"
                      ? "var(--rose)"
                      : "var(--text-dim)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Department
              </button>
              <button
                onClick={() => setViewMode("hierarchy")}
                className="px-3 py-1.5 text-xs font-semibold cursor-pointer border-none"
                style={{
                  background:
                    viewMode === "hierarchy"
                      ? "var(--rose-dim)"
                      : "transparent",
                  color:
                    viewMode === "hierarchy"
                      ? "var(--rose)"
                      : "var(--text-dim)",
                  fontFamily: "'DM Sans', sans-serif",
                  borderLeft: "1px solid var(--border)",
                }}
              >
                Hierarchy
              </button>
            </div>
            <button className="btn-primary text-sm" onClick={handleAddNew}>
              + Add Employee
            </button>
          </div>
        }
      />

      {viewMode === "department" ? (
        <div className="space-y-6">
          {sortedDepts.map((dept) => {
            const colors = DEPT_COLORS[dept] ?? getDefaultColors()
            return (
              <DepartmentCard
                key={dept}
                department={dept}
                employees={departments[dept]}
                bgColor={colors.bg}
                avatarColor={colors.avatar}
                onPersonClick={handlePersonClick}
              />
            )
          })}
          {employees.length === 0 && (
            <div
              className="text-center py-16"
              style={{ color: "var(--text-dim)" }}
            >
              <div className="text-4xl mb-3">{"👥"}</div>
              <div className="text-sm">
                No employees found. Add your first team member to get started.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div
            className="card p-6 mb-4"
            style={{ border: "1px solid var(--border)" }}
          >
            <h3
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--text-mid)" }}
            >
              All Team Members
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {employees.map((emp) => {
                const colors =
                  DEPT_COLORS[emp.department] ?? getDefaultColors()
                return (
                  <PersonCard
                    key={emp.id}
                    employee={emp}
                    color={colors.avatar}
                    onClick={() => handlePersonClick(emp)}
                  />
                )
              })}
            </div>
          </div>
          {employees.length === 0 && (
            <div
              className="text-center py-16"
              style={{ color: "var(--text-dim)" }}
            >
              <div className="text-4xl mb-3">{"👥"}</div>
              <div className="text-sm">
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
