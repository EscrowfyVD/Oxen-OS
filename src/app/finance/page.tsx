"use client"

import { useState, useEffect, useCallback } from "react"
import OverviewTab from "@/components/finance/OverviewTab"
import TransactionsTab from "@/components/finance/TransactionsTab"
import BudgetsTab from "@/components/finance/BudgetsTab"
import AccountsTab from "@/components/finance/AccountsTab"
import ReportsTab from "@/components/finance/ReportsTab"
import TransactionModal from "@/components/finance/TransactionModal"
import TransactionImportModal from "@/components/finance/TransactionImportModal"
import { getCurrentMonth, ENTITIES, fmtFull } from "@/components/finance/constants"
import type { FinanceTransaction, FinanceGoal, FinanceSummary, BankAccount } from "@/components/finance/types"

/* ── Design tokens ── */
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const CARD_BG = "#0F1118"
const GREEN = "#34D399"
const RED = "#F87171"
const ROSE_GOLD = "#C08B88"

type TabId = "overview" | "transactions" | "budgets" | "accounts" | "reports"
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "P&L Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "budgets", label: "Budgets" },
  { id: "accounts", label: "Accounts" },
  { id: "reports", label: "Reports" },
]

export default function FinancePage() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [budgets, setBudgets] = useState<any[]>([])
  const [goals, setGoals] = useState<FinanceGoal[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [selectedEntity, setSelectedEntity] = useState("all")
  const [showTxModal, setShowTxModal] = useState(false)
  const [editingTx, setEditingTx] = useState<FinanceTransaction | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  // Check access
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        const rl = data.employee?.roleLevel ?? "member"
        const dept = (data.employee?.department ?? "").toLowerCase()
        setHasAccess(rl === "super_admin" || rl === "admin" || dept === "finance")
        setAccessChecked(true)
      })
      .catch(() => setAccessChecked(true))
  }, [])

  /* ── Fetchers ── */
  const fetchTransactions = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedEntity !== "all") params.set("entity", selectedEntity)
    fetch(`/api/finance/transactions?${params}`)
      .then((r) => r.json())
      .then((data) => setTransactions(data.transactions ?? []))
      .catch(() => {})
  }, [selectedEntity])

  const fetchSummary = useCallback(() => {
    const params = new URLSearchParams({ month: selectedMonth })
    if (selectedEntity !== "all") params.set("entity", selectedEntity)
    fetch(`/api/finance/overview?${params}`)
      .then((r) => r.json())
      .then((data) => setSummary(data.summary ?? null))
      .catch(() => {})
  }, [selectedMonth, selectedEntity])

  const fetchBudgets = useCallback(() => {
    const params = new URLSearchParams({ month: selectedMonth })
    if (selectedEntity !== "all") params.set("entity", selectedEntity)
    fetch(`/api/finance/budgets?${params}`)
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

  const fetchAccounts = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedEntity !== "all") params.set("entity", selectedEntity)
    params.set("active", "true")
    fetch(`/api/finance/accounts?${params}`)
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts ?? []))
      .catch(() => {})
  }, [selectedEntity])

  useEffect(() => {
    if (!hasAccess) return
    fetchTransactions()
    fetchSummary()
    fetchBudgets()
    fetchGoals()
    fetchAccounts()
  }, [hasAccess, fetchTransactions, fetchSummary, fetchBudgets, fetchGoals, fetchAccounts])

  if (!accessChecked) return null
  if (!hasAccess) {
    return (
      <div style={{ padding: "80px 32px", textAlign: "center" }}>
        <h2 style={{ color: TEXT_PRIMARY, fontSize: 20, marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: TEXT_SECONDARY, fontSize: 14 }}>You need admin access to view finance data.</p>
      </div>
    )
  }

  const refreshAll = () => {
    fetchTransactions()
    fetchSummary()
    fetchBudgets()
    fetchGoals()
    fetchAccounts()
  }

  /* ── Handlers ── */
  const openNewTx = () => { setEditingTx(null); setShowTxModal(true) }
  const openEditTx = (tx: FinanceTransaction) => { setEditingTx(tx); setShowTxModal(true) }

  const handleTxSave = async (data: Record<string, unknown>) => {
    if (editingTx) {
      await fetch(`/api/finance/transactions/${editingTx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    } else {
      await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    }
    setShowTxModal(false)
    setEditingTx(null)
    refreshAll()
  }

  const handleTxDelete = async (id: string) => {
    await fetch(`/api/finance/transactions/${id}`, { method: "DELETE" })
    refreshAll()
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (selectedEntity !== "all") params.set("entity", selectedEntity)
    window.open(`/api/finance/transactions/export?${params}`, "_blank")
  }

  const handleSaveBudgets = async (month: string, entity: string, items: Array<{ category: string; amount: number }>) => {
    await fetch("/api/finance/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, entityId: entity === "all" ? "oxen" : entity, items }),
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

  const handleAccountSave = async (data: Partial<BankAccount> & { id?: string }) => {
    if (data.id) {
      await fetch(`/api/finance/accounts/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    } else {
      await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    }
    fetchAccounts()
    fetchSummary()
  }

  const handleAccountDelete = async (id: string) => {
    await fetch(`/api/finance/accounts/${id}`, { method: "DELETE" })
    fetchAccounts()
    fetchSummary()
  }

  const netProfit = summary ? summary.netProfit : 0

  return (
    <div className="page-content" style={{ padding: 0, background: "#060709", minHeight: "100vh" }}>
      {/* Header */}
      <div className="fade-in" style={{ padding: "24px 28px 0", marginBottom: 4 }}>
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
                  {summary.totalBalance > 0 && (
                    <> &middot; Cash: <span style={{ color: TEXT_SECONDARY }}>{fmtFull(summary.totalBalance)}</span></>
                  )}
                </>
              ) : (
                "Loading financial data..."
              )}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG, color: TEXT_SECONDARY, fontSize: 11,
                fontFamily: "'DM Sans', sans-serif", outline: "none", cursor: "pointer",
                colorScheme: "dark",
              }}
            />

            <button onClick={openNewTx} className="btn-primary" style={{ padding: "7px 16px", fontSize: 11 }}>
              + Add Transaction
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
                padding: "10px 20px", fontSize: 12, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                color: activeTab === tab.id ? TEXT_PRIMARY : TEXT_TERTIARY,
                background: "transparent", border: "none",
                borderBottom: activeTab === tab.id ? `2px solid ${ROSE_GOLD}` : "2px solid transparent",
                cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
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
          <OverviewTab summary={summary} goals={goals} />
        )}
        {activeTab === "transactions" && (
          <TransactionsTab
            transactions={transactions}
            onEdit={openEditTx}
            onDelete={handleTxDelete}
            onAdd={openNewTx}
            onImport={() => setShowImportModal(true)}
            onExport={handleExport}
          />
        )}
        {activeTab === "budgets" && (
          <BudgetsTab
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
        {activeTab === "accounts" && (
          <AccountsTab
            accounts={accounts}
            onSave={handleAccountSave}
            onDelete={handleAccountDelete}
            onRefresh={fetchAccounts}
          />
        )}
        {activeTab === "reports" && (
          <ReportsTab />
        )}
      </div>

      {/* Modals */}
      {showTxModal && (
        <TransactionModal
          transaction={editingTx}
          onClose={() => { setShowTxModal(false); setEditingTx(null) }}
          onSave={handleTxSave}
        />
      )}
      {showImportModal && (
        <TransactionImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); refreshAll() }}
        />
      )}
    </div>
  )
}
