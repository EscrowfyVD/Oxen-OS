"use client"

import { useMemo } from "react"
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import Counter from "@/components/dashboard/Counter"
import Sparkline from "@/components/dashboard/Sparkline"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  GREEN, RED, AMBER, INDIGO, ROSE_GOLD, CYAN,
  CHART_COLORS, DONUT_COLORS, fmt, fmtFull, getCategoryLabel,
} from "./constants"
import type { FinanceSummary, FinanceGoal } from "./types"

interface OverviewTabProps {
  summary: FinanceSummary | null
  goals: FinanceGoal[]
  cashBalance: number
}

const kpiLabel: React.CSSProperties = {
  fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 6,
}
const kpiValue: React.CSSProperties = {
  fontFamily: "'Bellfair', serif", fontSize: 28, color: TEXT_PRIMARY, lineHeight: 1.1,
}
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, marginBottom: 14,
}
const cardStyle: React.CSSProperties = {
  background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20,
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: TEXT_TERTIARY, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {fmtFull(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function OverviewTab({ summary, goals, cashBalance }: OverviewTabProps) {
  if (!summary) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 13 }}>
        Loading overview...
      </div>
    )
  }

  const revenueSparkData = summary.monthlyTrend.length >= 2
    ? summary.monthlyTrend.map((r) => r.revenue)
    : [0, 1, 2, 3, 2, 4]

  const expenseSparkData = summary.monthlyTrend.length >= 2
    ? summary.monthlyTrend.map((r) => r.expense)
    : [0, 1, 2, 3, 2, 4]

  const profitSparkData = summary.monthlyTrend.length >= 2
    ? summary.monthlyTrend.map((r) => r.profit)
    : [0, 1, 2, 3, 2, 4]

  const runway = summary.burnRate > 0 ? cashBalance / summary.burnRate : 0

  const barData = summary.monthlyTrend.map((r) => ({
    month: r.month.substring(5),
    Revenue: r.revenue,
    Expenses: r.expense,
  }))

  const budgetActualData = summary.budgetVsActual.map((b) => ({
    category: getCategoryLabel(b.category),
    Budget: b.budget,
    Actual: b.actual,
  }))

  // P&L table data
  const pnlRevenue = summary.revenueByCategory
  const pnlExpenses = summary.budgetVsActual
  const totalBudget = pnlExpenses.reduce((s, e) => s + e.budget, 0)
  const totalActual = pnlExpenses.reduce((s, e) => s + e.actual, 0)

  return (
    <div>
      {/* ── KPI Cards ── */}
      <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 20, animationDelay: "0.05s" }}>
        {/* Monthly Revenue */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Monthly Revenue</div>
          <div style={kpiValue}><Counter target={summary.revenue} prefix="\u20AC" /></div>
          <div style={{ position: "absolute", bottom: 8, right: 10, opacity: 0.5 }}>
            <Sparkline data={revenueSparkData} color={GREEN} width={70} height={24} />
          </div>
        </div>

        {/* Monthly Expenses */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Monthly Expenses</div>
          <div style={kpiValue}><Counter target={summary.expenses} prefix="\u20AC" /></div>
          <div style={{ position: "absolute", bottom: 8, right: 10, opacity: 0.5 }}>
            <Sparkline data={expenseSparkData} color={ROSE_GOLD} width={70} height={24} />
          </div>
        </div>

        {/* Net Profit */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Net Profit</div>
          <div style={{ ...kpiValue, color: summary.netProfit >= 0 ? GREEN : RED }}>
            <Counter target={summary.netProfit} prefix="\u20AC" />
          </div>
          <div style={{ position: "absolute", bottom: 8, right: 10, opacity: 0.5 }}>
            <Sparkline data={profitSparkData} color={summary.netProfit >= 0 ? GREEN : RED} width={70} height={24} />
          </div>
        </div>

        {/* Burn Rate */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Burn Rate</div>
          <div style={{ ...kpiValue, color: AMBER }}>
            <Counter target={summary.burnRate} prefix="\u20AC" />
          </div>
          <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>3-month avg</div>
        </div>

        {/* Runway */}
        <div className="kpi-card" style={{ padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={kpiLabel}>Runway</div>
          <div style={{ ...kpiValue, color: CYAN }}>
            {runway > 0 ? `${runway.toFixed(1)}` : "—"}
          </div>
          <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>months</div>
        </div>
      </div>

      {/* ── Charts row 1: Rev vs Exp + Expense Donut ── */}
      <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14, animationDelay: "0.1s" }}>
        {/* Revenue vs Expenses bar chart */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Revenue vs Expenses</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} barGap={4}>
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

        {/* Expense Donut */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Expense Breakdown</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={summary.expensesByCategory.map((e) => ({ name: getCategoryLabel(e.category), value: e.amount }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {summary.expensesByCategory.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtFull(Number(v))} contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 4 }}>
            {summary.expensesByCategory.slice(0, 6).map((e, i) => (
              <div key={e.category} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>{getCategoryLabel(e.category)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts row 2: Revenue Trend + Budget vs Actual ── */}
      <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14, animationDelay: "0.15s" }}>
        {/* Revenue Trend */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Revenue Trend</div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={barData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Revenue" stroke={GREEN} fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Budget vs Actual */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Budget vs Actual</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={budgetActualData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="category" tick={{ fontSize: 8, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} />
              <Bar dataKey="Budget" fill={INDIGO} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Actual" fill={ROSE_GOLD} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── P&L Summary Table ── */}
      <div className="fade-in" style={{ ...cardStyle, animationDelay: "0.2s" }}>
        <div style={sectionTitle}>Monthly P&L Summary</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Category", "Budget", "Actual", "Variance", "%"].map((h) => (
                <th key={h} style={{ textAlign: h === "Category" ? "left" : "right", padding: "8px 12px", fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${CARD_BORDER}`, fontFamily: "'DM Sans', sans-serif" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Revenue section */}
            <tr>
              <td colSpan={5} style={{ padding: "10px 12px 4px", fontSize: 11, fontWeight: 600, color: GREEN, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif" }}>
                Revenue
              </td>
            </tr>
            {pnlRevenue.map((r) => (
              <tr key={r.category}>
                <td style={pnlCell("left")}>{getCategoryLabel(r.category)}</td>
                <td style={pnlCell("right")}>—</td>
                <td style={pnlCell("right")}>{fmtFull(r.amount)}</td>
                <td style={pnlCell("right")}>—</td>
                <td style={pnlCell("right")}>—</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...pnlCell("left"), fontWeight: 600 }}>Total Revenue</td>
              <td style={pnlCell("right")}>—</td>
              <td style={{ ...pnlCell("right"), fontWeight: 600, color: GREEN }}>{fmtFull(summary.revenue)}</td>
              <td style={pnlCell("right")}>—</td>
              <td style={pnlCell("right")}>—</td>
            </tr>

            {/* Expense section */}
            <tr>
              <td colSpan={5} style={{ padding: "14px 12px 4px", fontSize: 11, fontWeight: 600, color: ROSE_GOLD, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif" }}>
                Expenses
              </td>
            </tr>
            {pnlExpenses.map((e) => {
              const pct = e.budget > 0 ? ((e.actual / e.budget) * 100).toFixed(0) : "—"
              const overBudget = e.actual > e.budget && e.budget > 0
              return (
                <tr key={e.category}>
                  <td style={pnlCell("left")}>{getCategoryLabel(e.category)}</td>
                  <td style={pnlCell("right")}>{e.budget > 0 ? fmtFull(e.budget) : "—"}</td>
                  <td style={pnlCell("right")}>{fmtFull(e.actual)}</td>
                  <td style={{ ...pnlCell("right"), color: overBudget ? RED : GREEN }}>{e.budget > 0 ? fmtFull(e.variance) : "—"}</td>
                  <td style={{ ...pnlCell("right"), color: overBudget ? RED : GREEN }}>{pct !== "—" ? `${pct}%` : "—"}</td>
                </tr>
              )
            })}
            <tr>
              <td style={{ ...pnlCell("left"), fontWeight: 600 }}>Total Expenses</td>
              <td style={{ ...pnlCell("right"), fontWeight: 600 }}>{totalBudget > 0 ? fmtFull(totalBudget) : "—"}</td>
              <td style={{ ...pnlCell("right"), fontWeight: 600, color: ROSE_GOLD }}>{fmtFull(totalActual)}</td>
              <td style={{ ...pnlCell("right"), fontWeight: 600, color: totalActual > totalBudget ? RED : GREEN }}>{totalBudget > 0 ? fmtFull(totalBudget - totalActual) : "—"}</td>
              <td style={pnlCell("right")}>—</td>
            </tr>

            {/* Net Profit */}
            <tr style={{ borderTop: `2px solid ${CARD_BORDER}` }}>
              <td style={{ padding: "12px 12px", fontSize: 14, fontWeight: 400, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY }}>Net Profit</td>
              <td style={pnlCell("right")}></td>
              <td style={{ padding: "12px 12px", textAlign: "right", fontSize: 14, fontWeight: 400, fontFamily: "'Bellfair', serif", color: summary.netProfit >= 0 ? GREEN : RED }}>
                {fmtFull(summary.netProfit)}
              </td>
              <td style={pnlCell("right")}></td>
              <td style={{ padding: "12px 12px", textAlign: "right", fontSize: 12, fontFamily: "'DM Sans', sans-serif", color: summary.revenue > 0 ? (summary.netProfit >= 0 ? GREEN : RED) : TEXT_TERTIARY }}>
                {summary.revenue > 0 ? `${((summary.netProfit / summary.revenue) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Google Sheets placeholder ── */}
      <div className="fade-in" style={{ ...cardStyle, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", animationDelay: "0.25s" }}>
        <div>
          <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 4 }}>Google Sheets Integration</div>
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>Sync financial data automatically from Google Sheets</div>
        </div>
        <button
          disabled
          style={{
            padding: "8px 16px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
            background: "transparent", color: TEXT_TERTIARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif",
            cursor: "not-allowed", opacity: 0.5,
          }}
        >
          Connect Google Sheets — Coming Soon
        </button>
      </div>
    </div>
  )
}

function pnlCell(align: "left" | "right"): React.CSSProperties {
  return {
    padding: "6px 12px",
    textAlign: align,
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontFamily: "'DM Sans', sans-serif",
    borderBottom: `1px solid rgba(255,255,255,0.03)`,
  }
}
