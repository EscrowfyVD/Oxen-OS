"use client"

import { useState, useMemo } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  GREEN, AMBER, RED, BLUE, PURPLE, ROSE_GOLD,
  STATUSES, STATUS_COLORS, PRIORITIES, PRIORITY_COLORS,
  CHANNELS, CATEGORIES, CATEGORY_LABELS,
  fmtDate, fmtDateTime,
} from "./constants"
import type { SupportTicket } from "./types"

interface TicketsTabProps {
  tickets: SupportTicket[]
  agents: string[]
  onSelect: (ticket: SupportTicket) => void
  onAdd: () => void
}

type SortKey = "createdAt" | "updatedAt" | "priority" | "status" | "subject" | "clientName"
type SortDir = "asc" | "desc"

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export default function TicketsTab({ tickets, agents, onSelect, onAdd }: TicketsTabProps) {
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterChannel, setFilterChannel] = useState("all")
  const [filterAgent, setFilterAgent] = useState("all")
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  const filtered = useMemo(() => {
    let list = [...tickets]
    if (filterStatus !== "all") list = list.filter((t) => t.status === filterStatus)
    if (filterPriority !== "all") list = list.filter((t) => t.priority === filterPriority)
    if (filterCategory !== "all") list = list.filter((t) => (t.category || "general") === filterCategory)
    if (filterChannel !== "all") list = list.filter((t) => t.channel === filterChannel)
    if (filterAgent !== "all") list = list.filter((t) => t.assignedTo === filterAgent)
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter((t) => t.subject.toLowerCase().includes(s) || t.clientName.toLowerCase().includes(s))
    }

    list.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "createdAt":
        case "updatedAt":
          cmp = new Date(a[sortKey]).getTime() - new Date(b[sortKey]).getTime()
          break
        case "priority":
          cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
          break
        case "status":
          cmp = a.status.localeCompare(b.status)
          break
        case "subject":
          cmp = a.subject.localeCompare(b.subject)
          break
        case "clientName":
          cmp = a.clientName.localeCompare(b.clientName)
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return list
  }, [tickets, filterStatus, filterPriority, filterCategory, filterChannel, filterAgent, search, sortKey, sortDir])

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " \u25B2" : " \u25BC"
  }

  const selectSt: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`,
    background: CARD_BG, color: TEXT_SECONDARY, fontSize: 10,
    fontFamily: "'DM Sans', sans-serif", outline: "none", cursor: "pointer",
  }

  const thSt: React.CSSProperties = {
    padding: "8px 10px", fontSize: 10, fontWeight: 500, color: TEXT_TERTIARY,
    textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
    borderBottom: `1px solid ${CARD_BORDER}`, textAlign: "left",
  }

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectSt}>
          <option value="all">All Status</option>
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={selectSt}>
          <option value="all">All Priority</option>
          {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={selectSt}>
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} style={selectSt}>
          <option value="all">All Channels</option>
          {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} style={selectSt}>
          <option value="all">All Agents</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subject or client..."
          style={{ ...selectSt, width: 180 }}
        />
        <span style={{ marginLeft: "auto", fontSize: 10, color: TEXT_TERTIARY }}>
          {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div style={{
        background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14,
        overflow: "auto",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={thSt} onClick={() => toggleSort("subject")}>Subject{sortIcon("subject")}</th>
              <th style={thSt} onClick={() => toggleSort("clientName")}>Client{sortIcon("clientName")}</th>
              <th style={thSt}>Channel</th>
              <th style={thSt}>Category</th>
              <th style={thSt} onClick={() => toggleSort("priority")}>Priority{sortIcon("priority")}</th>
              <th style={thSt} onClick={() => toggleSort("status")}>Status{sortIcon("status")}</th>
              <th style={thSt}>Assigned</th>
              <th style={thSt} onClick={() => toggleSort("createdAt")}>Created{sortIcon("createdAt")}</th>
              <th style={thSt} onClick={() => toggleSort("updatedAt")}>Updated{sortIcon("updatedAt")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const sc = STATUS_COLORS[t.status] || STATUS_COLORS.open
              const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium
              const chColor = CHANNELS.find((c) => c.id === t.channel)?.color || TEXT_TERTIARY
              return (
                <tr
                  key={t.id}
                  onClick={() => onSelect(t)}
                  style={{
                    cursor: "pointer",
                    borderLeft: t.priority === "urgent" ? `3px solid ${RED}` : t.priority === "high" ? `3px solid ${AMBER}` : "3px solid transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 10px", fontSize: 11, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderBottom: `1px solid ${CARD_BORDER}` }}>
                    {t.subject}
                  </td>
                  <td style={{ padding: "10px 10px", fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}`, whiteSpace: "nowrap" }}>
                    {t.clientName}
                  </td>
                  <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                    <span style={{ fontSize: 10, color: chColor, fontFamily: "'DM Sans', sans-serif" }}>
                      {CHANNELS.find((c) => c.id === t.channel)?.label || t.channel}
                    </span>
                  </td>
                  <td style={{ padding: "10px 10px", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>
                    {CATEGORY_LABELS[t.category || "general"] || t.category || "—"}
                  </td>
                  <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500,
                      background: pc.bg, color: pc.text, fontFamily: "'DM Sans', sans-serif",
                      textTransform: "capitalize",
                    }}>
                      {t.priority}
                    </span>
                  </td>
                  <td style={{ padding: "10px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500,
                      background: sc.bg, color: sc.text, fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ padding: "10px 10px", fontSize: 10, color: t.assignedTo ? ROSE_GOLD : TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}`, whiteSpace: "nowrap" }}>
                    {t.assignedTo || "Unassigned"}
                  </td>
                  <td style={{ padding: "10px 10px", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}`, whiteSpace: "nowrap" }}>
                    {fmtDate(t.createdAt)}
                  </td>
                  <td style={{ padding: "10px 10px", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}`, whiteSpace: "nowrap" }}>
                    {fmtDate(t.updatedAt)}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 40, color: TEXT_TERTIARY, fontSize: 12, borderBottom: `1px solid ${CARD_BORDER}` }}>
                  No tickets match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
