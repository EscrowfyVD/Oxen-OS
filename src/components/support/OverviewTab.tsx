"use client"

import { useMemo } from "react"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import Counter from "@/components/dashboard/Counter"
import Sparkline from "@/components/dashboard/Sparkline"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  GREEN, AMBER, RED, BLUE, PURPLE, ROSE_GOLD,
  CHANNELS, CHANNEL_COLORS, CATEGORIES, CATEGORY_LABELS,
  STATUS_COLORS, fmtDuration, fmtDurationShort, timeAgo,
} from "./constants"
import type { SupportStats, DailyStats } from "./types"

interface OverviewTabProps {
  stats: SupportStats | null
  daily: DailyStats[]
}

const kpiLabel: React.CSSProperties = {
  fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 6,
}
const kpiValue: React.CSSProperties = {
  fontFamily: "'Bellfair', serif", fontSize: 28, color: TEXT_PRIMARY, lineHeight: 1.1,
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1A1D27", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
      <div style={{ color: TEXT_TERTIARY, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

export default function OverviewTab({ stats, daily }: OverviewTabProps) {
  if (!stats) {
    return <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 13 }}>Loading overview...</div>
  }

  /* ── Chart data ── */
  const volumeData = useMemo(() =>
    daily.slice(-30).map((d) => ({
      date: d.date.substring(5),
      Opened: d.opened,
      Resolved: d.resolved,
    })), [daily])

  const channelData = useMemo(() =>
    CHANNELS.map((ch) => ({
      name: ch.label,
      value: stats.byChannel[ch.id] || 0,
      color: ch.color,
    })).filter((d) => d.value > 0), [stats.byChannel])

  const categoryData = useMemo(() =>
    CATEGORIES.map((cat) => ({
      category: cat.label,
      count: stats.byCategory[cat.id] || 0,
    })).filter((d) => d.count > 0).sort((a, b) => b.count - a.count), [stats.byCategory])

  const agents = Object.keys(stats.agentStats).filter((a) => a !== "Unassigned")

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {/* Open Tickets */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={kpiLabel}>Open Tickets</div>
          <div style={kpiValue}><Counter target={stats.openCount} /></div>
        </div>
        {/* Avg Response Time */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={kpiLabel}>Avg Response Time</div>
          <div style={{ ...kpiValue, color: stats.avgResponseMs > 3600000 ? AMBER : GREEN }}>
            {fmtDuration(stats.avgResponseMs)}
          </div>
        </div>
        {/* Avg Resolution Time */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={kpiLabel}>Avg Resolution Time</div>
          <div style={{ ...kpiValue, color: stats.avgResolutionMs > 86400000 ? AMBER : GREEN }}>
            {fmtDuration(stats.avgResolutionMs)}
          </div>
        </div>
        {/* Resolved Today */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={kpiLabel}>Resolved Today</div>
          <div style={{ ...kpiValue, color: GREEN }}><Counter target={stats.resolvedToday} /></div>
        </div>
        {/* Satisfaction */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18, opacity: 0.5 }}>
          <div style={kpiLabel}>Client Satisfaction</div>
          <div style={{ ...kpiValue, fontSize: 14, color: TEXT_TERTIARY, marginTop: 8 }}>Coming soon</div>
        </div>
      </div>

      {/* Charts row: Volume + Channel donut */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        {/* Ticket Volume */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            Ticket Volume (Last 30 Days)
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volumeData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Opened" fill={AMBER} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Resolved" fill={GREEN} radius={[3, 3, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 10, color: TEXT_TERTIARY }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Channel donut */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            By Channel
          </div>
          {channelData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={channelData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                    {channelData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1A1D27", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
                {channelData.map((d) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: TEXT_TERTIARY }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 11 }}>No data</div>
          )}
        </div>
      </div>

      {/* Category bar chart */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
          Tickets by Category
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={categoryData} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" tick={{ fill: TEXT_TERTIARY, fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="category" type="category" tick={{ fill: TEXT_SECONDARY, fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
            <Tooltip contentStyle={{ background: "#1A1D27", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="count" fill={ROSE_GOLD} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Team Performance + Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Team Performance */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            Team Performance (This Week)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {agents.map((agent) => {
              const s = stats.agentStats[agent]
              const sparkData = stats.agentDailyResolved[agent] || [0, 0, 0, 0, 0, 0, 0]
              const initials = agent.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
              return (
                <div key={agent} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: 12,
                  background: "rgba(255,255,255,0.02)", borderRadius: 10,
                  border: `1px solid ${CARD_BORDER}`,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, #C08B88, #8B6B68)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#FFF" }}>{initials}</span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>{agent}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                        Assigned: <span style={{ color: TEXT_SECONDARY }}>{s.assigned}</span>
                      </span>
                      <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                        Resolved: <span style={{ color: GREEN }}>{s.resolved}</span>
                      </span>
                      <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                        Resp: <span style={{ color: TEXT_SECONDARY }}>{fmtDurationShort(s.avgResponseMs)}</span>
                      </span>
                      <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                        Res: <span style={{ color: TEXT_SECONDARY }}>{fmtDurationShort(s.avgResolutionMs)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Sparkline */}
                  <Sparkline data={sparkData} color={GREEN} width={80} height={28} />
                </div>
              )
            })}
            {agents.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: TEXT_TERTIARY, fontSize: 11 }}>No agent data</div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            Recent Activity
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {stats.recentActivity.map((item) => {
              const sc = STATUS_COLORS[item.status] || STATUS_COLORS.open
              return (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                  borderBottom: `1px solid ${CARD_BORDER}`,
                }}>
                  <div style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 500,
                    background: sc.bg, color: sc.text, fontFamily: "'DM Sans', sans-serif",
                    flexShrink: 0,
                  }}>
                    {item.status.replace(/_/g, " ")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.assignedTo && <span style={{ color: ROSE_GOLD }}>{item.assignedTo}</span>}
                      {item.assignedTo && " — "}
                      {item.subject}
                    </div>
                    <div style={{ fontSize: 9, color: TEXT_TERTIARY, marginTop: 2 }}>
                      {CATEGORY_LABELS[item.category || "general"] || "General"}
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: TEXT_TERTIARY, flexShrink: 0 }}>{timeAgo(item.updatedAt)}</span>
                </div>
              )
            })}
            {stats.recentActivity.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: TEXT_TERTIARY, fontSize: 11 }}>No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
