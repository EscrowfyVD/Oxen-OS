"use client"

import { useState, useEffect, useCallback } from "react"
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  GREEN, RED, ROSE_GOLD, INDIGO, AMBER, CYAN, TEAL,
  CHART_COLORS, ENTITIES, getCategoryLabel, fmtFull, fmt,
} from "./constants"

type ReportType = "pnl" | "cashflow" | "entity_comparison"

const cardStyle: React.CSSProperties = {
  background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20,
}
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, marginBottom: 14,
}
const selectStyle: React.CSSProperties = {
  background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "6px 10px",
  color: TEXT_PRIMARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif", outline: "none",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: TEXT_TERTIARY, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>{p.name}: {fmtFull(p.value)}</div>
      ))}
    </div>
  )
}

const ENTITY_COLORS = [GREEN, ROSE_GOLD, INDIGO, AMBER]

export default function ReportsTab() {
  const [reportType, setReportType] = useState<ReportType>("pnl")
  const [entity, setEntity] = useState("all")
  const [dateFrom, setDateFrom] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0])
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: reportType, dateFrom, dateTo })
      if (entity !== "all") params.set("entity", entity)
      const res = await fetch(`/api/finance/reports?${params}`)
      const data = await res.json()
      setReport(data.report)
    } catch { setReport(null) }
    setLoading(false)
  }, [reportType, entity, dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} style={selectStyle}>
          <option value="pnl">P&L Report</option>
          <option value="cashflow">Cash Flow</option>
          <option value="entity_comparison">Entity Comparison</option>
        </select>
        {reportType !== "entity_comparison" && (
          <select value={entity} onChange={(e) => setEntity(e.target.value)} style={selectStyle}>
            <option value="all">All Entities</option>
            {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        )}
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          style={{ ...selectStyle, colorScheme: "dark" }} />
        <span style={{ color: TEXT_TERTIARY, fontSize: 11 }}>to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          style={{ ...selectStyle, colorScheme: "dark" }} />
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 13 }}>Loading report...</div>
      )}

      {!loading && report?.type === "pnl" && <PnLReport report={report} />}
      {!loading && report?.type === "cashflow" && <CashFlowReport report={report} />}
      {!loading && report?.type === "entity_comparison" && <EntityComparisonReport report={report} />}
    </div>
  )
}

function PnLReport({ report }: { report: any }) {
  const { months, totals, revenueCategories, expenseCategories } = report

  const chartData = months.map((m: any) => ({
    month: m.month.substring(5),
    Revenue: m.totalRevenue,
    Expenses: m.totalExpenses,
    Profit: m.netProfit,
  }))

  const thStyle: React.CSSProperties = {
    padding: "8px 10px", fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY,
    textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${CARD_BORDER}`,
    fontFamily: "'DM Sans', sans-serif", textAlign: "right",
  }
  const tdStyle: React.CSSProperties = {
    padding: "6px 10px", fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif",
    textAlign: "right", borderBottom: `1px solid rgba(255,255,255,0.03)`,
  }

  return (
    <div>
      {/* Chart */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={sectionTitle}>P&L Trend</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} />
            <Bar dataKey="Revenue" fill={GREEN} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill={ROSE_GOLD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* P&L Table */}
      <div style={{ ...cardStyle, overflowX: "auto" }}>
        <div style={sectionTitle}>Profit & Loss Statement</div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left" }}>Category</th>
              {months.map((m: any) => <th key={m.month} style={thStyle}>{m.month.substring(5)}</th>)}
              <th style={{ ...thStyle, color: TEXT_PRIMARY }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Revenue section */}
            <tr>
              <td colSpan={months.length + 2} style={{ padding: "10px 10px 4px", fontSize: 11, fontWeight: 600, color: GREEN, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif" }}>
                Revenue
              </td>
            </tr>
            {revenueCategories.map((cat: string) => (
              <tr key={cat}>
                <td style={{ ...tdStyle, textAlign: "left" }}>{getCategoryLabel(cat)}</td>
                {months.map((m: any) => <td key={m.month} style={tdStyle}>{m.revenue[cat] ? fmtFull(m.revenue[cat]) : "—"}</td>)}
                <td style={{ ...tdStyle, fontWeight: 500 }}>
                  {fmtFull(months.reduce((s: number, m: any) => s + (m.revenue[cat] || 0), 0))}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
              <td style={{ ...tdStyle, textAlign: "left", fontWeight: 600, color: GREEN }}>Total Revenue</td>
              {months.map((m: any) => <td key={m.month} style={{ ...tdStyle, fontWeight: 600, color: GREEN }}>{fmtFull(m.totalRevenue)}</td>)}
              <td style={{ ...tdStyle, fontWeight: 600, color: GREEN }}>{fmtFull(totals.revenue)}</td>
            </tr>

            {/* Expenses section */}
            <tr>
              <td colSpan={months.length + 2} style={{ padding: "14px 10px 4px", fontSize: 11, fontWeight: 600, color: ROSE_GOLD, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif" }}>
                Expenses
              </td>
            </tr>
            {expenseCategories.map((cat: string) => (
              <tr key={cat}>
                <td style={{ ...tdStyle, textAlign: "left" }}>{getCategoryLabel(cat)}</td>
                {months.map((m: any) => <td key={m.month} style={tdStyle}>{m.expenses[cat] ? fmtFull(m.expenses[cat]) : "—"}</td>)}
                <td style={{ ...tdStyle, fontWeight: 500 }}>
                  {fmtFull(months.reduce((s: number, m: any) => s + (m.expenses[cat] || 0), 0))}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
              <td style={{ ...tdStyle, textAlign: "left", fontWeight: 600, color: ROSE_GOLD }}>Total Expenses</td>
              {months.map((m: any) => <td key={m.month} style={{ ...tdStyle, fontWeight: 600, color: ROSE_GOLD }}>{fmtFull(m.totalExpenses)}</td>)}
              <td style={{ ...tdStyle, fontWeight: 600, color: ROSE_GOLD }}>{fmtFull(totals.expenses)}</td>
            </tr>

            {/* Net Profit */}
            <tr style={{ borderTop: `2px solid ${CARD_BORDER}` }}>
              <td style={{ padding: "12px 10px", textAlign: "left", fontSize: 14, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY }}>Net Profit</td>
              {months.map((m: any) => (
                <td key={m.month} style={{ padding: "12px 10px", textAlign: "right", fontSize: 12, fontWeight: 600, color: m.netProfit >= 0 ? GREEN : RED, fontFamily: "'DM Sans', sans-serif" }}>
                  {fmtFull(m.netProfit)}
                </td>
              ))}
              <td style={{ padding: "12px 10px", textAlign: "right", fontSize: 14, fontFamily: "'Bellfair', serif", color: totals.netProfit >= 0 ? GREEN : RED }}>
                {fmtFull(totals.netProfit)}
              </td>
            </tr>

            {/* Margin */}
            <tr>
              <td style={{ ...tdStyle, textAlign: "left", color: TEXT_TERTIARY }}>Margin</td>
              {months.map((m: any) => (
                <td key={m.month} style={{ ...tdStyle, color: m.margin >= 0 ? GREEN : RED, fontSize: 10 }}>
                  {m.margin.toFixed(1)}%
                </td>
              ))}
              <td style={{ ...tdStyle, fontWeight: 500, color: totals.margin >= 0 ? GREEN : RED }}>
                {totals.margin.toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CashFlowReport({ report }: { report: any }) {
  const { months, currentCash, totalInflow, totalOutflow } = report

  const chartData = months.map((m: any) => ({
    month: m.month.substring(5),
    Inflow: m.inflow,
    Outflow: m.outflow,
    Net: m.net,
  }))

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
        {[
          { label: "Current Cash", value: fmtFull(currentCash), color: TEXT_PRIMARY },
          { label: "Total Inflow", value: fmtFull(totalInflow), color: GREEN },
          { label: "Total Outflow", value: fmtFull(totalOutflow), color: ROSE_GOLD },
          { label: "Net Flow", value: fmtFull(totalInflow - totalOutflow), color: totalInflow - totalOutflow >= 0 ? GREEN : RED },
        ].map((kpi) => (
          <div key={kpi.label} className="kpi-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 24, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={sectionTitle}>Monthly Cash Flow</div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={GREEN} stopOpacity={0.3} />
                <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ROSE_GOLD} stopOpacity={0.3} />
                <stop offset="95%" stopColor={ROSE_GOLD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} />
            <Area type="monotone" dataKey="Inflow" stroke={GREEN} fill="url(#inflowGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="Outflow" stroke={ROSE_GOLD} fill="url(#outflowGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly detail table */}
      <div style={{ ...cardStyle, overflowX: "auto" }}>
        <div style={sectionTitle}>Monthly Breakdown</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Month", "Inflow", "Outflow", "Net"].map((h) => (
                <th key={h} style={{ textAlign: h === "Month" ? "left" : "right", padding: "8px 12px", fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${CARD_BORDER}`, fontFamily: "'DM Sans', sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m: any) => (
              <tr key={m.month}>
                <td style={{ padding: "8px 12px", fontSize: 12, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{m.month}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: GREEN, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{fmtFull(m.inflow)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: ROSE_GOLD, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{fmtFull(m.outflow)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, color: m.net >= 0 ? GREEN : RED, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{fmtFull(m.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EntityComparisonReport({ report }: { report: any }) {
  const { entities } = report

  const chartData = entities.map((e: any) => ({
    name: ENTITIES.find((ent) => ent.id === e.entity)?.label || e.entity,
    Revenue: e.revenue,
    Expenses: e.expenses,
    Profit: e.netProfit,
  }))

  return (
    <div>
      {/* Chart */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={sectionTitle}>Entity Comparison</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} />
            <Bar dataKey="Revenue" fill={GREEN} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill={ROSE_GOLD} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Profit" fill={INDIGO} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Entity cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {entities.map((e: any, i: number) => {
          const label = ENTITIES.find((ent) => ent.id === e.entity)?.label || e.entity
          return (
            <div key={e.entity} style={{ ...cardStyle, borderLeft: `3px solid ${ENTITY_COLORS[i % ENTITY_COLORS.length]}` }}>
              <div style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: TEXT_PRIMARY, marginBottom: 12 }}>{label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Revenue</div>
                  <div style={{ fontSize: 16, fontFamily: "'Bellfair', serif", color: GREEN }}>{fmtFull(e.revenue)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Expenses</div>
                  <div style={{ fontSize: 16, fontFamily: "'Bellfair', serif", color: ROSE_GOLD }}>{fmtFull(e.expenses)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Net Profit</div>
                  <div style={{ fontSize: 16, fontFamily: "'Bellfair', serif", color: e.netProfit >= 0 ? GREEN : RED }}>{fmtFull(e.netProfit)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Margin</div>
                  <div style={{ fontSize: 16, fontFamily: "'Bellfair', serif", color: e.margin >= 0 ? GREEN : RED }}>{e.margin.toFixed(1)}%</div>
                </div>
              </div>
              {e.cashBalance > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
                  <div style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>Cash Balance</div>
                  <div style={{ fontSize: 18, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY }}>{fmtFull(e.cashBalance)}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
