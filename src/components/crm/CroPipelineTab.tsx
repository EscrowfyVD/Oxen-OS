"use client"

import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"
import Counter from "@/components/dashboard/Counter"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, AMBER, RED, ROSE_GOLD, INDIGO, CYAN, TEAL,
  DEAL_STAGES, STAGE_COLORS, CHART_COLORS,
} from "./constants"
import type { PipelineData, Deal } from "./types"

interface CroPipelineTabProps {
  data: PipelineData | null
  onNewDeal: () => void
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
      <div style={{ color: TEXT_TERTIARY, marginBottom: 6, textTransform: "capitalize" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number" ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

export default function CroPipelineTab({ data, onNewDeal }: CroPipelineTabProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null)

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 13 }}>
        Loading pipeline...
      </div>
    )
  }

  const stageChartData = data.byStage.map((s) => ({
    stage: s.stage.replace("_", " "),
    "Expected Revenue": s.expectedRevenue,
    "Weighted Revenue": s.weightedRevenue,
    count: s.count,
  }))

  const filteredDeals = selectedStage
    ? data.deals.filter((d) => d.stage === selectedStage)
    : data.deals

  const formatDate = (iso: string | null) => {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    })
  }

  return (
    <div>
      {/* ── Pipeline KPIs ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 20,
          animationDelay: "0.05s",
        }}
      >
        <div className="kpi-card" style={{ padding: 18 }}>
          <div style={kpiLabel}>Total Deals</div>
          <div style={kpiValue}><Counter target={data.totalDeals} /></div>
        </div>
        <div className="kpi-card" style={{ padding: 18 }}>
          <div style={kpiLabel}>Expected Revenue</div>
          <div style={kpiValue}><Counter target={data.totalExpectedRevenue} prefix="€" /></div>
        </div>
        <div className="kpi-card" style={{ padding: 18 }}>
          <div style={kpiLabel}>Weighted Revenue</div>
          <div style={kpiValue}><Counter target={data.totalWeightedRevenue} prefix="€" /></div>
        </div>
        <div className="kpi-card" style={{ padding: 18 }}>
          <div style={kpiLabel}>Avg Probability</div>
          <div style={kpiValue}>
            <Counter target={data.avgProbability} />
            <span style={{ fontSize: 16, color: TEXT_SECONDARY }}>%</span>
          </div>
        </div>
      </div>

      {/* ── Stage Chart + Bowtie ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
          animationDelay: "0.1s",
        }}
      >
        {/* Stage Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={sectionTitle}>Pipeline by Stage</div>
          {stageChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
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
                <Bar dataKey="Expected Revenue" fill={ROSE_GOLD} radius={[4, 4, 0, 0]} opacity={0.4} />
                <Bar dataKey="Weighted Revenue" fill={GREEN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: TEXT_TERTIARY, fontSize: 12, textAlign: "center", padding: "40px 0" }}>
              No deals yet
            </div>
          )}
        </div>

        {/* Bowtie Model */}
        <div className="card" style={{ padding: 20 }}>
          <div style={sectionTitle}>Bowtie Model</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {DEAL_STAGES.map((stage, i) => {
              const stageData = data.byStage.find((s) => s.stage === stage.id)
              const count = stageData?.count ?? 0
              const maxCount = Math.max(...data.byStage.map((s) => s.count), 1)
              const barWidth = (count / maxCount) * 100
              const isPreSale = i < 4
              const isCommit = i === 4

              return (
                <div
                  key={stage.id}
                  onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
                  style={{
                    cursor: "pointer",
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${selectedStage === stage.id ? stage.accent : "transparent"}`,
                    background: selectedStage === stage.id ? "rgba(255,255,255,0.02)" : "transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isCommit && (
                        <span style={{ fontSize: 9, color: GREEN, fontWeight: 600 }}>▶</span>
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          color: isPreSale ? TEXT_SECONDARY : stage.accent,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {stage.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {count} deal{count !== 1 ? "s" : ""} · {fmt(stageData?.expectedRevenue ?? 0)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.04)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barWidth}%`,
                        borderRadius: 2,
                        background: stage.accent,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Win/Loss this quarter */}
          <div style={{ display: "flex", gap: 12, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: GREEN }} />
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                Won this quarter: <strong style={{ color: FROST }}>{data.wonThisQuarter}</strong>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: RED }} />
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                Lost this quarter: <strong style={{ color: FROST }}>{data.lostThisQuarter}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Deals Table ── */}
      <div className="card fade-in" style={{ overflow: "hidden", animationDelay: "0.15s" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: `1px solid ${CARD_BORDER}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={sectionTitle}>
              {selectedStage
                ? `${selectedStage.replace("_", " ").replace(/^./, (c) => c.toUpperCase())} Deals`
                : "All Deals"}
            </span>
            {selectedStage && (
              <button
                onClick={() => setSelectedStage(null)}
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: TEXT_TERTIARY,
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Clear filter
              </button>
            )}
          </div>
          <button className="header-btn" onClick={onNewDeal} style={{ fontSize: 11, padding: "6px 14px" }}>
            + New Deal
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Deal", "Customer", "Stage", "Volume", "Rate", "Revenue", "Prob", "Close Date", "Assigned"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((deal) => {
                const sc = STAGE_COLORS[deal.stage] || STAGE_COLORS.discovery
                return (
                  <tr
                    key={deal.id}
                    style={{ transition: "background 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{deal.name}</span>
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                      {deal.contact?.company || deal.contact?.name || "—"}
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
                          background: sc.bg,
                          color: sc.text,
                        }}
                      >
                        {deal.stage.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Bellfair', serif", fontSize: 13 }}>
                      {deal.expectedVolume != null ? fmt(deal.expectedVolume) : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: TEXT_SECONDARY, fontSize: 11 }}>
                      {deal.takeRate != null ? `${deal.takeRate}%` : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Bellfair', serif", fontSize: 13 }}>
                      {deal.expectedRevenue != null ? fmt(deal.expectedRevenue) : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: deal.probability >= 80 ? GREEN : deal.probability >= 50 ? AMBER : TEXT_SECONDARY,
                        }}
                      >
                        {deal.probability}%
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_TERTIARY, fontSize: 11 }}>
                      {formatDate(deal.closeDate)}
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY, fontSize: 11 }}>
                      {deal.assignedTo || "—"}
                    </td>
                  </tr>
                )
              })}
              {filteredDeals.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: "30px", color: TEXT_TERTIARY }}>
                    {selectedStage ? "No deals in this stage" : "No deals yet — click \"+ New Deal\" to create one"}
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
  marginBottom: 0,
}

const thStyle: React.CSSProperties = {
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
  padding: "10px 10px",
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: `1px solid ${CARD_BORDER}`,
}

const tdStyle: React.CSSProperties = {
  fontSize: 12,
  color: TEXT_PRIMARY,
  fontFamily: "'DM Sans', sans-serif",
  padding: "10px 10px",
  borderBottom: `1px solid ${CARD_BORDER}`,
}
