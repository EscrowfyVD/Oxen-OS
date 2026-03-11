"use client"

export interface Employee {
  id: string
  name: string
  initials: string
  role: string
  department: string
  location: string
  email: string
}

interface PersonCardProps {
  employee: Employee
  color: string
  onClick?: () => void
}

export default function PersonCard({ employee, color, onClick }: PersonCardProps) {
  return (
    <button
      onClick={onClick}
      className="card w-full text-left p-4 flex items-center gap-3 cursor-pointer"
      style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}
    >
      <div
        className="flex items-center justify-center rounded-full font-bold text-sm shrink-0"
        style={{
          width: 40,
          height: 40,
          background: color,
          color: "var(--text)",
        }}
      >
        {employee.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="font-semibold text-sm truncate"
          style={{ color: "var(--text)" }}
        >
          {employee.name}
        </div>
        <div
          className="text-xs truncate"
          style={{ color: "var(--text-mid)" }}
        >
          {employee.role}
        </div>
        {employee.location && (
          <div
            className="text-xs mt-0.5 truncate"
            style={{ color: "var(--text-dim)" }}
          >
            {"\uD83D\uDCCD"} {employee.location}
          </div>
        )}
      </div>
    </button>
  )
}
