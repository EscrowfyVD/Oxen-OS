"use client"

import { useState, useEffect, useMemo } from "react"
import {
  CARD_BG, CARD_BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, RED, AMBER, CYAN, INDIGO,
  EXPENSE_CATEGORIES, getCategoryLabel, fmtFull, getMonthOptions, getPrevMonth,
} from "./constants"
import type { FinanceBudget, FinanceGoal } from "./types"

interface BudgetWithActual extends FinanceBudget {
  actual?: number
  variance?: number
}

interface BudgetsTabProps {
  budgets: BudgetWithActual[]
  goals: FinanceGoal[]
  selectedMonth: string
  entity: string
  onMonthChange: (month: string) => void
  onSaveBudgets: (month: string, entity: string, items: Array<{ category: string; amount: number }>) => void
  onSaveGoal: (metric: string, target: number, period: string) => void
  summary: {
    revenue: number
    expenses: number
    netProfit: number
  } | null
}

const cardStyle: React.CSSProperties = {
  background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 24,
  backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
  boxShadow: GLASS_SHADOW,
}
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_PRIMARY, marginBottom: 14,
}

export default function BudgetsTab({
  budgets, goals, selectedMonth, entity, onMonthChange, onSaveBudgets, onSaveGoal, summary,
}: BudgetsTabProps) {
  const monthOptions = useMemo(() => getMonthOptions(), [])

  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)

  // Build actual map from budgets (which include actual from API)
  const actualMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of budgets) map[b.category] = b.actual ?? 0
    return map
  }, [budgets])

  useEffect(() => {
    const map: Record<string, string> = {}
    for (const cat of EXPENSE_CATEGORIES) map[cat.id] = ""
    for (const b of budgets) map[b.category] = String(b.amount)
    setAmounts(map)
  }, [budgets])

  const handleAmountChange = (category: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [category]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const items = EXPENSE_CATEGORIES.map((c) => ({ category: c.id, amount: parseFloat(amounts[c.id] || "0") || 0 }))
    await onSaveBudgets(selectedMonth, entity, items)
    setSaving(false)
  }

  const handleCopyPrevious = async () => {
    setCopyLoading(true)
    try {
      const prevMonth = getPrevMonth(selectedMonth)
      const res = await fetch(`/api/finance/budgets?month=${prevMonth}&entity=${entity}`)
      const data = await res.json()
      const prevBudgets = data.budgets || []
      const map: Record<string, string> = {}
      for (const cat of EXPENSE_CATEGORIES) map[cat.id] = ""
      for (const b of prevBudgets) map[b.category] = String(b.amount)
      setAmounts(map)
    } catch { /* ignore */ }
    setCopyLoading(false)
  }

  const totalBudget = EXPENSE_CATEGORIES.reduce((s, c) => s + (parseFloat(amounts[c.id] || "0") || 0), 0)
  const totalActual = EXPENSE_CATEGORIES.reduce((s, c) => s + (actualMap[c.id] || 0), 0)

  // Goals
  const [goalRevenue, setGoalRevenue] = useState("")
  const [goalExpense, setGoalExpense] = useState("")
  const [goalMargin, setGoalMargin] = useState("")
  const [goalRunway, setGoalRunway] = useState("")

  useEffect(() => {
    for (const g of goals) {
      if (g.metric === "monthly_revenue") setGoalRevenue(String(g.target))
      else if (g.metric === "monthly_expense") setGoalExpense(String(g.target))
      else if (g.metric === "profit_margin") setGoalMargin(String(g.target))
      else if (g.metric === "runway_months") setGoalRunway(String(g.target))
    }
  }, [goals])

  const handleSaveGoal = (metric: string, value: string) => {
    const target = parseFloat(value)
    if (!isNaN(target) && target > 0) onSaveGoal(metric, target, selectedMonth)
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        {/* Budget Table with Actual + Variance */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={sectionTitle}>Monthly Budget</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select value={selectedMonth} onChange={(e) => onMonthChange(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT_SECONDARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif", outline: "none", cursor: "pointer" }}>
                {monthOptions.map((m) => <option key={m.value} value={m.value} style={{ background: CARD_BG }}>{m.label}</option>)}
              </select>
              <button onClick={handleCopyPrevious} disabled={copyLoading} className="btn-secondary" style={{ padding: "6px 12px", fontSize: 10 }}>
                {copyLoading ? "Loading..." : "Copy Previous Month"}
              </button>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Category</th>
                <th style={{ ...thStyle, textAlign: "right", width: 140 }}>Budget</th>
                <th style={{ ...thStyle, textAlign: "right", width: 100 }}>Actual</th>
                <th style={{ ...thStyle, textAlign: "right", width: 100 }}>Variance</th>
                <th style={{ ...thStyle, textAlign: "right", width: 60 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {EXPENSE_CATEGORIES.map((cat) => {
                const budgetAmt = parseFloat(amounts[cat.id] || "0") || 0
                const actual = actualMap[cat.id] || 0
                const variance = budgetAmt - actual
                const pct = budgetAmt > 0 ? (actual / budgetAmt) * 100 : 0
                const over = actual > budgetAmt && budgetAmt > 0
                return (
                  <tr key={cat.id}>
                    <td style={tdBudget}>
                      {cat.label}
                      {budgetAmt > 0 && (
                        <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                          <div className={`progress-bar-fill${over ? " over-budget" : ""}`} style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: over ? RED : `linear-gradient(90deg, ${GREEN}, ${GREEN}cc)`, borderRadius: 2, transition: "width 0.5s ease" }} />
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdBudget, textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>€</span>
                        <input type="number" value={amounts[cat.id] || ""} onChange={(e) => handleAmountChange(cat.id, e.target.value)} placeholder="0"
                          style={{ width: 100, padding: "5px 8px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.02)", color: TEXT_PRIMARY, fontSize: 13, fontFamily: "'Bellfair', serif", textAlign: "right", outline: "none" }} />
                      </div>
                    </td>
                    <td style={{ ...tdBudget, textAlign: "right", color: TEXT_SECONDARY }}>
                      {actual > 0 ? fmtFull(actual) : "—"}
                    </td>
                    <td style={{ ...tdBudget, textAlign: "right", color: over ? RED : budgetAmt > 0 ? GREEN : TEXT_TERTIARY }}>
                      {budgetAmt > 0 ? fmtFull(variance) : "—"}
                    </td>
                    <td style={{ ...tdBudget, textAlign: "right", fontSize: 10, color: over ? RED : budgetAmt > 0 ? GREEN : TEXT_TERTIARY }}>
                      {budgetAmt > 0 ? `${pct.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: `2px solid ${CARD_BORDER}` }}>
                <td style={{ ...tdBudget, fontWeight: 600, fontFamily: "'Bellfair', serif", fontSize: 14 }}>Total</td>
                <td style={{ ...tdBudget, textAlign: "right", fontWeight: 600, fontFamily: "'Bellfair', serif", fontSize: 14, color: INDIGO }}>{fmtFull(totalBudget)}</td>
                <td style={{ ...tdBudget, textAlign: "right", fontWeight: 600, color: ROSE_GOLD }}>{fmtFull(totalActual)}</td>
                <td style={{ ...tdBudget, textAlign: "right", fontWeight: 600, color: totalActual > totalBudget ? RED : GREEN }}>{totalBudget > 0 ? fmtFull(totalBudget - totalActual) : "—"}</td>
                <td style={{ ...tdBudget, textAlign: "right" }}></td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: "8px 20px", fontSize: 12 }}>
              {saving ? "Saving..." : "Save Budget"}
            </button>
          </div>
        </div>

        {/* Goals */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Financial Goals</div>
          <GoalRow label="Monthly Revenue Target" value={goalRevenue} onChange={setGoalRevenue}
            onSave={() => handleSaveGoal("monthly_revenue", goalRevenue)} current={summary?.revenue || 0} target={parseFloat(goalRevenue) || 0} color={GREEN} />
          <GoalRow label="Max Monthly Expenses" value={goalExpense} onChange={setGoalExpense}
            onSave={() => handleSaveGoal("monthly_expense", goalExpense)} current={summary?.expenses || 0} target={parseFloat(goalExpense) || 0} color={ROSE_GOLD} inverse />
          <GoalRow label="Profit Margin Target (%)" value={goalMargin} onChange={setGoalMargin}
            onSave={() => handleSaveGoal("profit_margin", goalMargin)} current={summary && summary.revenue > 0 ? (summary.netProfit / summary.revenue) * 100 : 0} target={parseFloat(goalMargin) || 0} color={AMBER} suffix="%" />
          <GoalRow label="Runway Target (months)" value={goalRunway} onChange={setGoalRunway}
            onSave={() => handleSaveGoal("runway_months", goalRunway)} current={0} target={parseFloat(goalRunway) || 0} color={CYAN} suffix=" mo" />
        </div>
      </div>
    </div>
  )
}

interface GoalRowProps {
  label: string; value: string; onChange: (v: string) => void; onSave: () => void
  current: number; target: number; color: string; inverse?: boolean; suffix?: string
}

function GoalRow({ label, value, onChange, onSave, current, target, color, inverse, suffix }: GoalRowProps) {
  const pct = target > 0 ? Math.min((inverse ? (target > 0 ? (1 - (current - target) / target) : 1) : current / target) * 100, 100) : 0
  const isGood = inverse ? current <= target : current >= target

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0"
          style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.02)", color: TEXT_PRIMARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
        <button onClick={onSave} className="btn-secondary" style={{ padding: "6px 12px", fontSize: 10 }}>Set</button>
      </div>
      {target > 0 && (
        <>
          <div style={{ height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
            <div className="progress-bar-fill" style={{ height: "100%", width: `${Math.max(pct, 0)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 3, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: isGood ? GREEN : RED, fontFamily: "'DM Sans', sans-serif" }}>
              Current: {suffix === "%" ? `${current.toFixed(1)}%` : suffix === " mo" ? `${current.toFixed(1)} mo` : fmtFull(current)}
            </span>
            <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
              Target: {suffix === "%" ? `${target}%` : suffix === " mo" ? `${target} mo` : fmtFull(target)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY,
  textTransform: "uppercase", letterSpacing: 0.8, borderBottom: `1px solid ${CARD_BORDER}`, fontFamily: "'DM Sans', sans-serif",
  background: "rgba(255,255,255,0.02)",
}
const tdBudget: React.CSSProperties = {
  padding: "10px 14px", fontSize: 12, color: TEXT_PRIMARY,
  fontFamily: "'DM Sans', sans-serif", fontVariantNumeric: "tabular-nums",
  borderBottom: `1px solid rgba(255,255,255,0.03)`,
}
