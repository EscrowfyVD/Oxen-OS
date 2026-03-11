"use client"

import { useState, useMemo } from "react"
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  GREEN, AMBER, ROSE_GOLD, INDIGO, CYAN,
  PLATFORMS, PLATFORM_COLORS, fmtNum,
} from "./constants"
import type { SocialMetric } from "./types"

interface MetricsTabProps {
  metrics: SocialMetric[]
  onSave: (data: {
    platform: string; date: string; followers: number; impressions: number;
    engagement: number; clicks: number; posts: number
  }) => void
}

export default function MetricsTab({ metrics, onSave }: MetricsTabProps) {
  const [inputPlatform, setInputPlatform] = useState("linkedin")
  const [inputDate, setInputDate] = useState(new Date().toISOString().split("T")[0])
  const [inputFollowers, setInputFollowers] = useState("")
  const [inputImpressions, setInputImpressions] = useState("")
  const [inputEngagement, setInputEngagement] = useState("")
  const [inputClicks, setInputClicks] = useState("")
  const [inputPosts, setInputPosts] = useState("")
  const [saving, setSaving] = useState(false)

  const [filterPlatform, setFilterPlatform] = useState("all")
  const [chartPlatform, setChartPlatform] = useState("linkedin")

  const handleSubmit = async () => {
    setSaving(true)
    await onSave({
      platform: inputPlatform,
      date: inputDate,
      followers: parseInt(inputFollowers) || 0,
      impressions: parseInt(inputImpressions) || 0,
      engagement: parseInt(inputEngagement) || 0,
      clicks: parseInt(inputClicks) || 0,
      posts: parseInt(inputPosts) || 0,
    })
    setSaving(false)
    setInputFollowers(""); setInputImpressions(""); setInputEngagement(""); setInputClicks(""); setInputPosts("")
  }

  const filteredMetrics = useMemo(() => {
    let list = [...metrics]
    if (filterPlatform !== "all") list = list.filter((m) => m.platform === filterPlatform)
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [metrics, filterPlatform])

  // Chart data for selected platform
  const chartData = useMemo(() => {
    return metrics
      .filter((m) => m.platform === chartPlatform)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((m) => ({
        month: new Date(m.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        Followers: m.followers,
        Impressions: m.impressions,
        Engagement: m.engagement,
      }))
  }, [metrics, chartPlatform])

  return (
    <div>
      {/* Input Section */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY, marginBottom: 14 }}>
          Add Metrics
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <label style={labelSt}>Platform</label>
            <select value={inputPlatform} onChange={(e) => setInputPlatform(e.target.value)} style={inputSt}>
              {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Date</label>
            <input type="date" value={inputDate} onChange={(e) => setInputDate(e.target.value)} style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Followers</label>
            <input type="number" value={inputFollowers} onChange={(e) => setInputFollowers(e.target.value)} placeholder="0" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Impressions</label>
            <input type="number" value={inputImpressions} onChange={(e) => setInputImpressions(e.target.value)} placeholder="0" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Engagement</label>
            <input type="number" value={inputEngagement} onChange={(e) => setInputEngagement(e.target.value)} placeholder="0" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Clicks</label>
            <input type="number" value={inputClicks} onChange={(e) => setInputClicks(e.target.value)} placeholder="0" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Posts</label>
            <input type="number" value={inputPosts} onChange={(e) => setInputPosts(e.target.value)} placeholder="0" style={inputSt} />
          </div>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary" style={{ padding: "8px 16px", fontSize: 11, height: 34 }}>
            {saving ? "..." : "Save"}
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>
          Manual entry for now — API integration coming soon
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT_PRIMARY }}>
              Platform Trends
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setChartPlatform(p.id)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif", cursor: "pointer", border: "none",
                    background: chartPlatform === p.id ? `${p.color}20` : "transparent",
                    color: chartPlatform === p.id ? p.color : TEXT_TERTIARY,
                    transition: "all 0.15s",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: TEXT_TERTIARY }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: TEXT_TERTIARY }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif" }} />
              <Line type="monotone" dataKey="Followers" stroke={PLATFORM_COLORS[chartPlatform]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Impressions" stroke={AMBER} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Engagement" stroke={GREEN} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Table */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: TEXT_PRIMARY }}>Historical Data</div>
          <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} style={{ ...inputSt, width: 140 }}>
            <option value="all">All Platforms</option>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Date", "Platform", "Followers", "Impressions", "Engagement", "Clicks", "Posts"].map((h) => (
                <th key={h} style={{
                  textAlign: h === "Date" || h === "Platform" ? "left" : "right",
                  padding: "8px 14px", fontSize: 10, fontWeight: 600, color: TEXT_TERTIARY,
                  textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${CARD_BORDER}`,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.slice(0, 30).map((m) => (
              <tr key={m.id}>
                <td style={tdSt}>{new Date(m.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                <td style={tdSt}>
                  <span style={{ color: PLATFORM_COLORS[m.platform] || TEXT_SECONDARY, fontWeight: 500, textTransform: "capitalize" }}>
                    {m.platform === "twitter" ? "X" : m.platform}
                  </span>
                </td>
                <td style={{ ...tdSt, textAlign: "right", fontFamily: "'Bellfair', serif", fontSize: 13 }}>{fmtNum(m.followers)}</td>
                <td style={{ ...tdSt, textAlign: "right" }}>{fmtNum(m.impressions)}</td>
                <td style={{ ...tdSt, textAlign: "right" }}>{fmtNum(m.engagement)}</td>
                <td style={{ ...tdSt, textAlign: "right" }}>{fmtNum(m.clicks)}</td>
                <td style={{ ...tdSt, textAlign: "right" }}>{m.posts}</td>
              </tr>
            ))}
            {filteredMetrics.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 30, textAlign: "center", color: TEXT_TERTIARY, fontSize: 12 }}>
                  No metrics data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = {
  display: "block", fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase",
  letterSpacing: 0.5, marginBottom: 4, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
}

const inputSt: React.CSSProperties = {
  width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`,
  background: "rgba(255,255,255,0.02)", color: TEXT_PRIMARY, fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}

const tdSt: React.CSSProperties = {
  padding: "8px 14px", fontSize: 12, color: TEXT_SECONDARY,
  fontFamily: "'DM Sans', sans-serif", borderBottom: "1px solid rgba(255,255,255,0.03)",
}
