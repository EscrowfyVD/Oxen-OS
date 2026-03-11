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
  textColor?: string
  onClick?: () => void
}

export default function PersonCard({ employee, color, textColor, onClick }: PersonCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 cursor-pointer interactive-card"
      style={{
        padding: "12px 14px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        transition: "all 0.2s ease",
        fontFamily: "'DM Sans', sans-serif",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)"
        e.currentTarget.style.borderColor = "rgba(192,139,136,0.30)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-card)"
        e.currentTarget.style.borderColor = "rgba(192,139,136,0.10)"
      }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: color,
          color: textColor ?? "var(--text)",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {employee.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          {employee.name}
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            marginTop: 1,
          }}
        >
          {employee.role}
        </div>
        {employee.location && (
          <div
            className="truncate"
            style={{
              fontSize: 11,
              color: "var(--rose)",
              marginTop: 2,
            }}
          >
            {"\uD83D\uDCCD"} {employee.location}
          </div>
        )}
      </div>
    </button>
  )
}
