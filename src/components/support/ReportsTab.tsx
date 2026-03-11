"use client"

import { useState, useEffect, useMemo } from "react"
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import Counter from "@/components/dashboard/Counter"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  GREEN, AMBER, RED, BLUE, PURPLE, ROSE_GOLD,
  STATUSES, STATUS_COLORS, CATEGORIES, CATEGORY_LABELS,
  CHANNELS, fmtDuration, fmtDate,
} from "./constants"
import type { DailyStats, SupportTicket } from "./types"

interface ReportsTabProps {
  tickets: SupportTicket[]
}

type RangePreset = "7" | "30" | "90" | "custom"

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1A1D27", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
      <div style={{ color: TEXT_TERTIARY, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number" && p.name.includes("Time") ? fmtDuration(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

const kpiLabel: React.CSSProperties = {
  fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 6,
}
const kpiValue: React.CSSProperties = {
  fontFamily: "'Bellfair', serif", fontSize: 28, color: TEXT_PRIMARY, lineHeight: 1.1,
}

export default function ReportsTab({ tickets }: ReportsTabProps) {
  const [range, setRange] = useState<RangePreset>("30")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [daily, setDaily] = useState<DailyStats[]>([])
  const [agentComparison, setAgentComparison] = useState<Record<string, { handled: number; avgResolutionMs: number }>>({})
  const [categoryCount, setCategoryCount] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  // Compute date range
  const { dateFrom, dateTo } = useMemo(() => {
    if (range === "custom" && customFrom && customTo) return { dateFrom: customFrom, dateTo: customTo }
    const now = new Date()
    const from = new Date()
    from.setDate(from.getDate() - parseInt(range))
    return {
      dateFrom: from.toISOString().split("T")[0],
      dateTo: now.toISOString().split("T")[0],
    }
  }, [range, customFrom, customTo])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ dateFrom, dateTo })
    fetch(`/api/support/stats/daily?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setDaily(data.daily ?? [])
        setAgentComparison(data.agentComparison ?? {})
        setCategoryCount(data.categoryCount ?? {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  // Filter tickets in range
  const rangeTickets = useMemo(() => {
    const from = new Date(dateFrom).getTime()
    const to = new Date(dateTo + "T23:59:59Z").getTime()
    return tickets.filter((t) => {
      const ct = new Date(t.createdAt).getTime()
      return ct >= from && ct <= to
    })
  }, [tickets, dateFrom, dateTo])

  // KPIs
  const totalInRange = rangeTickets.length
  const resolvedInRange = rangeTickets.filter((t) => t.resolvedAt)
  const resolutionRate = totalInRange > 0 ? (resolvedInRange.length / totalInRange * 100) : 0

  const avgFirstResponse = useMemo(() => {
    const withResp = rangeTickets.filter((t) => t.firstResponseAt)
    if (withResp.length === 0) return 0
    return withResp.reduce((s, t) => s + (new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime()), 0) / withResp.length
  }, [rangeTickets])

  const avgResolution = useMemo(() => {
    if (resolvedInRange.length === 0) return 0
    return resolvedInRange.reduce((s, t) => s + (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()), 0) / resolvedInRange.length
  }, [resolvedInRange])

  const numDays = Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000))
  const ticketsPerDay = totalInRange / numDays

  // Chart data
  const volumeData = daily.map((d) => ({
    date: d.date.substring(5),
    Opened: d.opened,
    Resolved: d.resolved,
  }))

  const responseTimeData = daily.map((d) => ({
    date: d.date.substring(5),
    "Avg Response (min)": Math.round(d.avgResponseMs / 60000),
  }))

  const catData = CATEGORIES.map((c) => ({
    category: c.label,
    count: categoryCount[c.id] || 0,
  })).filter((d) => d.count > 0).sort((a, b) => b.count - a.count)

  const agentData = Object.entries(agentComparison)
    .filter(([name]) => name !== "Unassigned")
    .map(([name, data]) => ({
      name,
      Tickets: data.handled,
      "Avg Resolution (h)": Math.round(data.avgResolutionMs / 3600000 * 10) / 10,
    }))

  // Status breakdown
  const statusData = STATUSES.map((s) => ({
    status: s.label,
    count: rangeTickets.filter((t) => t.status === s.id).length,
    color: s.color,
  })).filter((d) => d.count > 0)

  const selectSt: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`,
    background: CARD_BG, color: TEXT_SECONDARY, fontSize: 10,
    fontFamily: "'DM Sans', sans-serif", outline: "none", cursor: "pointer",
  }

  /* ── CSV Export ── */
  const exportCSV = () => {
    const headers = ["ID", "Subject", "Client", "Channel", "Category", "Priority", "Status", "Assigned To", "Created", "Resolved"]
    const rows = rangeTickets.map((t) => [
      t.id, t.subject, t.clientName, t.channel,
      CATEGORY_LABELS[t.category || "general"] || t.category || "",
      t.priority, t.status, t.assignedTo || "",
      new Date(t.createdAt).toISOString(),
      t.resolvedAt ? new Date(t.resolvedAt).toISOString() : "",
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `support-report-${dateFrom}-to-${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Range selector */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {(["7", "30", "90"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
              border: `1px solid ${range === r ? ROSE_GOLD : CARD_BORDER}`,
              background: range === r ? "rgba(192,139,136,0.1)" : "transparent",
              color: range === r ? ROSE_GOLD : TEXT_TERTIARY,
            }}
          >
            Last {r} days
          </button>
        ))}
        <button
          onClick={() => setRange("custom")}
          style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            border: `1px solid ${range === "custom" ? ROSE_GOLD : CARD_BORDER}`,
            background: range === "custom" ? "rgba(192,139,136,0.1)" : "transparent",
            color: range === "custom" ? ROSE_GOLD : TEXT_TERTIARY,
          }}
        >
          Custom
        </button>
        {range === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={selectSt} />
            <span style={{ color: TEXT_TERTIARY, fontSize: 10 }}>to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={selectSt} />
          </>
        )}
        <button
          onClick={exportCSV}
          style={{
            marginLeft: "auto", padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT_SECONDARY,
          }}
        >
          Export CSV
        </button>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 20, color: TEXT_TERTIARY, fontSize: 12 }}>Loading report data...</div>}

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={kpiLabel}>Total Tickets</div>
          <div style={kpiValue}><Counter target={totalInRange} /></div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={kpiLabel}>Avg First Response</div>
          <div style={{ ...kpiValue, fontSize: 22 }}>{fmtDuration(avgFirstResponse)}</div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={kpiLabel}>Avg Resolution</div>
          <div style={{ ...kpiValue, fontSize: 22 }}>{fmtDuration(avgResolution)}</div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={kpiLabel}>Resolution Rate</div>
          <div style={{ ...kpiValue, color: resolutionRate >= 70 ? GREEN : AMBER }}>{resolutionRate.toFixed(0)}%</div>
        </div>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={kpiLabel}>Tickets / Day</div>
          <div style={kpiValue}>{ticketsPerDay.toFixed(1)}</div>
        </div>
      </div>

      {/* Charts row 1: Volume + Response Time */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            Ticket Volume Over Time
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Opened" stroke={AMBER} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Resolved" stroke={GREEN} strokeWidth={2} dot={false} />
              <Legend wrapperStyle={{ fontSize: 10, color: TEXT_TERTIARY }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            Response Time Trend
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Avg Response (min)" stroke={BLUE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2: Status + Categories */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            Tickets by Status
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="status" tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#1A1D27", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            Top Categories
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catData} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="category" type="category" tick={{ fill: TEXT_SECONDARY, fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ background: "#1A1D27", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" fill={ROSE_GOLD} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Comparison */}
      {agentData.length > 0 && (
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            Agent Comparison
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agentData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: TEXT_TERTIARY, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Tickets" fill={ROSE_GOLD} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Avg Resolution (h)" fill={GREEN} radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 10, color: TEXT_TERTIARY }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed Table */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, overflow: "auto" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
            Detailed Log ({rangeTickets.length} tickets)
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr>
              {["Subject", "Client", "Channel", "Category", "Priority", "Status", "Created", "Resolved"].map((h) => (
                <th key={h} style={{
                  padding: "8px 10px", fontSize: 9, fontWeight: 500, color: TEXT_TERTIARY,
                  textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif",
                  borderBottom: `1px solid ${CARD_BORDER}`, textAlign: "left",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rangeTickets.slice(0, 50).map((t) => {
              const sc = STATUS_COLORS[t.status] || STATUS_COLORS.open
              return (
                <tr key={t.id}>
                  <td style={{ padding: "8px 10px", fontSize: 10, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}`, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</td>
                  <td style={{ padding: "8px 10px", fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>{t.clientName}</td>
                  <td style={{ padding: "8px 10px", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>{t.channel}</td>
                  <td style={{ padding: "8px 10px", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>{CATEGORY_LABELS[t.category || "general"] || "—"}</td>
                  <td style={{ padding: "8px 10px", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}`, textTransform: "capitalize" }}>{t.priority}</td>
                  <td style={{ padding: "8px 10px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 9, background: sc.bg, color: sc.text, fontFamily: "'DM Sans', sans-serif" }}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>{fmtDate(t.createdAt)}</td>
                  <td style={{ padding: "8px 10px", fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid ${CARD_BORDER}` }}>{t.resolvedAt ? fmtDate(t.resolvedAt) : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
