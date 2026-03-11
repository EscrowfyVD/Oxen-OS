"use client"

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import Counter from "@/components/dashboard/Counter"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, AMBER, INDIGO, RED, ROSE_GOLD, CHART_COLORS,
  FORECAST_BUCKETS, STAGE_COLORS,
} from "./constants"
import type { ForecastData, ForecastBucket } from "./types"

interface ForecastTabProps {
  data: ForecastData | null
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

export default function ForecastTab({ data }: ForecastTabProps) {
  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 13 }}>
        Loading forecast...
      </div>
    )
  }

  const projChartData = data.projections.map((p) => ({
    month: p.month,
    Base: p.base,
    Committed: p.base + p.committed,
    "Best Case": p.base + p.committed + p.probable,
    Upside: p.base + p.committed + p.probable + p.stretch,
  }))

  const buckets: { key: "committed" | "probable" | "stretch"; bucket: ForecastBucket; color: string; label: string; confidence: string }[] = [
    { key: "committed", bucket: data.committed, color: GREEN, label: "Committed", confidence: "90%" },
    { key: "probable", bucket: data.probable, color: AMBER, label: "Best Case", confidence: "70%" },
    { key: "stretch", bucket: data.stretch, color: INDIGO, label: "Upside", confidence: "50%" },
  ]

  const totalWeighted = buckets.reduce((s, b) => s + b.bucket.weightedRevenue, 0)

  const formatDate = (iso: string | null) => {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })
  }

  return (
    <div>
      {/* ── Forecast Buckets ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 20,
          animationDelay: "0.05s",
        }}
      >
        {buckets.map((b) => (
          <div
            key={b.key}
            className="card"
            style={{
              padding: 20,
              borderLeft: `3px solid ${b.color}`,
              background: `linear-gradient(135deg, ${CARD_BG} 0%, ${b.key === "committed" ? "rgba(52,211,153,0.03)" : b.key === "probable" ? "rgba(251,191,36,0.03)" : "rgba(129,140,248,0.03)"} 100%)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 10,
                  color: b.color,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                }}
              >
                {b.label}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: TEXT_TERTIARY,
                  fontFamily: "'DM Sans', sans-serif",
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                {b.confidence} confidence
              </span>
            </div>

            <div
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 28,
                fontWeight: 400,
                color: FROST,
                lineHeight: 1,
                marginBottom: 8,
              }}
            >
              {fmt(b.bucket.totalRevenue)}
            </div>

            <div style={{ display: "flex", gap: 12, fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
              <span>{b.bucket.count} deal{b.bucket.count !== 1 ? "s" : ""}</span>
              <span>Weighted: {fmt(b.bucket.weightedRevenue)}</span>
            </div>

            {/* Deal list */}
            {b.bucket.deals.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
                {b.bucket.deals.slice(0, 5).map((deal) => {
                  const sc = STAGE_COLORS[deal.stage] || STAGE_COLORS.discovery
                  return (
                    <div
                      key={deal.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "5px 0",
                        borderBottom: `1px solid ${CARD_BORDER}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: TEXT_PRIMARY, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {deal.name}
                        </div>
                        <div style={{ fontSize: 9, color: TEXT_TERTIARY }}>
                          {deal.contact?.company || deal.contact?.name || "—"} · {formatDate(deal.closeDate)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", marginLeft: 8 }}>
                        <div style={{ fontFamily: "'Bellfair', serif", fontSize: 12, color: FROST }}>
                          {fmt(deal.expectedRevenue ?? 0)}
                        </div>
                        <div style={{ fontSize: 9, color: TEXT_TERTIARY }}>{deal.probability}%</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Summary KPI + Projection Chart ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 16,
          animationDelay: "0.1s",
        }}
      >
        {/* Summary */}
        <div className="card" style={{ padding: 20 }}>
          <div style={sectionTitle}>Forecast Summary</div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Current Monthly Revenue
            </div>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 24, color: FROST }}>
              {fmt(data.currentMonthlyRevenue)}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Total Weighted Pipeline
            </div>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 24, color: FROST }}>
              {fmt(totalWeighted)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              Projected Run Rate
            </div>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 24, color: FROST }}>
              {fmt((data.currentMonthlyRevenue + totalWeighted) * 12)}
            </div>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 2 }}>annualized</div>
          </div>
        </div>

        {/* Projection Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={sectionTitle}>Revenue Projection (6 months)</div>
          {projChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={projChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TEXT_SECONDARY} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={TEXT_SECONDARY} stopOpacity={0} />
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
                <Area type="monotone" dataKey="Upside" stroke={INDIGO} strokeWidth={1} strokeDasharray="5 5" fill="none" />
                <Area type="monotone" dataKey="Best Case" stroke={AMBER} strokeWidth={1} strokeDasharray="3 3" fill="none" />
                <Area type="monotone" dataKey="Committed" stroke={GREEN} strokeWidth={2} fill="none" />
                <Area type="monotone" dataKey="Base" stroke={TEXT_SECONDARY} strokeWidth={2} fill="url(#baseGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: TEXT_TERTIARY, fontSize: 12, textAlign: "center", padding: "60px 0" }}>
              Add deals with close dates to see projections
            </div>
          )}
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
