"use client"

import PersonCard, { Employee } from "./PersonCard"

interface DepartmentCardProps {
  department: string
  employees: Employee[]
  bgColor: string
  avatarColor: string
  textColor: string
  onPersonClick: (employee: Employee) => void
}

export default function DepartmentCard({
  department,
  employees,
  bgColor,
  avatarColor,
  textColor,
  onPersonClick,
}: DepartmentCardProps) {
  return (
    <div
      className="card animate-fadeIn"
      style={{ overflow: "hidden" }}
    >
      {/* Department header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "14px 20px",
          background: bgColor,
          borderBottom: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: textColor,
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {department}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {employees.length} {employees.length === 1 ? "member" : "members"}
        </span>
      </div>

      {/* People grid */}
      <div
        style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
          gap: 8,
        }}
      >
        {employees.map((emp) => (
          <PersonCard
            key={emp.id}
            employee={emp}
            color={avatarColor}
            textColor={textColor}
            onClick={() => onPersonClick(emp)}
          />
        ))}
      </div>
    </div>
  )
}
