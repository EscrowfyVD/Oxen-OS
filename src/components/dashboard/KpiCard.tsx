"use client"

interface KpiCardProps {
  label: string
  value: number
  previousValue?: number
  icon: string
  color?: string
}

export default function KpiCard({ label, value, previousValue, icon, color }: KpiCardProps) {
  const trend = previousValue != null ? value - previousValue : null
  const trendUp = trend != null && trend > 0
  const trendDown = trend != null && trend < 0
  const accentColor = color ?? "var(--rose)"

  const formatValue = (v: number) => {
    if (label.toLowerCase().includes("revenue") || label.toLowerCase().includes("pipeline")) {
      return v >= 1000000
        ? `${(v / 1000000).toFixed(1)}M`
        : v >= 1000
        ? `${(v / 1000).toFixed(0)}K`
        : v.toLocaleString()
    }
    return v.toLocaleString()
  }

  return (
    <div
      className="card interactive-card"
      style={{
        padding: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${accentColor}10, transparent)`,
          pointerEvents: "none",
        }}
      />

      <div style={{ padding: "20px", position: "relative" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          {/* Icon circle */}
          <div
            className="flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${accentColor}18`,
              fontSize: 18,
            }}
          >
            {icon}
          </div>

          {/* Trend badge */}
          {trend != null && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
                background: trendUp
                  ? "rgba(92,184,104,0.15)"
                  : trendDown
                  ? "rgba(212,136,91,0.15)"
                  : "var(--rose-dim)",
                color: trendUp
                  ? "var(--green)"
                  : trendDown
                  ? "var(--orange)"
                  : "var(--text-mid)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {trendUp ? "\u2191" : trendDown ? "\u2193" : "\u2192"} {Math.abs(trend).toLocaleString()}
            </span>
          )}
        </div>

        {/* Value */}
        <div className="kpi-number" style={{ marginBottom: 4 }}>
          {formatValue(value)}
        </div>

        {/* Label */}
        <div
          style={{
            fontSize: 12,
            color: "var(--text-dim)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {label}
        </div>
      </div>

      {/* Decorative background number */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: -8,
          fontSize: 64,
          fontFamily: "'Playfair Display', serif",
          fontWeight: 700,
          color: accentColor,
          opacity: 0.06,
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {formatValue(value)}
      </div>
    </div>
  )
}
