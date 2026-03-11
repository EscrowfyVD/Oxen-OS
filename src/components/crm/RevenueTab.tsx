"use client"

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, AMBER, RED, ROSE_GOLD, CHART_COLORS,
} from "./constants"
import type { MetricsData } from "./types"

interface RevenueTabProps {
  data: MetricsData | null
}

const fmt = (val: number, prefix = "€") =>
  `${prefix}${val >= 1_000_000
    ? `${(val / 1_000_000).toFixed(1)}M`
    : val >= 1_000
    ? `${(val / 1_000).toFixed(0)}K`
    : val.toFixed(0)}`

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 11,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ color: TEXT_TERTIARY, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function RevenueTab({ data }: RevenueTabProps) {
  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 13 }}>
        Loading revenue data...
      </div>
    )
  }

  const chartData = data.monthly.map((m) => ({
    month: m.month,
    GTV: m.gtv,
    Revenue: m.revenue,
  }))

  return (
    <div>
      {/* ── GTV & Revenue Trend Chart ── */}
      <div className="card fade-in" style={{ padding: 20, marginBottom: 20, animationDelay: "0.05s" }}>
        <div style={sectionTitle}>GTV & Revenue Trend</div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gtvGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ROSE_GOLD} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={ROSE_GOLD} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                axisLine={{ stroke: CHART_COLORS.grid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }} />
              <Area type="monotone" dataKey="GTV" stroke={ROSE_GOLD} strokeWidth={2} fill="url(#gtvGrad2)" />
              <Area type="monotone" dataKey="Revenue" stroke={GREEN} strokeWidth={2} fill="url(#revGrad2)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: TEXT_TERTIARY, fontSize: 12, textAlign: "center", padding: "60px 0" }}>
            No metrics data yet. Add monthly customer metrics to see trends.
          </div>
        )}
      </div>

      {/* ── Monthly Data Table ── */}
      <div className="card fade-in" style={{ overflow: "hidden", animationDelay: "0.1s" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <span style={sectionTitle}>Monthly Performance</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Month", "GTV", "GTV Growth", "Revenue", "Rev Growth", "Take Rate", "Tx Count", "Customers"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.monthly.length > 0 ? (
                [...data.monthly].reverse().map((m) => (
                  <tr key={m.month}>
                    <td style={{ ...tdStyle, fontWeight: 500, color: TEXT_PRIMARY }}>
                      {m.month}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "'Bellfair', serif", fontSize: 13 }}>
                      {fmt(m.gtv)}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: m.gtvGrowth > 0 ? GREEN : m.gtvGrowth < 0 ? RED : TEXT_TERTIARY,
                        }}
                      >
                        {m.gtvGrowth > 0 ? "+" : ""}{m.gtvGrowth}%
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "'Bellfair', serif", fontSize: 13 }}>
                      {fmt(m.revenue)}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: m.revenueGrowth > 0 ? GREEN : m.revenueGrowth < 0 ? RED : TEXT_TERTIARY,
                        }}
                      >
                        {m.revenueGrowth > 0 ? "+" : ""}{m.revenueGrowth}%
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                      {m.takeRate}%
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                      {m.txCount.toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                      {m.customerCount}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: "30px", color: TEXT_TERTIARY }}>
                    No monthly metrics data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: "'Bellfair', serif",
  color: FROST,
  marginBottom: 14,
}

const thStyle: React.CSSProperties = {
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
  padding: "10px 12px",
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: `1px solid ${CARD_BORDER}`,
}

const tdStyle: React.CSSProperties = {
  fontSize: 12,
  color: TEXT_PRIMARY,
  fontFamily: "'DM Sans', sans-serif",
  padding: "10px 12px",
  borderBottom: `1px solid ${CARD_BORDER}`,
}
