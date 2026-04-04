"use client"

import { useState, useEffect } from "react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, LineChart, Line,
} from "recharts"

/* ── Design tokens ── */
const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"
const RED = "#F87171"
const INDIGO = "#818CF8"
const CYAN = "#22D3EE"

const VERTICAL_COLORS: Record<string, string> = {
  "FinTech / Crypto": "#818CF8",
  "Family Office": "#C08B88",
  "CSP / Fiduciaries": "#FBBF24",
  "Luxury Assets": "#A78BFA",
  "iGaming": "#34D399",
  "Yacht Brokers": "#22D3EE",
  "Import / Export": "#60A5FA",
}

const POSITION_COLORS = {
  page1: GREEN,
  page2: AMBER,
  page3: RED,
  notRanking: "rgba(240,240,242,0.2)",
}

/* ── Types ── */
interface KeywordReport {
  positionDistribution: {
    page1: number
    page2: number
    page3Plus: number
    notRanking: number
  }
  totalKeywords: number
  gainedPage1: number
  lostPage1: number
  perVertical: { vertical: string; page1Count: number }[]
  topArticles: {
    title: string
    sessions30d: number
    bestPosition: number
    keywordsRanking: number
  }[]
  contentDecay: { title: string; trafficDrop: number }[]
}

interface GeoReport {
  citationTrend: { week: string; rate: number }[]
  shareOfVoice: { name: string; share: number }[]
  perVertical: { vertical: string; citationRate: number }[]
  gainedThisMonth: number
  lostThisMonth: number
}

interface ArticleReport {
  publishedThisMonth: number
  totalArticles: number
  averageWordCount: number
  queueDepth: number
  perVertical: { vertical: string; count: number }[]
}

/* ── Shared styles ── */
const cardStyle: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  padding: 24,
  backdropFilter: "blur(20px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Bellfair', serif",
  fontSize: 20,
  color: TEXT_PRIMARY,
  marginBottom: 20,
}

const kpiLabel: React.CSSProperties = {
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
  marginBottom: 4,
}

const kpiValue: React.CSSProperties = {
  fontFamily: "'Bellfair', serif",
  fontSize: 26,
  color: TEXT_PRIMARY,
  lineHeight: 1.1,
}

const tooltipStyle: React.CSSProperties = {
  background: "rgba(15,17,24,0.95)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8,
  fontSize: 11,
  fontFamily: "'DM Sans', sans-serif",
  color: TEXT_PRIMARY,
  padding: "6px 10px",
}

const tableHeader: React.CSSProperties = {
  textAlign: "left" as const,
  padding: "8px 10px",
  color: TEXT_TERTIARY,
  fontSize: 10,
  fontWeight: 600,
  fontFamily: "'DM Sans', sans-serif",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  borderBottom: `1px solid ${CARD_BORDER}`,
}

const tableCell: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 12,
  fontFamily: "'DM Sans', sans-serif",
  color: TEXT_SECONDARY,
  borderBottom: `1px solid ${CARD_BORDER}`,
}

/* ── Skeleton card ── */
function SkeletonCard({ height = 300 }: { height?: number }) {
  return (
    <div
      style={{
        ...cardStyle,
        height,
        animation: "seoReportPulse 1.5s ease-in-out infinite",
        opacity: 0.4,
      }}
    />
  )
}

/* ── Custom Pie center label ── */
function PieCenterLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        style={{ fontFamily: "'Bellfair', serif", fontSize: 24 }}
        fill={TEXT_PRIMARY}
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9 }}
        fill={TEXT_TERTIARY}
      >
        keywords
      </text>
    </>
  )
}

/* ── Component ── */
export default function SeoReportsTab() {
  const [keywordReport, setKeywordReport] = useState<KeywordReport | null>(null)
  const [geoReport, setGeoReport] = useState<GeoReport | null>(null)
  const [articleReport, setArticleReport] = useState<ArticleReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      const results = await Promise.allSettled([
        fetch("/api/seo/reports/keywords").then((r) => {
          if (!r.ok) throw new Error("keywords fetch failed")
          return r.json()
        }),
        fetch("/api/seo/reports/articles").then((r) => {
          if (!r.ok) throw new Error("articles fetch failed")
          return r.json()
        }),
        fetch("/api/seo/reports/geo").then((r) => {
          if (!r.ok) throw new Error("geo fetch failed")
          return r.json()
        }),
      ])

      if (results[0].status === "fulfilled") setKeywordReport(results[0].value)
      if (results[1].status === "fulfilled") setArticleReport(results[1].value)
      if (results[2].status === "fulfilled") setGeoReport(results[2].value)

      setLoading(false)
    }
    fetchAll()
  }, [])

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SkeletonCard height={360} />
        <SkeletonCard height={300} />
        <SkeletonCard height={260} />
        <style>{`@keyframes seoReportPulse{0%,100%{opacity:.25}50%{opacity:.5}}`}</style>
      </div>
    )
  }

  /* ── Pie data ── */
  const pieData = keywordReport
    ? [
        { name: "Page 1 (1-10)", value: keywordReport.positionDistribution.page1, color: POSITION_COLORS.page1 },
        { name: "Page 2 (11-20)", value: keywordReport.positionDistribution.page2, color: POSITION_COLORS.page2 },
        { name: "Page 3+ (21+)", value: keywordReport.positionDistribution.page3Plus, color: POSITION_COLORS.page3 },
        { name: "Not ranking", value: keywordReport.positionDistribution.notRanking, color: POSITION_COLORS.notRanking },
      ]
    : []

  const netPage1 = keywordReport
    ? keywordReport.gainedPage1 - keywordReport.lostPage1
    : 0

  /* ── Bar data for verticals ── */
  const verticalBarData = (keywordReport?.perVertical ?? []).map((v) => ({
    vertical: v.vertical,
    keywords: v.page1Count,
    fill: VERTICAL_COLORS[v.vertical] ?? TEXT_TERTIARY,
  }))

  /* ── GEO share of voice ── */
  const sovData = (geoReport?.shareOfVoice ?? []).map((entry, i) => ({
    ...entry,
    fill: i === 0 ? ROSE_GOLD : `rgba(240,240,242,${Math.max(0.12, 0.35 - i * 0.06)})`,
  }))

  /* ── Article vertical bars ── */
  const articleBarData = (articleReport?.perVertical ?? []).map((v) => ({
    vertical: v.vertical,
    count: v.count,
    fill: VERTICAL_COLORS[v.vertical] ?? TEXT_TERTIARY,
  }))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`@keyframes seoReportPulse{0%,100%{opacity:.25}50%{opacity:.5}}`}</style>

      {/* ════════════ Section 1: SEO Performance ════════════ */}
      <div style={cardStyle}>
        <div style={sectionTitle}>SEO Performance</div>

        {/* Row 1: Pie + Stats */}
        <div style={{ display: "flex", gap: 32, alignItems: "center", marginBottom: 28, flexWrap: "wrap" }}>
          {keywordReport && (
            <>
              <div style={{ width: 200, height: 200, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: TEXT_PRIMARY }}
                    />
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ fontFamily: "'Bellfair', serif", fontSize: 26 }}
                      fill={TEXT_PRIMARY}
                    >
                      {keywordReport.totalKeywords}
                    </text>
                    <text
                      x="50%"
                      y="57%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9 }}
                      fill={TEXT_TERTIARY}
                    >
                      keywords
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={kpiLabel}>Gained Page 1</div>
                  <div style={{ ...kpiValue, fontSize: 22, color: GREEN }}>
                    +{keywordReport.gainedPage1}
                  </div>
                </div>
                <div>
                  <div style={kpiLabel}>Lost Page 1</div>
                  <div style={{ ...kpiValue, fontSize: 22, color: RED }}>
                    -{keywordReport.lostPage1}
                  </div>
                </div>
                <div>
                  <div style={kpiLabel}>Net</div>
                  <div
                    style={{
                      ...kpiValue,
                      fontSize: 22,
                      color: netPage1 >= 0 ? GREEN : RED,
                    }}
                  >
                    {netPage1 >= 0 ? "+" : ""}
                    {netPage1}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: "auto" }}>
                {pieData.map((d) => (
                  <div
                    key={d.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      fontFamily: "'DM Sans', sans-serif",
                      color: TEXT_SECONDARY,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: d.color,
                        flexShrink: 0,
                      }}
                    />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Row 2: Vertical keyword health bar chart */}
        {verticalBarData.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: 12,
              }}
            >
              Keywords on Page 1 by Vertical
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={verticalBarData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke={CARD_BORDER} />
                <XAxis
                  dataKey="vertical"
                  tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                  axisLine={{ stroke: CARD_BORDER }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: TEXT_TERTIARY, fontSize: 10 }}
                  axisLine={{ stroke: CARD_BORDER }}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="keywords" radius={[4, 4, 0, 0]}>
                  {verticalBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Row 3: Top performing articles */}
        {keywordReport && keywordReport.topArticles.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: 10,
              }}
            >
              Top Performing Articles
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Title", "Sessions (30d)", "Best Position", "Keywords Ranking"].map((h) => (
                      <th key={h} style={tableHeader}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywordReport.topArticles.map((a, i) => (
                    <tr key={i}>
                      <td style={{ ...tableCell, color: TEXT_PRIMARY, fontWeight: 500, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.title}
                      </td>
                      <td style={tableCell}>{a.sessions30d.toLocaleString()}</td>
                      <td style={tableCell}>{a.bestPosition}</td>
                      <td style={tableCell}>{a.keywordsRanking}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Content decay */}
        {keywordReport && keywordReport.contentDecay.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: 10,
              }}
            >
              Content Decay
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {keywordReport.contentDecay.map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "rgba(248,113,113,0.06)",
                    borderRadius: 8,
                    border: `1px solid ${RED}22`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif",
                      color: TEXT_PRIMARY,
                      maxWidth: "70%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.title}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "'Bellfair', serif",
                      color: RED,
                      fontWeight: 700,
                    }}
                  >
                    {d.trafficDrop}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ════════════ Section 2: GEO Performance ════════════ */}
      <div style={cardStyle}>
        <div style={sectionTitle}>GEO Performance</div>

        {geoReport ? (
          <>
            {/* Citation rate trend */}
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_SECONDARY,
                  fontFamily: "'DM Sans', sans-serif",
                  marginBottom: 12,
                }}
              >
                Citation Rate Trend (8 weeks)
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={geoReport.citationTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CARD_BORDER} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                    axisLine={{ stroke: CARD_BORDER }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: TEXT_TERTIARY, fontSize: 10 }}
                    axisLine={{ stroke: CARD_BORDER }}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown) => [`${value}%`, "Citation Rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke={ROSE_GOLD}
                    strokeWidth={2}
                    dot={{ fill: ROSE_GOLD, r: 3 }}
                    activeDot={{ r: 5, fill: ROSE_GOLD }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Share of voice */}
            {sovData.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: TEXT_SECONDARY,
                    fontFamily: "'DM Sans', sans-serif",
                    marginBottom: 12,
                  }}
                >
                  Share of Voice
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={sovData} barSize={32} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={CARD_BORDER} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: TEXT_TERTIARY, fontSize: 10 }}
                      axisLine={{ stroke: CARD_BORDER }}
                      tickLine={false}
                      unit="%"
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fill: TEXT_SECONDARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}
                      axisLine={{ stroke: CARD_BORDER }}
                      tickLine={false}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: unknown) => [`${value}%`, "Share"]}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="share" radius={[0, 4, 4, 0]}>
                      {sovData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Per-vertical citation rates */}
            {geoReport.perVertical.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: TEXT_SECONDARY,
                    fontFamily: "'DM Sans', sans-serif",
                    marginBottom: 12,
                  }}
                >
                  Citation Rates by Vertical
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {geoReport.perVertical.map((v) => {
                    const barColor = VERTICAL_COLORS[v.vertical] ?? TEXT_TERTIARY
                    return (
                      <div key={v.vertical}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: "'DM Sans', sans-serif",
                              color: TEXT_SECONDARY,
                            }}
                          >
                            {v.vertical}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: "'Bellfair', serif",
                              color: TEXT_PRIMARY,
                            }}
                          >
                            {v.citationRate}%
                          </span>
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: 8,
                            borderRadius: 4,
                            background: "rgba(240,240,242,0.06)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(v.citationRate, 100)}%`,
                              height: "100%",
                              borderRadius: 4,
                              background: barColor,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stats row */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={kpiLabel}>Lost this month</div>
                <div style={{ ...kpiValue, fontSize: 20, color: RED }}>
                  {geoReport.lostThisMonth}
                </div>
              </div>
              <div>
                <div style={kpiLabel}>Gained this month</div>
                <div style={{ ...kpiValue, fontSize: 20, color: GREEN }}>
                  {geoReport.gainedThisMonth}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              color: TEXT_SECONDARY,
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            No GEO data available.
          </div>
        )}
      </div>

      {/* ════════════ Section 3: Blog Performance ════════════ */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Blog Performance</div>

        {articleReport ? (
          <>
            {/* Stats row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div>
                <div style={kpiLabel}>Published this month</div>
                <div style={kpiValue}>{articleReport.publishedThisMonth}</div>
              </div>
              <div>
                <div style={kpiLabel}>Total articles</div>
                <div style={kpiValue}>{articleReport.totalArticles}</div>
              </div>
              <div>
                <div style={kpiLabel}>Avg word count</div>
                <div style={kpiValue}>
                  {articleReport.averageWordCount.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={kpiLabel}>Queue depth</div>
                <div style={kpiValue}>{articleReport.queueDepth}</div>
              </div>
            </div>

            {/* Articles per vertical bar chart */}
            {articleBarData.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: TEXT_SECONDARY,
                    fontFamily: "'DM Sans', sans-serif",
                    marginBottom: 12,
                  }}
                >
                  Articles per Vertical (last 30 days)
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={articleBarData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CARD_BORDER} />
                    <XAxis
                      dataKey="vertical"
                      tick={{ fill: TEXT_TERTIARY, fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}
                      axisLine={{ stroke: CARD_BORDER }}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fill: TEXT_TERTIARY, fontSize: 10 }}
                      axisLine={{ stroke: CARD_BORDER }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="count" name="Articles" radius={[4, 4, 0, 0]}>
                      {articleBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              color: TEXT_SECONDARY,
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            No article data available.
          </div>
        )}
      </div>
    </div>
  )
}
