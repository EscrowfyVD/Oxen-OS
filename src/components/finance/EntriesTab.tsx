"use client"

import { useState, useMemo } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, INDIGO, TYPE_COLORS,
  REVENUE_CATEGORIES, EXPENSE_CATEGORIES, ENTITIES,
  getCategoryLabel, fmtFull,
} from "./constants"
import type { FinanceEntry } from "./types"

interface EntriesTabProps {
  entries: FinanceEntry[]
  onEdit: (entry: FinanceEntry) => void
  onAdd: () => void
  onImport: () => void
}

type SortKey = "date" | "type" | "category" | "amount" | "entity"

export default function EntriesTab({ entries, onEdit, onAdd, onImport }: EntriesTabProps) {
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterEntity, setFilterEntity] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const allCategories = useMemo(() => {
    return [...REVENUE_CATEGORIES, ...EXPENSE_CATEGORIES]
  }, [])

  const filtered = useMemo(() => {
    let list = [...entries]
    if (filterType !== "all") list = list.filter((e) => e.type === filterType)
    if (filterCategory !== "all") list = list.filter((e) => e.category === filterCategory)
    if (filterEntity !== "all") list = list.filter((e) => e.entity === filterEntity)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((e) =>
        (e.description || "").toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.notes || "").toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
      else if (sortKey === "amount") cmp = a.amount - b.amount
      else if (sortKey === "type") cmp = a.type.localeCompare(b.type)
      else if (sortKey === "category") cmp = a.category.localeCompare(b.category)
      else if (sortKey === "entity") cmp = a.entity.localeCompare(b.entity)
      return sortDir === "desc" ? -cmp : cmp
    })
    return list
  }, [entries, search, filterType, filterCategory, filterEntity, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ""
    return sortDir === "desc" ? " \u25BE" : " \u25B4"
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "7px 14px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
            background: CARD_BG, color: TEXT_PRIMARY, fontSize: 12,
            fontFamily: "'DM Sans', sans-serif", outline: "none", width: 220,
          }}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
          <option value="all">All Types</option>
          <option value="revenue">Revenue</option>
          <option value="expense">Expense</option>
          <option value="budget">Budget</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={selectStyle}>
          <option value="all">All Categories</option>
          {allCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} style={selectStyle}>
          <option value="all">All Entities</option>
          {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={onImport} className="btn-secondary" style={{ padding: "7px 14px", fontSize: 11 }}>
            Import CSV
          </button>
          <button onClick={onAdd} className="btn-primary" style={{ padding: "7px 14px", fontSize: 11 }}>
            + Add Entry
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {([
                { key: "date", label: "Date", w: 100 },
                { key: "type", label: "Type", w: 90 },
                { key: "category", label: "Category", w: 160 },
                { key: null, label: "Description", w: undefined },
                { key: "amount", label: "Amount", w: 120 },
                { key: "entity", label: "Entity", w: 100 },
                { key: null, label: "Recurring", w: 80 },
              ] as Array<{ key: SortKey | null; label: string; w?: number }>).map((col) => (
                <th
                  key={col.label}
                  onClick={col.key ? () => toggleSort(col.key!) : undefined}
                  style={{
                    textAlign: col.label === "Amount" ? "right" : "left",
                    padding: "10px 14px", fontSize: 10, fontWeight: 600,
                    color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5,
                    borderBottom: `1px solid ${CARD_BORDER}`, fontFamily: "'DM Sans', sans-serif",
                    cursor: col.key ? "pointer" : "default",
                    width: col.w,
                    userSelect: "none",
                  }}
                >
                  {col.label}{col.key ? sortIcon(col.key) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                  No entries found
                </td>
              </tr>
            ) : (
              filtered.map((entry) => {
                const tc = TYPE_COLORS[entry.type] || TYPE_COLORS.expense
                return (
                  <tr
                    key={entry.id}
                    onClick={() => onEdit(entry)}
                    style={{ cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                  >
                    <td style={tdStyle}>
                      {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 600,
                        background: tc.bg, color: tc.text, textTransform: "uppercase",
                        fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.5,
                      }}>
                        {entry.type}
                      </span>
                    </td>
                    <td style={tdStyle}>{getCategoryLabel(entry.category)}</td>
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.description || "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'Bellfair', serif", fontSize: 14, color: entry.type === "revenue" ? GREEN : entry.type === "expense" ? ROSE_GOLD : INDIGO }}>
                      {entry.type === "expense" ? "-" : ""}{fmtFull(entry.amount)}
                    </td>
                    <td style={{ ...tdStyle, textTransform: "capitalize" }}>{entry.entity}</td>
                    <td style={tdStyle}>{entry.recurring ? "\u2713" : ""}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
        {filtered.length} entries shown
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
  background: CARD_BG, color: TEXT_SECONDARY, fontSize: 11,
  fontFamily: "'DM Sans', sans-serif", outline: "none", cursor: "pointer",
}

const tdStyle: React.CSSProperties = {
  padding: "10px 14px", fontSize: 12, color: TEXT_PRIMARY,
  fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)`,
}
