"use client"

interface Segment {
  value: number
  color: string
}

interface DonutChartProps {
  segments: Segment[]
  size?: number
}

export default function DonutChart({ segments, size = 100 }: DonutChartProps) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  let cumulativeOffset = 0

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "block" }}
    >
      {/* Background track */}
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="12"
      />

      {/* Segments */}
      {segments.map((segment, i) => {
        const segmentLength = total > 0 ? (segment.value / total) * circumference : 0
        const offset = cumulativeOffset
        cumulativeOffset += segmentLength

        return (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="12"
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        )
      })}

      {/* Center total */}
      <text
        x="50"
        y="47"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: 18,
          fontFamily: "'Bellfair', serif",
          fill: "var(--text-primary, #fff)",
          fontWeight: 400,
        }}
      >
        {total.toLocaleString()}
      </text>

      {/* "Total" label */}
      <text
        x="50"
        y="62"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: 8,
          fontFamily: "'DM Sans', sans-serif",
          fill: "var(--text-dim, #888)",
          letterSpacing: "0.5px",
        }}
      >
        Total
      </text>
    </svg>
  )
}
