"use client"

import { useState, useEffect } from "react"

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

/* ── Types ── */
interface OverviewData {
  keywordsOnPage1: number
  keywordsOnPage1Delta: number
  averagePosition: number
  averagePositionDelta: number
  articlesPublishedThisMonth: number
  aiCitationRate: number
  aiCitationRateDelta: number
  keywordsGainedPage1: number
  keywordsLostPage1: number
  articlesInQueue: number
  articlesPublished: number
  geoCitationsGained: number
  geoCitationsLost: number
  verticalKeywordHealth: { vertical: string; healthy: number; warning: number; critical: number }[]
  recentArticles: {
    id: string
    title: string
    vertical: string
    publishedAt: string
    sessions7d: number | null
    bestPosition: number | null
  }[]
}

interface SeoAlert {
  id: string
  severity: "critical" | "warning" | "info"
  title: string
  detail: string
  resolved: boolean
  createdAt: string
}

/* ── Shared styles ── */
const cardStyle: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  padding: 20,
  backdropFilter: "blur(20px)",
}

const kpiLabel: React.CSSProperties = {
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
  marginBottom: 6,
}

const kpiValue: React.CSSProperties = {
  fontFamily: "'Bellfair', serif",
  fontSize: 28,
  color: TEXT_PRIMARY,
  lineHeight: 1.1,
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Bellfair', serif",
  fontSize: 18,
  color: TEXT_PRIMARY,
  marginBottom: 14,
}

const skeletonPulse: React.CSSProperties = {
  background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
  borderRadius: 6,
}

const VERTICAL_COLORS: Record<string, string> = {
  stablecoin: ROSE_GOLD,
  defi: INDIGO,
  compliance: GREEN,
  payments: CYAN,
  infrastructure: AMBER,
  general: TEXT_SECONDARY,
}

function getVerticalColor(v: string): string {
  return VERTICAL_COLORS[v?.toLowerCase()] || TEXT_SECONDARY
}

function fmtNum(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`
  return val.toLocaleString()
}

function TrendArrow({ delta, inverted }: { delta: number; inverted?: boolean }) {
  const improved = inverted ? delta < 0 : delta > 0
  const dropped = inverted ? delta > 0 : delta < 0
  const color = improved ? GREEN : dropped ? RED : TEXT_TERTIARY
  const arrow = improved ? "\u25B2" : dropped ? "\u25BC" : "\u2014"

  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
        color,
        marginLeft: 8,
      }}
    >
      {arrow} {Math.abs(delta)}
    </span>
  )
}

function LoadingSkeleton() {
  return (
    <div>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ ...cardStyle, height: 100 }}>
            <div style={{ ...skeletonPulse, width: "60%", height: 10, marginBottom: 12 }} />
            <div style={{ ...skeletonPulse, width: "40%", height: 28 }} />
          </div>
        ))}
      </div>
      <div style={{ ...cardStyle, height: 160, marginBottom: 20 }}>
        <div style={{ ...skeletonPulse, width: "30%", height: 14, marginBottom: 16 }} />
        <div style={{ ...skeletonPulse, width: "100%", height: 18, marginBottom: 8 }} />
        <div style={{ ...skeletonPulse, width: "80%", height: 18, marginBottom: 8 }} />
        <div style={{ ...skeletonPulse, width: "60%", height: 18 }} />
      </div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    critical: { bg: "rgba(248,113,113,0.15)", text: RED, label: "Critical" },
    warning: { bg: "rgba(251,191,36,0.15)", text: AMBER, label: "Warning" },
    info: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA", label: "Info" },
  }
  const c = config[severity] || config.info
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        background: c.bg,
        color: c.text,
      }}
    >
      {c.label}
    </span>
  )
}

export default function SeoOverview() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [alerts, setAlerts] = useState<SeoAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, alertsRes] = await Promise.all([
          fetch("/api/seo/reports/overview"),
          fetch("/api/seo/alerts?resolved=false"),
        ])
        if (overviewRes.ok) {
          const json = await overviewRes.json()
          setData(json)
        }
        if (alertsRes.ok) {
          const json = await alertsRes.json()
          setAlerts(json.alerts ?? [])
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleResolve = async (id: string) => {
    setResolvingId(id)
    try {
      await fetch(`/api/seo/alerts/${id}/resolve`, { method: "PATCH" })
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      /* silent */
    } finally {
      setResolvingId(null)
    }
  }

  if (loading) return <LoadingSkeleton />

  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  const sortedAlerts = [...alerts].sort(
    (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
  )

  return (
    <div>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>

      {/* KPI Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        {/* Keywords on Page 1 */}
        <div style={cardStyle}>
          <div style={kpiLabel}>Keywords on Page 1</div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={kpiValue}>{data?.keywordsOnPage1 ?? 0}</span>
            {data?.keywordsOnPage1Delta != null && (
              <TrendArrow delta={data.keywordsOnPage1Delta} />
            )}
          </div>
          <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
            vs last week
          </div>
        </div>

        {/* Average Position */}
        <div style={cardStyle}>
          <div style={kpiLabel}>Average Position</div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={kpiValue}>{data?.averagePosition?.toFixed(1) ?? "0"}</span>
            {data?.averagePositionDelta != null && (
              <TrendArrow delta={data.averagePositionDelta} inverted />
            )}
          </div>
          <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
            vs last week
          </div>
        </div>

        {/* Articles Published */}
        <div style={cardStyle}>
          <div style={kpiLabel}>Articles This Month</div>
          <span style={{ ...kpiValue, color: INDIGO }}>{data?.articlesPublishedThisMonth ?? 0}</span>
        </div>

        {/* AI Citation Rate */}
        <div style={cardStyle}>
          <div style={kpiLabel}>AI Citation Rate</div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ ...kpiValue, color: CYAN }}>{data?.aiCitationRate?.toFixed(1) ?? "0"}%</span>
            {data?.aiCitationRateDelta != null && (
              <TrendArrow delta={data.aiCitationRateDelta} />
            )}
          </div>
        </div>

        {/* Organic Sessions placeholder */}
        <div style={cardStyle}>
          <div style={kpiLabel}>Organic Sessions</div>
          <span style={{ ...kpiValue, color: TEXT_TERTIARY }}>&mdash;</span>
          <div
            style={{
              fontSize: 9,
              color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
              marginTop: 6,
              opacity: 0.6,
            }}
          >
            Connect GA
          </div>
        </div>

        {/* Domain Authority placeholder */}
        <div style={cardStyle}>
          <div style={kpiLabel}>Domain Authority</div>
          <span style={{ ...kpiValue, color: TEXT_TERTIARY }}>&mdash;</span>
          <div
            style={{
              fontSize: 9,
              color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
              marginTop: 6,
              opacity: 0.6,
            }}
          >
            Connect Ahrefs
          </div>
        </div>
      </div>

      {/* Alerts Panel */}
      {sortedAlerts.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={sectionTitle}>Active Alerts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                }}
              >
                <SeverityBadge severity={alert.severity} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: TEXT_PRIMARY,
                      fontFamily: "'DM Sans', sans-serif",
                      marginBottom: 2,
                    }}
                  >
                    {alert.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: TEXT_SECONDARY,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {alert.detail}
                  </div>
                </div>
                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolvingId === alert.id}
                  style={{
                    padding: "5px 14px",
                    fontSize: 10,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 600,
                    background: "transparent",
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: 6,
                    color: TEXT_SECONDARY,
                    cursor: "pointer",
                    opacity: resolvingId === alert.id ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {resolvingId === alert.id ? "..." : "Resolve"}
                </button>
              </div>
            ))}
          </div>
          {alerts.length > 5 && (
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                color: ROSE_GOLD,
                fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer",
                textAlign: "right",
              }}
            >
              View All Alerts ({alerts.length})
            </div>
          )}
        </div>
      )}

      {/* Quick Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {/* Keywords Gained vs Lost */}
        <div style={cardStyle}>
          <div style={kpiLabel}>Page 1 Keywords This Week</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
            <div>
              <span style={{ fontSize: 10, color: GREEN, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                +{data?.keywordsGainedPage1 ?? 0} gained
              </span>
            </div>
            <div>
              <span style={{ fontSize: 10, color: RED, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                -{data?.keywordsLostPage1 ?? 0} lost
              </span>
            </div>
          </div>
        </div>

        {/* Articles Queue vs Published */}
        <div style={cardStyle}>
          <div style={kpiLabel}>Article Pipeline</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
            <div>
              <span style={{ fontSize: 10, color: AMBER, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                {data?.articlesInQueue ?? 0} in queue
              </span>
            </div>
            <div>
              <span style={{ fontSize: 10, color: GREEN, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                {data?.articlesPublished ?? 0} published
              </span>
            </div>
          </div>
        </div>

        {/* GEO Citations */}
        <div style={cardStyle}>
          <div style={kpiLabel}>GEO Citations</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
            <div>
              <span style={{ fontSize: 10, color: GREEN, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                +{data?.geoCitationsGained ?? 0} gained
              </span>
            </div>
            <div>
              <span style={{ fontSize: 10, color: RED, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                -{data?.geoCitationsLost ?? 0} lost
              </span>
            </div>
          </div>
        </div>

        {/* Vertical Keyword Health */}
        <div style={cardStyle}>
          <div style={kpiLabel}>Vertical Keyword Health</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {(data?.verticalKeywordHealth ?? []).slice(0, 4).map((v) => {
              const total = v.healthy + v.warning + v.critical
              if (total === 0) return null
              return (
                <div key={v.vertical} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 9,
                      color: TEXT_SECONDARY,
                      fontFamily: "'DM Sans', sans-serif",
                      width: 60,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {v.vertical}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.04)",
                      overflow: "hidden",
                      display: "flex",
                    }}
                  >
                    <div style={{ width: `${(v.healthy / total) * 100}%`, background: GREEN, height: "100%" }} />
                    <div style={{ width: `${(v.warning / total) * 100}%`, background: AMBER, height: "100%" }} />
                    <div style={{ width: `${(v.critical / total) * 100}%`, background: RED, height: "100%" }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Articles */}
      <div style={cardStyle}>
        <div style={sectionTitle}>Recent Articles</div>
        {(data?.recentArticles ?? []).length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px 0",
              color: TEXT_TERTIARY,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            No published articles yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {(data?.recentArticles ?? []).map((article) => (
              <div
                key={article.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "10px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = "transparent"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: TEXT_PRIMARY,
                      fontFamily: "'DM Sans', sans-serif",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {article.title}
                  </div>
                </div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontSize: 9,
                    fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    background: `${getVerticalColor(article.vertical)}18`,
                    color: getVerticalColor(article.vertical),
                  }}
                >
                  {article.vertical}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: TEXT_TERTIARY,
                    fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date(article.publishedAt).toLocaleDateString()}
                </span>
                <div style={{ display: "flex", gap: 12, fontSize: 10, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                  <span>{article.sessions7d != null ? `${fmtNum(article.sessions7d)} sess` : "--"}</span>
                  <span>{article.bestPosition != null ? `#${article.bestPosition}` : "--"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
