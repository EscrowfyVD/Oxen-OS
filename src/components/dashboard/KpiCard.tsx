"use client"

interface KpiCardProps {
  label: string
  value: number
  previousValue?: number
  icon: string
}

export default function KpiCard({ label, value, previousValue, icon }: KpiCardProps) {
  const trend = previousValue != null ? value - previousValue : null
  const trendUp = trend != null && trend > 0
  const trendDown = trend != null && trend < 0

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {trend != null && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              background: trendUp
                ? "rgba(92,184,104,0.15)"
                : trendDown
                ? "rgba(212,136,91,0.15)"
                : "var(--rose-dim)",
              color: trendUp ? "var(--green)" : trendDown ? "var(--orange)" : "var(--text-mid)",
            }}
          >
            {trendUp ? "↑" : trendDown ? "↓" : "→"} {Math.abs(trend).toLocaleString()}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs" style={{ color: "var(--text-dim)" }}>
        {label}
      </div>
    </div>
  )
}
