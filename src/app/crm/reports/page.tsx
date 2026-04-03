"use client"

import { useState, useEffect } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { TrendingUp, DollarSign, Briefcase, Trophy } from "lucide-react"
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  STAGE_COLORS as PIPELINE_STAGE_COLORS,
  DEAL_OWNERS,
  OWNER_COLORS,
  fmtCurrency,
  fmtCurrencyFull,
  CRM_COLORS,
} from "@/lib/crm-config"

/* ── Tokens ── */
const CARD_BG = CRM_COLORS.card_bg
const CARD_BORDER = CRM_COLORS.card_border
const TEXT_PRIMARY = CRM_COLORS.text_primary
const TEXT_SECONDARY = CRM_COLORS.text_secondary
const TEXT_TERTIARY = CRM_COLORS.text_tertiary
const ROSE_GOLD = CRM_COLORS.rose_gold
const GREEN = CRM_COLORS.green
const GLASS_BLUR = CRM_COLORS.glass_blur
const GLASS_SHADOW = CRM_COLORS.glass_shadow

const glassCard: React.CSSProperties = {
  background: CARD_BG,
  backdropFilter: GLASS_BLUR,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  padding: 22,
  boxShadow: GLASS_SHADOW,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
}

/* ── Types ── */
interface PipelineStage {
  stage: string
  count: number
  totalValue: number
  weightedTotal: number
}

interface RevenueEntry {
  source?: string
  vertical?: string
  count: number
  totalValue: number
}

interface DealForOwner {
  id: string
  dealOwner: string | null
  dealValue: number | null
  stage: string
  weightedValue: number | null
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "rgba(15,17,24,0.95)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "8px 12px" }}>
      <p style={{ fontSize: 11, color: TEXT_SECONDARY, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{label}</p>
      <p style={{ fontSize: 14, color: TEXT_PRIMARY, margin: "4px 0 0", fontFamily: "'Bellfair', serif" }}>
        {fmtCurrencyFull(payload[0].value)}
      </p>
    </div>
  )
}

export default function CrmReportsPage() {
  const [pipelineData, setPipelineData] = useState<PipelineStage[]>([])
  const [revenueBySource, setRevenueBySource] = useState<RevenueEntry[]>([])
  const [revenueByVertical, setRevenueByVertical] = useState<RevenueEntry[]>([])
  const [totalPipeline, setTotalPipeline] = useState(0)
  const [weightedPipeline, setWeightedPipeline] = useState(0)
  const [totalActiveDeals, setTotalActiveDeals] = useState(0)
  const [wonThisQuarter, setWonThisQuarter] = useState(0)
  const [allDeals, setAllDeals] = useState<DealForOwner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/crm/reports/pipeline").then((r) => r.json()),
      fetch("/api/crm/reports/revenue").then((r) => r.json()),
      fetch("/api/crm/deals").then((r) => r.json()),
    ])
      .then(([pipeRes, revRes, dealsRes]) => {
        const pipeline = pipeRes.pipeline
        if (pipeline) {
          setPipelineData(pipeline.byStage ?? [])
          const activeStages = (pipeline.byStage ?? []).filter(
            (s: PipelineStage) => s.stage !== "closed_won" && s.stage !== "closed_lost"
          )
          setTotalPipeline(activeStages.reduce((s: number, st: PipelineStage) => s + st.totalValue, 0))
          setWeightedPipeline(activeStages.reduce((s: number, st: PipelineStage) => s + st.weightedTotal, 0))
          setTotalActiveDeals(activeStages.reduce((s: number, st: PipelineStage) => s + st.count, 0))
        }

        const rev = revRes.revenue
        if (rev) {
          setRevenueBySource(rev.bySource ?? [])
          setRevenueByVertical(rev.byVertical ?? [])
        }

        // Deals for per-owner
        const deals = (dealsRes.deals ?? []) as DealForOwner[]
        setAllDeals(deals)

        // Won this quarter
        const now = new Date()
        const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        const wonQ = deals.filter(
          (d: DealForOwner) => d.stage === "closed_won"
        ).length
        setWonThisQuarter(wonQ)

        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Per-owner stats
  const ownerStats = DEAL_OWNERS.map((owner) => {
    const ownerDeals = allDeals.filter((d) => d.dealOwner === owner)
    const active = ownerDeals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
    const won = ownerDeals.filter((d) => d.stage === "closed_won")
    return {
      name: owner,
      color: OWNER_COLORS[owner] ?? ROSE_GOLD,
      dealCount: ownerDeals.length,
      pipelineValue: active.reduce((s, d) => s + (d.dealValue ?? 0), 0),
      wonDeals: won.length,
      wonRevenue: won.reduce((s, d) => s + (d.dealValue ?? 0), 0),
    }
  })

  // Chart data
  const pipelineChartData = pipelineData
    .filter((s) => s.stage !== "closed_won" && s.stage !== "closed_lost")
    .map((s) => ({
      name: STAGE_LABELS[s.stage] ?? s.stage,
      value: s.totalValue,
      color: PIPELINE_STAGE_COLORS[s.stage] ?? TEXT_TERTIARY,
    }))

  const sourceChartData = revenueBySource
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((s, i) => ({
      name: s.source ?? "Unknown",
      value: s.totalValue,
      color: [ROSE_GOLD, GREEN, CRM_COLORS.indigo, CRM_COLORS.amber, CRM_COLORS.cyan, CRM_COLORS.purple][i % 6],
    }))

  const verticalChartData = revenueByVertical
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((s, i) => ({
      name: s.vertical ?? "Unknown",
      value: s.totalValue,
      color: [ROSE_GOLD, GREEN, CRM_COLORS.indigo, CRM_COLORS.amber, CRM_COLORS.cyan, CRM_COLORS.purple][i % 6],
    }))

  if (loading) {
    return (
      <div style={{ padding: "80px 40px", color: TEXT_TERTIARY, textAlign: "center", background: "#060709", minHeight: "100vh" }}>
        Loading reports...
      </div>
    )
  }

  return (
    <div style={{ padding: "32px 40px", minHeight: "100vh", background: "#060709" }}>
      {/* Header */}
      <h1
        style={{
          fontFamily: "'Bellfair', serif",
          fontSize: 32,
          color: TEXT_PRIMARY,
          margin: 0,
          marginBottom: 6,
        }}
      >
        CRM Reports
      </h1>
      <p style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 28, fontFamily: "'DM Sans', sans-serif" }}>
        Pipeline analytics and revenue intelligence
      </p>

      {/* ─── KPI Row ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 28,
        }}
      >
        {[
          { label: "Total Pipeline Value", value: fmtCurrency(totalPipeline), icon: Briefcase, color: TEXT_PRIMARY },
          { label: "Weighted Pipeline", value: fmtCurrency(weightedPipeline), icon: TrendingUp, color: CRM_COLORS.indigo },
          { label: "Active Deals", value: String(totalActiveDeals), icon: DollarSign, color: CRM_COLORS.amber },
          { label: "Won This Quarter", value: String(wonThisQuarter), icon: Trophy, color: GREEN },
        ].map((kpi) => (
          <div key={kpi.label} style={glassCard}>
            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <kpi.icon size={14} strokeWidth={1.8} style={{ color: TEXT_TERTIARY }} />
              <span style={labelStyle}>{kpi.label}</span>
            </div>
            <span
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 28,
                color: kpi.color,
                lineHeight: 1,
              }}
            >
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Charts ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18, marginBottom: 28 }}>
        {/* Pipeline by Stage */}
        <div style={glassCard}>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 20, marginTop: 0 }}>
            Pipeline by Stage
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineChartData} barSize={36}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmtCurrency(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {pipelineChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Two-column: Revenue by Source + Revenue by Vertical */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={glassCard}>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 20, marginTop: 0 }}>
              Revenue by Source
            </h3>
            {sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourceChartData} barSize={28} layout="vertical">
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => fmtCurrency(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                    axisLine={false}
                    tickLine={false}
                    width={140}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sourceChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ fontSize: 12, color: TEXT_TERTIARY }}>No revenue data by source</p>
            )}
          </div>

          <div style={glassCard}>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 20, marginTop: 0 }}>
              Revenue by Vertical
            </h3>
            {verticalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={verticalChartData} barSize={28} layout="vertical">
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => fmtCurrency(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                    axisLine={false}
                    tickLine={false}
                    width={140}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {verticalChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ fontSize: 12, color: TEXT_TERTIARY }}>No revenue data by vertical</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Per-Owner Comparison ─── */}
      <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 14 }}>
        Per-Owner Comparison
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {ownerStats.map((owner) => (
          <div key={owner.name} style={{ ...glassCard, borderLeft: `3px solid ${owner.color}` }}>
            <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: `${owner.color}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontFamily: "'Bellfair', serif", fontSize: 14, color: owner.color }}>
                  {owner.name.split(" ").map((n) => n[0]).join("")}
                </span>
              </div>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>
                {owner.name}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <span style={labelStyle}>Total Deals</span>
                <p style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_PRIMARY, margin: "4px 0 0" }}>
                  {owner.dealCount}
                </p>
              </div>
              <div>
                <span style={labelStyle}>Pipeline Value</span>
                <p style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: CRM_COLORS.indigo, margin: "4px 0 0" }}>
                  {fmtCurrency(owner.pipelineValue)}
                </p>
              </div>
              <div>
                <span style={labelStyle}>Won Deals</span>
                <p style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: GREEN, margin: "4px 0 0" }}>
                  {owner.wonDeals}
                </p>
              </div>
              <div>
                <span style={labelStyle}>Won Revenue</span>
                <p style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: GREEN, margin: "4px 0 0" }}>
                  {fmtCurrency(owner.wonRevenue)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
