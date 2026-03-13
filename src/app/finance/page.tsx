"use client"

import { useState, useEffect, useCallback } from "react"
import OverviewTab from "@/components/finance/OverviewTab"
import EntriesTab from "@/components/finance/EntriesTab"
import BudgetTab from "@/components/finance/BudgetTab"
import EntryModal from "@/components/finance/EntryModal"
import ImportModal from "@/components/finance/ImportModal"
import { getCurrentMonth, ENTITIES, fmtFull } from "@/components/finance/constants"
import type { FinanceEntry, FinanceGoal, FinanceSummary } from "@/components/finance/types"

/* ── Design tokens ── */
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const CARD_BG = "#0F1118"
const GREEN = "#34D399"
const RED = "#F87171"

type TabId = "overview" | "entries" | "budget"
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "entries", label: "Entries" },
  { id: "budget", label: "Budget Planner" },
]

export default function FinancePage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [budgets, setBudgets] = useState<FinanceEntry[]>([])
  const [goals, setGoals] = useState<FinanceGoal[]>([])
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [selectedEntity, setSelectedEntity] = useState("all")
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [cashBalance, setCashBalance] = useState(850000) // Manual for now
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  // Check access (admin+ only)
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        const rl = data.employee?.roleLevel ?? "member"
        setHasAccess(rl === "super_admin" || rl === "admin")
        setAccessChecked(true)
      })
      .catch(() => setAccessChecked(true))
  }, [])

  if (!accessChecked) return null
  if (!hasAccess) {
    return (
      <div style={{ padding: "80px 32px", textAlign: "center" }}>
        <h2 style={{ color: TEXT_PRIMARY, fontSize: 20, marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: TEXT_SECONDARY, fontSize: 14 }}>You need admin access to view finance data.</p>
      </div>
    )
  }

  /* ── Fetchers ── */
  const fetchEntries = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedEntity !== "all") params.set("entity", selectedEntity)
    fetch(`/api/finance?${params}`)
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => {})
  }, [selectedEntity])

  const fetchSummary = useCallback(() => {
    const params = new URLSearchParams({ month: selectedMonth })
    if (selectedEntity !== "all") params.set("entity", selectedEntity)
    fetch(`/api/finance/summary?${params}`)
      .then((r) => r.json())
      .then((data) => setSummary(data.summary ?? null))
      .catch(() => {})
  }, [selectedMonth, selectedEntity])

  const fetchBudgets = useCallback(() => {
    const params = new URLSearchParams({ month: selectedMonth })
    if (selectedEntity !== "all") params.set("entity", selectedEntity)
    fetch(`/api/finance/budget?${params}`)
      .then((r) => r.json())
      .then((data) => setBudgets(data.budgets ?? []))
      .catch(() => {})
  }, [selectedMonth, selectedEntity])

  const fetchGoals = useCallback(() => {
    const params = new URLSearchParams({ period: selectedMonth })
    if (selectedEntity !== "all") params.set("entity", selectedEntity)
    fetch(`/api/finance/goals?${params}`)
      .then((r) => r.json())
      .then((data) => setGoals(data.goals ?? []))
      .catch(() => {})
  }, [selectedMonth, selectedEntity])

  useEffect(() => {
    fetchEntries()
    fetchSummary()
    fetchBudgets()
    fetchGoals()
  }, [fetchEntries, fetchSummary, fetchBudgets, fetchGoals])

  const refreshAll = () => {
    fetchEntries()
    fetchSummary()
    fetchBudgets()
    fetchGoals()
  }

  /* ── Handlers ── */
  const openNewEntry = () => {
    setEditingEntry(null)
    setShowEntryModal(true)
  }

  const openEditEntry = (entry: FinanceEntry) => {
    setEditingEntry(entry)
    setShowEntryModal(true)
  }

  const handleEntrySaved = () => {
    setShowEntryModal(false)
    setEditingEntry(null)
    refreshAll()
  }

  const handleImportDone = () => {
    setShowImportModal(false)
    refreshAll()
  }

  const handleSaveBudgets = async (month: string, entity: string, items: Array<{ category: string; amount: number }>) => {
    await fetch("/api/finance/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, entity: entity === "all" ? "oxen" : entity, items }),
    })
    refreshAll()
  }

  const handleSaveGoal = async (metric: string, target: number, period: string) => {
    await fetch("/api/finance/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric, target, entity: selectedEntity === "all" ? "oxen" : selectedEntity, period }),
    })
    fetchGoals()
  }

  const netProfit = summary ? summary.netProfit : 0

  return (
    <div className="page-content" style={{ padding: 0, background: "#060709", minHeight: "100vh" }}>
      {/* Header */}
      <div
        className="fade-in"
        style={{
          padding: "24px 28px 0",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 28, fontWeight: 400, color: TEXT_PRIMARY, margin: 0, lineHeight: 1.2 }}>
              Finance
            </h1>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 6 }}>
              {summary ? (
                <>
                  {selectedMonth} &middot; Net:{" "}
                  <span style={{ color: netProfit >= 0 ? GREEN : RED }}>{fmtFull(netProfit)}</span>
                </>
              ) : (
                "Loading financial data..."
              )}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Entity filter */}
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG, color: TEXT_SECONDARY, fontSize: 11,
                fontFamily: "'DM Sans', sans-serif", outline: "none", cursor: "pointer",
              }}
            >
              <option value="all">All Entities</option>
              {ENTITIES.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>

            {/* Month selector */}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG, color: TEXT_SECONDARY, fontSize: 11,
                fontFamily: "'DM Sans', sans-serif", outline: "none", cursor: "pointer",
              }}
            />

            <button onClick={openNewEntry} className="btn-primary" style={{ padding: "7px 16px", fontSize: 11 }}>
              + Add Entry
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${CARD_BORDER}` }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 20px",
                fontSize: 12,
                fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                color: activeTab === tab.id ? TEXT_PRIMARY : TEXT_TERTIARY,
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #C08B88" : "2px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: "20px 28px 40px" }}>
        {activeTab === "overview" && (
          <OverviewTab
            summary={summary}
            goals={goals}
            cashBalance={cashBalance}
          />
        )}
        {activeTab === "entries" && (
          <EntriesTab
            entries={entries}
            onEdit={openEditEntry}
            onAdd={openNewEntry}
            onImport={() => setShowImportModal(true)}
          />
        )}
        {activeTab === "budget" && (
          <BudgetTab
            budgets={budgets}
            goals={goals}
            selectedMonth={selectedMonth}
            entity={selectedEntity === "all" ? "oxen" : selectedEntity}
            onMonthChange={setSelectedMonth}
            onSaveBudgets={handleSaveBudgets}
            onSaveGoal={handleSaveGoal}
            summary={summary ? { revenue: summary.revenue, expenses: summary.expenses, netProfit: summary.netProfit } : null}
          />
        )}
      </div>

      {/* Modals */}
      {showEntryModal && (
        <EntryModal
          entry={editingEntry}
          onClose={() => { setShowEntryModal(false); setEditingEntry(null) }}
          onSave={handleEntrySaved}
        />
      )}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onDone={handleImportDone}
        />
      )}
    </div>
  )
}
