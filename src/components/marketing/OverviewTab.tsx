"use client"

import { useMemo } from "react"
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import Counter from "@/components/dashboard/Counter"
import Sparkline from "@/components/dashboard/Sparkline"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  GREEN, AMBER, ROSE_GOLD, INDIGO,
  PLATFORMS, PLATFORM_COLORS, fmtNum,
} from "./constants"
import type { MarketingSummary } from "./types"

interface OverviewTabProps {
  summary: MarketingSummary | null
}

const kpiLabel: React.CSSProperties = {
  fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 6,
}
const kpiValue: React.CSSProperties = {
  fontFamily: "'Bellfair', serif", fontSize: 28, color: TEXT_PRIMARY, lineHeight: 1.1,
}
const cardStyle: React.CSSProperties = {
  background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20,
}
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, marginBottom: 14,
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: TEXT_TERTIARY, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {fmtNum(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function OverviewTab({ summary }: OverviewTabProps) {
  if (!summary) {
    return <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_TERTIARY, fontSize: 13 }}>Loading overview...</div>
  }

  // Build follower trend chart data
  const followerTrendData = useMemo(() => {
    const months = Object.keys(summary.trendByMonth).sort()
    return months.map((m) => {
      const entry: Record<string, string | number> = { month: m.substring(5) }
      for (const p of PLATFORMS) {
        entry[p.label] = summary.trendByMonth[m]?.[p.id]?.followers || 0
      }
      return entry
    })
  }, [summary.trendByMonth])

  // Engagement by platform (current month)
  const engagementData = PLATFORMS.map((p) => ({
    platform: p.label,
    Engagement: summary.currentMonthByPlatform[p.id]?.engagement || 0,
    fill: p.color,
  }))

  // Posts per month
  const postsData = useMemo(() => {
    const months = Object.keys(summary.trendByMonth).sort()
    return months.map((m) => {
      let total = 0
      for (const p of PLATFORMS) {
        total += summary.trendByMonth[m]?.[p.id]?.posts || 0
      }
      return { month: m.substring(5), Posts: total }
    })
  }, [summary.trendByMonth])

  // Sparkline data per platform
  const getSparkData = (platformId: string) => {
    const months = Object.keys(summary.trendByMonth).sort()
    return months.map((m) => summary.trendByMonth[m]?.[platformId]?.followers || 0)
  }

  return (
    <div>
      {/* KPI Cards */}
      <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20, animationDelay: "0.05s" }}>
        <div className="kpi-card" style={{ padding: 18 }}>
          <div style={kpiLabel}>Total Followers</div>
          <div style={kpiValue}><Counter target={summary.totalFollowers} /></div>
        </div>
        <div className="kpi-card" style={{ padding: 18 }}>
          <div style={kpiLabel}>Monthly Impressions</div>
          <div style={kpiValue}><Counter target={summary.monthlyImpressions} /></div>
        </div>
        <div className="kpi-card" style={{ padding: 18 }}>
          <div style={kpiLabel}>Engagement Rate</div>
          <div style={{ ...kpiValue, color: summary.engagementRate > 3 ? GREEN : AMBER }}>
            {summary.engagementRate.toFixed(1)}%
          </div>
        </div>
        <div className="kpi-card" style={{ padding: 18 }}>
          <div style={kpiLabel}>Content Pipeline</div>
          <div style={{ ...kpiValue, color: INDIGO }}>{summary.contentPipeline}</div>
          <div style={{ fontSize: 10, color: TEXT_TERTIARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>drafts + scheduled</div>
        </div>
      </div>

      {/* Platform Cards */}
      <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20, animationDelay: "0.1s" }}>
        {PLATFORMS.map((p) => {
          const latest = summary.latestByPlatform[p.id]
          const growth = summary.followerGrowth[p.id] || 0
          const monthData = summary.currentMonthByPlatform[p.id]
          const sparkData = getSparkData(p.id)

          return (
            <div key={p.id} style={{ ...cardStyle, position: "relative", overflow: "hidden" }}>
              {/* Subtle platform color accent line at top */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${p.color}, transparent)` }} />

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: p.color, fontFamily: "'DM Sans', sans-serif" }}>{p.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>{p.label}</span>
              </div>

              <div style={{ fontFamily: "'Bellfair', serif", fontSize: 26, color: TEXT_PRIMARY, lineHeight: 1.1 }}>
                {latest ? fmtNum(latest.followers) : "—"}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: growth >= 0 ? GREEN : "#F87171", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  {growth >= 0 ? "\u25B2" : "\u25BC"} {Math.abs(growth)} this month
                </span>
              </div>

              <div style={{ display: "flex", gap: 16, fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                <span>{fmtNum(monthData?.impressions || 0)} imp</span>
                <span>{fmtNum(monthData?.engagement || 0)} eng</span>
              </div>

              <div style={{ position: "absolute", bottom: 8, right: 10, opacity: 0.4 }}>
                <Sparkline data={sparkData.length >= 2 ? sparkData : [0, 1, 2]} color={p.color} width={60} height={22} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14, animationDelay: "0.15s" }}>
        {/* Follower Growth */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Follower Growth</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={followerTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: TEXT_TERTIARY }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: TEXT_TERTIARY }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} />
              {PLATFORMS.map((p) => (
                <Line key={p.id} type="monotone" dataKey={p.label} stroke={p.color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement by Platform */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Engagement by Platform</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="platform" tick={{ fontSize: 10, fill: TEXT_TERTIARY }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: TEXT_TERTIARY }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Engagement" radius={[4, 4, 0, 0]}>
                {engagementData.map((d, i) => (
                  <rect key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Content Output */}
      <div className="fade-in" style={{ animationDelay: "0.2s" }}>
        <div style={cardStyle}>
          <div style={sectionTitle}>Content Output</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={postsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: TEXT_TERTIARY }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: TEXT_TERTIARY }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Posts" fill={ROSE_GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
