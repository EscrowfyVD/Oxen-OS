"use client"

import { useState, useMemo } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, TYPE_COLORS,
  REVENUE_CATEGORIES, EXPENSE_CATEGORIES, ENTITIES, PAYMENT_SOURCES, TX_STATUSES,
  getCategoryLabel, fmtFull,
} from "./constants"
import type { FinanceTransaction } from "./types"

interface TransactionsTabProps {
  transactions: FinanceTransaction[]
  onEdit: (tx: FinanceTransaction) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onImport: () => void
  onExport: () => void
}

type SortKey = "date" | "type" | "category" | "amount" | "entity" | "status"

const thStyle: React.CSSProperties = {
  padding: "10px 12px", fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY,
  textTransform: "uppercase", letterSpacing: 0.8, borderBottom: `1px solid ${CARD_BORDER}`,
  fontFamily: "'DM Sans', sans-serif", cursor: "pointer", userSelect: "none",
  background: "rgba(255,255,255,0.02)",
}
const tdStyle: React.CSSProperties = {
  padding: "12px 12px", fontSize: 12, color: TEXT_SECONDARY,
  fontFamily: "'DM Sans', sans-serif", fontVariantNumeric: "tabular-nums",
  borderBottom: `1px solid rgba(255,255,255,0.03)`,
}

export default function TransactionsTab({ transactions, onEdit, onDelete, onAdd, onImport, onExport }: TransactionsTabProps) {
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterEntity, setFilterEntity] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const allCategories = useMemo(() => [...REVENUE_CATEGORIES, ...EXPENSE_CATEGORIES], [])

  const filtered = useMemo(() => {
    let list = [...transactions]
    if (filterType !== "all") list = list.filter((t) => t.type === filterType)
    if (filterCategory !== "all") list = list.filter((t) => t.category === filterCategory)
    if (filterEntity !== "all") list = list.filter((t) => t.entity === filterEntity)
    if (filterStatus !== "all") list = list.filter((t) => t.status === filterStatus)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) =>
        (t.description || "").toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.reference || "").toLowerCase().includes(q) ||
        (t.contact?.name || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
      else if (sortKey === "amount") cmp = a.amount - b.amount
      else cmp = (a[sortKey] || "").localeCompare(b[sortKey] || "")
      return sortDir === "desc" ? -cmp : cmp
    })
    return list
  }, [transactions, search, filterType, filterCategory, filterEntity, filterStatus, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const sortIcon = (key: SortKey) => sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : ""

  const selectStyle: React.CSSProperties = {
    background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "6px 10px",
    color: TEXT_PRIMARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif", outline: "none",
  }

  const totalRevenue = filtered.filter((t) => t.type === "revenue").reduce((s, t) => s + (t.amountEur ?? t.amount), 0)
  const totalExpense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + (t.amountEur ?? t.amount), 0)

  return (
    <div>
      {/* Header + Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...selectStyle, width: 220, padding: "8px 12px" }}
          />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
            <option value="all">All Types</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={selectStyle}>
            <option value="all">All Categories</option>
            {allCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} style={selectStyle}>
            <option value="all">All Entities</option>
            {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="all">All Status</option>
            {TX_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onExport} style={{ ...selectStyle, cursor: "pointer", color: TEXT_SECONDARY }}>Export CSV</button>
          <button onClick={onImport} style={{ ...selectStyle, cursor: "pointer", color: TEXT_SECONDARY }}>Import CSV</button>
          <button onClick={onAdd} className="btn-primary" style={{ padding: "8px 16px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ color: TEXT_TERTIARY }}>{filtered.length} transactions</span>
        <span style={{ color: GREEN }}>Revenue: {fmtFull(totalRevenue)}</span>
        <span style={{ color: ROSE_GOLD }}>Expenses: {fmtFull(totalExpense)}</span>
        <span style={{ color: totalRevenue - totalExpense >= 0 ? GREEN : ROSE_GOLD }}>
          Net: {fmtFull(totalRevenue - totalExpense)}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: CARD_BG, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${CARD_BORDER}`, borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left" }} onClick={() => toggleSort("date")}>Date{sortIcon("date")}</th>
              <th style={{ ...thStyle, textAlign: "left" }} onClick={() => toggleSort("type")}>Type{sortIcon("type")}</th>
              <th style={{ ...thStyle, textAlign: "left" }} onClick={() => toggleSort("category")}>Category{sortIcon("category")}</th>
              <th style={{ ...thStyle, textAlign: "left" }}>Description</th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("amount")}>Amount{sortIcon("amount")}</th>
              <th style={{ ...thStyle, textAlign: "left" }} onClick={() => toggleSort("entity")}>Entity{sortIcon("entity")}</th>
              <th style={{ ...thStyle, textAlign: "left" }} onClick={() => toggleSort("status")}>Status{sortIcon("status")}</th>
              <th style={{ ...thStyle, textAlign: "left" }}>Contact</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "60px 20px", textAlign: "center" }}>
                  <div style={{ width: 48, height: 48, margin: "0 auto 16px", borderRadius: 14, background: "linear-gradient(135deg, rgba(192,139,136,0.08), rgba(192,139,136,0.02))", border: "1px solid rgba(192,139,136,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, opacity: 0.6 }}>
                    {"\u{1F4B3}"}
                  </div>
                  <div style={{ fontSize: 13, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
                    No transactions yet — click <strong style={{ color: ROSE_GOLD }}>+ Add Transaction</strong> to get started
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((tx) => {
                const typeColor = TYPE_COLORS[tx.type] || TYPE_COLORS.expense
                return (
                  <tr
                    key={tx.id}
                    onClick={() => onEdit(tx)}
                    style={{
                      cursor: "pointer", transition: "background 0.15s",
                      borderLeft: tx.type === "revenue" ? "3px solid rgba(52,211,153,0.3)" : "3px solid rgba(248,113,113,0.2)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(192,139,136,0.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdStyle}>
                      {new Date(tx.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 4,
                        background: typeColor.bg, color: typeColor.text, fontSize: 10, fontWeight: 500,
                      }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 6,
                        background: tx.type === "revenue" ? "rgba(52,211,153,0.08)" : "rgba(192,139,136,0.08)",
                        color: tx.type === "revenue" ? GREEN : ROSE_GOLD,
                        fontSize: 10, fontWeight: 500, letterSpacing: 0.3,
                      }}>
                        {getCategoryLabel(tx.category)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.description || "—"}
                      {tx.reference && <span style={{ color: TEXT_TERTIARY, marginLeft: 6, fontSize: 10 }}>#{tx.reference}</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 500, color: tx.type === "revenue" ? GREEN : ROSE_GOLD }}>
                      {tx.type === "revenue" ? "+" : "-"}{fmtFull(tx.amount, tx.currency === "EUR" ? "€" : tx.currency + " ")}
                      {tx.currency !== "EUR" && tx.amountEur && (
                        <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontWeight: 400 }}>≈ €{tx.amountEur.toLocaleString()}</div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                        {ENTITIES.find((e) => e.id === tx.entity)?.label || tx.entity}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: tx.status === "reconciled" ? "rgba(52,211,153,0.1)" : tx.status === "pending" ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.05)",
                        color: tx.status === "reconciled" ? GREEN : tx.status === "pending" ? "#FBBF24" : TEXT_SECONDARY,
                      }}>
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>
                      {tx.contact?.name || "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(tx.id) }}
                        style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", fontSize: 12, padding: "2px 6px" }}
                        title="Delete"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
