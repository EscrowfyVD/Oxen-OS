"use client"

interface DataPoint {
  label: string
  value: number
}

interface RevenueChartProps {
  data: DataPoint[]
}

export default function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) return null

  const maxValue = Math.max(...data.map((d) => d.value))

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        height: 120,
        width: "100%",
      }}
    >
      {data.map((item, i) => {
        const heightPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0
        const isLast = i === data.length - 1

        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              height: "100%",
              justifyContent: "flex-end",
            }}
          >
            {/* Bar */}
            <div
              style={{
                width: "100%",
                maxWidth: 32,
                height: `${heightPercent}%`,
                minHeight: 4,
                borderRadius: "4px 4px 0 0",
                background: isLast
                  ? "linear-gradient(180deg, #C08B88, #A07270)"
                  : "rgba(255,255,255,0.12)",
                transition: "height 0.4s ease",
              }}
            />

            {/* Label */}
            <span
              style={{
                fontSize: 9,
                color: "var(--text-dim, #888)",
                fontFamily: "'DM Sans', sans-serif",
                marginTop: 6,
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
