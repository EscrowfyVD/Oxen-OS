"use client"

import PersonCard, { Employee } from "./PersonCard"

interface DepartmentCardProps {
  department: string
  employees: Employee[]
  bgColor: string
  avatarColor: string
  onPersonClick: (employee: Employee) => void
}

export default function DepartmentCard({
  department,
  employees,
  bgColor,
  avatarColor,
  onPersonClick,
}: DepartmentCardProps) {
  return (
    <div
      className="card overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      <div
        className="px-5 py-3 font-semibold text-sm"
        style={{
          background: bgColor,
          color: "var(--text)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {department}
        <span
          className="ml-2 text-xs font-normal"
          style={{ color: "var(--text-dim)" }}
        >
          {employees.length} {employees.length === 1 ? "member" : "members"}
        </span>
      </div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {employees.map((emp) => (
          <PersonCard
            key={emp.id}
            employee={emp}
            color={avatarColor}
            onClick={() => onPersonClick(emp)}
          />
        ))}
      </div>
    </div>
  )
}
