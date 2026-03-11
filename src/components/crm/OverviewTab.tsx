"use client"

import { useMemo } from "react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import Counter from "@/components/dashboard/Counter"
import Sparkline from "@/components/dashboard/Sparkline"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, AMBER, RED, ROSE_GOLD, INDIGO,
  HEALTH_COLORS, CHART_COLORS,
} from "./constants"
import type { OverviewData } from "./types"

interface OverviewTabProps {
  data: OverviewData | null
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

export default function OverviewTab({ data }: OverviewTabProps) {
  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 13 }}>
        Loading overview...
      </div>
    )
  }

  const sparkData = data.revenueTrend.length >= 2
    ? data.revenueTrend.map((r) => r.revenue)
    : [0, 1, 2, 3, 2, 4]

  const chartData = data.revenueTrend.map((r) => ({
    month: r.month.substring(5),
    GTV: r.gtv,
    Revenue: r.revenue,
  }))

  return (
    <div>
      {/* ── KPI Cards ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 14,
          marginBottom: 20,
          animationDelay: "0.05s",
        }}
      >
        {/* Monthly GTV */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Monthly GTV</div>
          <div style={kpiValue}>
            <Counter target={data.monthlyGtv} prefix="€" />
          </div>
          <div style={{ position: "absolute", bottom: 8, right: 10, opacity: 0.5 }}>
            <Sparkline data={sparkData} color={ROSE_GOLD} width={70} height={24} />
          </div>
        </div>

        {/* Net Revenue */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Net Revenue</div>
          <div style={kpiValue}>
            <Counter target={data.monthlyRevenue} prefix="€" />
          </div>
          <div style={{ position: "absolute", bottom: 8, right: 10, opacity: 0.5 }}>
            <Sparkline data={sparkData} color={GREEN} width={70} height={24} />
          </div>
        </div>

        {/* Take Rate */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Take Rate</div>
          <div style={kpiValue}>
            <Counter target={data.avgTakeRate} />
            <span style={{ fontSize: 16, color: TEXT_SECONDARY }}>%</span>
          </div>
          <div style={{ position: "absolute", bottom: 8, right: 10, opacity: 0.5 }}>
            <Sparkline data={sparkData} color={AMBER} width={70} height={24} />
          </div>
        </div>

        {/* Revenue Run Rate */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Revenue Run Rate</div>
          <div style={kpiValue}>
            <Counter target={data.revenueRunRate} prefix="€" />
          </div>
          <div style={{ position: "absolute", bottom: 8, right: 10, opacity: 0.5 }}>
            <Sparkline data={sparkData} color={INDIGO} width={70} height={24} />
          </div>
        </div>

        {/* Active Customers */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Active Customers</div>
          <div style={kpiValue}>
            <Counter target={data.activeCustomers} />
          </div>
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
            of {data.totalContacts} total
          </div>
        </div>
      </div>

      {/* ── Revenue Trend + Alerts & Actions ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16,
          marginBottom: 20,
          animationDelay: "0.1s",
        }}
      >
        {/* Revenue Trend Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={sectionTitle}>Revenue Trend</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gtvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.gtv} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.gtv} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
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
                <Legend
                  wrapperStyle={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                />
                <Area
                  type="monotone"
                  dataKey="GTV"
                  stroke={CHART_COLORS.gtv}
                  strokeWidth={2}
                  fill="url(#gtvGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="Revenue"
                  stroke={CHART_COLORS.revenue}
                  strokeWidth={2}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: TEXT_TERTIARY, fontSize: 12, textAlign: "center", padding: "40px 0" }}>
              No revenue data yet. Add customer metrics to see trends.
            </div>
          )}
        </div>

        {/* Alerts & Actions */}
        <div className="card" style={{ padding: 20 }}>
          <div style={sectionTitle}>Alerts & Actions</div>
          {data.alerts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.alerts.map((alert) => {
                const hc = HEALTH_COLORS[alert.healthStatus] || HEALTH_COLORS.watch
                return (
                  <div
                    key={alert.id}
                    style={{
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${CARD_BORDER}`,
                      borderLeft: `3px solid ${hc.text}`,
                      borderRadius: "0 6px 6px 0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>
                        {alert.company || alert.name}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          fontWeight: 500,
                          padding: "2px 6px",
                          borderRadius: 8,
                          background: hc.bg,
                          color: hc.text,
                        }}
                      >
                        {alert.healthStatus.replace("_", " ")}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      GTV: {fmt(alert.monthlyGtv ?? 0)} · Rev: {fmt(alert.monthlyRevenue ?? 0)}
                      {alert.segment && ` · ${alert.segment}`}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ color: TEXT_TERTIARY, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              No alerts — all customers healthy
            </div>
          )}

          {/* Health Distribution */}
          <div style={{ marginTop: 16 }}>
            <div style={{ ...sectionTitle, fontSize: 11, marginBottom: 10 }}>Health Distribution</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {data.healthDistribution.map((h) => {
                const hc = HEALTH_COLORS[h.status] || HEALTH_COLORS.healthy
                return (
                  <div
                    key={h.status}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: hc.bg,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14, fontFamily: "'Bellfair', serif", color: hc.text }}>
                      {h.count}
                    </span>
                    <span style={{ fontSize: 9, color: hc.text, textTransform: "capitalize", fontFamily: "'DM Sans', sans-serif" }}>
                      {h.status.replace("_", " ")}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Volume Concentration + Top Customers ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 16,
          animationDelay: "0.15s",
        }}
      >
        {/* Volume Concentration Meter */}
        <div className="card" style={{ padding: 20 }}>
          <div style={sectionTitle}>Volume Concentration</div>
          <div style={{ marginTop: 8 }}>
            {/* Stacked bar */}
            <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
              {data.concentration.top1Pct > 0 && (
                <div style={{ width: `${data.concentration.top1Pct}%`, background: RED, transition: "width 0.6s" }} />
              )}
              {data.concentration.top2to5Pct > 0 && (
                <div style={{ width: `${data.concentration.top2to5Pct}%`, background: AMBER, transition: "width 0.6s" }} />
              )}
              {data.concentration.top6to10Pct > 0 && (
                <div style={{ width: `${data.concentration.top6to10Pct}%`, background: INDIGO, transition: "width 0.6s" }} />
              )}
              {data.concentration.restPct > 0 && (
                <div style={{ width: `${data.concentration.restPct}%`, background: GREEN, transition: "width 0.6s" }} />
              )}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Top 1", pct: data.concentration.top1Pct, color: RED },
                { label: "Top 2-5", pct: data.concentration.top2to5Pct, color: AMBER },
                { label: "Top 6-10", pct: data.concentration.top6to10Pct, color: INDIGO },
                { label: "Rest", pct: data.concentration.restPct, color: GREEN },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 13, fontFamily: "'Bellfair', serif", color: FROST }}>
                    {item.pct}%
                  </span>
                </div>
              ))}
            </div>

            {data.concentration.top1Pct > 30 && (
              <div
                style={{
                  marginTop: 14,
                  padding: "8px 10px",
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  borderRadius: 6,
                  fontSize: 10,
                  color: RED,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ⚠ High concentration risk — top customer represents {data.concentration.top1Pct}% of volume
              </div>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="card" style={{ padding: 20 }}>
          <div style={sectionTitle}>Top Customers by GTV</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Customer", "Segment", "Monthly GTV", "Revenue", "Rate", "Health"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((c, i) => {
                  const hc = HEALTH_COLORS[c.healthStatus] || HEALTH_COLORS.healthy
                  return (
                    <tr key={c.id}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 500 }}>{c.company || c.name}</span>
                        {c.company && (
                          <div style={{ fontSize: 10, color: TEXT_TERTIARY }}>{c.name}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: TEXT_SECONDARY, fontSize: 10 }}>
                        {c.segment || "—"}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "'Bellfair', serif", fontSize: 13 }}>
                        {fmt(c.monthlyGtv ?? 0)}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "'Bellfair', serif", fontSize: 13 }}>
                        {fmt(c.monthlyRevenue ?? 0)}
                      </td>
                      <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                        {c.takeRate != null ? `${c.takeRate}%` : "—"}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontSize: 9,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            fontWeight: 500,
                            padding: "2px 6px",
                            borderRadius: 8,
                            background: hc.bg,
                            color: hc.text,
                          }}
                        >
                          {c.healthStatus.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {data.topCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: "20px", color: TEXT_TERTIARY }}>
                      No active customers yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Shared inline styles ── */
const kpiLabel: React.CSSProperties = {
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1.5,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
  marginBottom: 6,
}

const kpiValue: React.CSSProperties = {
  fontFamily: "'Bellfair', serif",
  fontSize: 28,
  fontWeight: 400,
  color: FROST,
  lineHeight: 1,
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
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: `1px solid ${CARD_BORDER}`,
  whiteSpace: "nowrap",
}

const tdStyle: React.CSSProperties = {
  fontSize: 12,
  color: TEXT_PRIMARY,
  fontFamily: "'DM Sans', sans-serif",
  padding: "8px 10px",
  borderBottom: `1px solid ${CARD_BORDER}`,
}
