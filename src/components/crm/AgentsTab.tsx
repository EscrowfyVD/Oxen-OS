"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Counter from "@/components/dashboard/Counter"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, AMBER, ROSE_GOLD, INDIGO,
  AGENT_TYPE_COLORS, AGENT_STATUSES,
} from "./constants"
import type { Agent } from "./types"

interface AgentsTabProps {
  agents: Agent[]
  onNewAgent: () => void
  onEditAgent: (a: Agent) => void
}

export default function AgentsTab({ agents, onNewAgent, onEditAgent }: AgentsTabProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)

  // Sort agents by total revenue (from _count and totalRevenue field added by API)
  const sortedAgents = useMemo(() => {
    let result = [...agents]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((a) => a.name.toLowerCase().includes(q) || (a.company && a.company.toLowerCase().includes(q)))
    }
    if (statusFilter !== "all") result = result.filter((a) => a.status === statusFilter)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.sort((a, b) => ((b as any).totalRevenue ?? 0) - ((a as any).totalRevenue ?? 0))
  }, [agents, search, statusFilter])

  const totalAgents = agents.length
  const activeAgents = agents.filter((a) => a.status === "active").length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalRevenue = agents.reduce((sum, a) => sum + ((a as any).totalRevenue ?? 0), 0)
  const avgCommission = agents.length > 0
    ? agents.reduce((sum, a) => sum + a.commissionDirect, 0) / agents.length
    : 0

  const top3 = sortedAgents.slice(0, 3)
  const medals = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"]

  const kpis = [
    { label: "Total Agents", value: totalAgents, color: INDIGO, prefix: "" },
    { label: "Active Agents", value: activeAgents, color: GREEN, prefix: "" },
    { label: "Referred Revenue", value: totalRevenue, color: ROSE_GOLD, prefix: "\u20AC" },
    { label: "Avg Commission", value: avgCommission, color: AMBER, prefix: "", suffix: "%" },
  ]

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{
            background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 20,
          }}>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 28, fontFamily: "'Bellfair', serif", color: FROST, marginTop: 8 }}>
              {kpi.prefix}<Counter target={kpi.value} duration={600} />{kpi.suffix ?? ""}
            </div>
          </div>
        ))}
      </div>

      {/* Top 3 */}
      {top3.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${top3.length}, 1fr)`, gap: 16, marginBottom: 24 }}>
          {top3.map((agent, i) => {
            const typeColor = AGENT_TYPE_COLORS[agent.type] ?? AGENT_TYPE_COLORS.other
            return (
              <div key={agent.id} onClick={() => router.push(`/crm/agents/${agent.id}`)} style={{
                background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 20,
                cursor: "pointer", transition: "border-color 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>{medals[i]}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: FROST, fontFamily: "'DM Sans', sans-serif" }}>{agent.name}</div>
                    {agent.company && <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>{agent.company}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                    background: typeColor.bg, color: typeColor.text, fontFamily: "'DM Sans', sans-serif",
                  }}>{agent.type.replace(/_/g, " ")}</span>
                </div>
                <div style={{ fontSize: 22, fontFamily: "'Bellfair', serif", color: FROST }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {formatCurrency((agent as any).totalRevenue ?? 0)}
                </div>
                <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                  {agent._count?.referredClients ?? 0} referred clients
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Search + Filter */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "8px 14px", background: "rgba(255,255,255,0.04)",
            border: `1px solid ${CARD_BORDER}`, borderRadius: 6, color: FROST,
            fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px", background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
            borderRadius: 6, color: TEXT_PRIMARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <option value="all">All Statuses</option>
          {AGENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={onNewAgent} className="header-btn">+ New Agent</button>
      </div>

      {/* Leaderboard Table */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
              {["#", "Name", "Type", "Company", "Referred", "Revenue", "Commission", "Status"].map((h) => (
                <th key={h} style={{
                  padding: "10px 14px", textAlign: "left", fontSize: 10, color: TEXT_TERTIARY,
                  textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedAgents.map((agent, i) => {
              const typeColor = AGENT_TYPE_COLORS[agent.type] ?? AGENT_TYPE_COLORS.other
              const statusColor = agent.status === "active" ? GREEN : agent.status === "inactive" ? TEXT_TERTIARY : AMBER
              return (
                <tr key={agent.id} onClick={() => router.push(`/crm/agents/${agent.id}`)} style={{
                  borderBottom: `1px solid ${CARD_BORDER}`, cursor: "pointer",
                  transition: "background 0.1s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 14px", fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>{i + 1}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 13, color: FROST, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{agent.name}</div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                      background: typeColor.bg, color: typeColor.text, fontFamily: "'DM Sans', sans-serif",
                    }}>{agent.type.replace(/_/g, " ")}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>{agent.company || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>{agent._count?.referredClients ?? 0}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: GREEN, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {formatCurrency((agent as any).totalRevenue ?? 0)}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>{agent.commissionDirect}%</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                      background: `${statusColor}18`, color: statusColor, fontFamily: "'DM Sans', sans-serif",
                    }}>{agent.status}</span>
                  </td>
                </tr>
              )
            })}
            {sortedAgents.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: TEXT_TERTIARY, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                  No agents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
