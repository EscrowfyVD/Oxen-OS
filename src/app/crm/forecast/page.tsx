"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  PIPELINE_STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  DEAL_OWNERS,
  fmtCurrency,
  fmtCurrencyFull,
  CRM_COLORS,
} from "@/lib/crm-config"

/* ── Design tokens ── */
const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT = "#F0F0F2"
const TEXT_SEC = "rgba(240,240,242,0.55)"
const TEXT_TER = "rgba(240,240,242,0.3)"
const ROSE = "#C08B88"
const BG = "#050507"

const glassCard: React.CSSProperties = {
  background: CARD_BG,
  backdropFilter: CRM_COLORS.glass_blur,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  padding: 22,
  boxShadow: CRM_COLORS.glass_shadow,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: TEXT_TER,
  textTransform: "uppercase",
  letterSpacing: 1,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
}

/* ── Types ── */
interface ForecastDeal {
  id: string
  contactId: string | null
  dealName: string
  contactName: string
  companyName: string | null
  dealValue: number | null
  weightedValue: number | null
  winProbability: number | null
  stage: string
  aiDealHealth: string | null
}

interface StageGroup {
  stageId: string
  label: string
  color: string
  deals: ForecastDeal[]
  totalValue: number
  weightedValue: number
}

interface ForecastMonth {
  label: string
  startDate: string
  endDate: string
  byStage: StageGroup[]
  totalValue: number
  totalWeightedValue: number
  dealCount: number
}

interface ForecastData {
  months: ForecastMonth[]
  scenarios: {
    bestCase: number
    expected: number
    worstCase: number
  }
}

/* ── Health badge ── */
function HealthBadge({ health }: { health: string | null }) {
  if (!health) return <span style={{ color: TEXT_TER, fontSize: 11 }}>--</span>
  const map: Record<string, string> = {
    on_track: "\u{1F7E2}",
    needs_attention: "\u{1F7E1}",
    at_risk: "\u{1F534}",
  }
  return <span style={{ fontSize: 12 }}>{map[health] ?? "--"}</span>
}

/* ── Tooltip ── */
const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: "rgba(15,17,24,0.95)",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        padding: "10px 14px",
      }}
    >
      <p
        style={{
          fontSize: 11,
          color: TEXT_SEC,
          margin: 0,
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      {payload.map((entry, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: entry.color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: TEXT_SEC,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {entry.name}:
          </span>
          <span
            style={{
              fontSize: 12,
              color: TEXT,
              fontFamily: "'Bellfair', serif",
            }}
          >
            {fmtCurrencyFull(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ForecastPage() {
  const router = useRouter()
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [owner, setOwner] = useState("All")

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (owner !== "All") params.set("owner", owner)
    params.set("months", "4")

    fetch(`/api/crm/forecast?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [owner])

  if (loading || !data) {
    return (
      <div
        style={{
          padding: "80px 40px",
          color: TEXT_TER,
          textAlign: "center",
          background: BG,
          minHeight: "100vh",
        }}
      >
        Loading forecast...
      </div>
    )
  }

  const { months, scenarios } = data

  // Collect all stage IDs that have deals across any month
  const activeStageIds = new Set<string>()
  months.forEach((m) => m.byStage.forEach((s) => activeStageIds.add(s.stageId)))

  // Filter PIPELINE_STAGES to only those with deals
  const visibleStages = PIPELINE_STAGES.filter(
    (s) => activeStageIds.has(s.id) && s.id !== "closed_lost"
  )

  // Chart data: stacked bar, one bar per month, segments by stage
  const chartData = months.map((m) => {
    const entry: Record<string, string | number> = { name: m.label }
    visibleStages.forEach((stage) => {
      const sg = m.byStage.find((s) => s.stageId === stage.id)
      entry[stage.id] = sg ? sg.weightedValue : 0
    })
    return entry
  })

  const selectStyle: React.CSSProperties = {
    padding: "7px 12px",
    fontSize: 11,
    fontFamily: "'DM Sans', sans-serif",
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 8,
    color: TEXT,
    outline: "none",
    cursor: "pointer",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 28,
  }

  return (
    <div style={{ padding: "32px 40px", minHeight: "100vh", background: BG }}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              color: TEXT,
              margin: 0,
              marginBottom: 6,
            }}
          >
            Revenue Forecast
          </h1>
          <p
            style={{
              fontSize: 13,
              color: TEXT_SEC,
              margin: 0,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Projected revenue by pipeline stage over the next 4 months
          </p>
        </div>

        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          style={selectStyle}
        >
          <option value="All">All Owners</option>
          {DEAL_OWNERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {/* ── Scenario Cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 28,
        }}
      >
        {/* Best Case */}
        <div
          style={{
            ...glassCard,
            borderTop: "2px solid rgba(52,211,153,0.5)",
            background: "linear-gradient(180deg, rgba(52,211,153,0.06) 0%, rgba(15,17,24,0.6) 40%)",
          }}
        >
          <span style={labelStyle}>Best Case</span>
          <p
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              color: CRM_COLORS.green,
              margin: "10px 0 4px",
              lineHeight: 1,
            }}
          >
            {fmtCurrency(scenarios.bestCase)}
          </p>
          <span
            style={{
              fontSize: 11,
              color: TEXT_SEC,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Total of all deal values (100%)
          </span>
        </div>

        {/* Expected */}
        <div
          style={{
            ...glassCard,
            borderTop: `2px solid rgba(192,139,136,0.5)`,
            background: `linear-gradient(180deg, rgba(192,139,136,0.06) 0%, rgba(15,17,24,0.6) 40%)`,
          }}
        >
          <span style={labelStyle}>Expected</span>
          <p
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              color: ROSE,
              margin: "10px 0 4px",
              lineHeight: 1,
            }}
          >
            {fmtCurrency(scenarios.expected)}
          </p>
          <span
            style={{
              fontSize: 11,
              color: TEXT_SEC,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Probability-weighted total
          </span>
        </div>

        {/* Worst Case */}
        <div
          style={{
            ...glassCard,
            borderTop: "2px solid rgba(156,163,175,0.4)",
            background: "linear-gradient(180deg, rgba(156,163,175,0.04) 0%, rgba(15,17,24,0.6) 40%)",
          }}
        >
          <span style={labelStyle}>Worst Case</span>
          <p
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              color: "#9CA3AF",
              margin: "10px 0 4px",
              lineHeight: 1,
            }}
          >
            {fmtCurrency(scenarios.worstCase)}
          </p>
          <span
            style={{
              fontSize: 11,
              color: TEXT_SEC,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Closed Won + Negotiation only
          </span>
        </div>
      </div>

      {/* ── Forecast Table ── */}
      <div style={{ ...glassCard, marginBottom: 28, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 0" }}>
          <h3
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: TEXT,
              margin: 0,
              marginBottom: 16,
            }}
          >
            Forecast by Stage
          </h3>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 22px",
                    color: TEXT_TER,
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    borderBottom: `1px solid ${CARD_BORDER}`,
                    width: "30%",
                  }}
                >
                  Stage / Deal
                </th>
                {months.map((m) => (
                  <th
                    key={m.label}
                    style={{
                      textAlign: "right",
                      padding: "10px 18px",
                      color: TEXT_TER,
                      fontSize: 10,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      borderBottom: `1px solid ${CARD_BORDER}`,
                    }}
                  >
                    {m.label}
                  </th>
                ))}
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 22px",
                    color: TEXT_TER,
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    borderBottom: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleStages.map((stage) => {
                // Collect stage data across months
                const stageMonthData = months.map((m) => {
                  const sg = m.byStage.find((s) => s.stageId === stage.id)
                  return sg ?? null
                })

                const stageTotal = stageMonthData.reduce(
                  (s, sg) => s + (sg?.weightedValue ?? 0),
                  0
                )

                // All deals for this stage across months (for expansion)
                const allStageDeals: Array<{
                  deal: ForecastDeal
                  monthLabel: string
                }> = []
                months.forEach((m) => {
                  const sg = m.byStage.find((s) => s.stageId === stage.id)
                  if (sg) {
                    sg.deals.forEach((d) =>
                      allStageDeals.push({ deal: d, monthLabel: m.label })
                    )
                  }
                })

                return (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    stageMonthData={stageMonthData}
                    stageTotal={stageTotal}
                    months={months}
                    allStageDeals={allStageDeals}
                    onDealClick={(contactId) => {
                      if (contactId) router.push(`/crm/contacts/${contactId}`)
                    }}
                  />
                )
              })}

              {/* Footer totals */}
              <tr>
                <td
                  style={{
                    padding: "12px 22px",
                    fontWeight: 600,
                    color: TEXT,
                    borderTop: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  Total Weighted
                </td>
                {months.map((m) => (
                  <td
                    key={m.label}
                    style={{
                      textAlign: "right",
                      padding: "12px 18px",
                      fontFamily: "'Bellfair', serif",
                      fontSize: 14,
                      fontWeight: 600,
                      color: ROSE,
                      borderTop: `1px solid ${CARD_BORDER}`,
                    }}
                  >
                    {fmtCurrency(m.totalWeightedValue)}
                  </td>
                ))}
                <td
                  style={{
                    textAlign: "right",
                    padding: "12px 22px",
                    fontFamily: "'Bellfair', serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: ROSE,
                    borderTop: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  {fmtCurrency(
                    months.reduce((s, m) => s + m.totalWeightedValue, 0)
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Forecast Chart ── */}
      <div style={glassCard}>
        <h3
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            margin: 0,
            marginBottom: 20,
          }}
        >
          Weighted Revenue by Month
        </h3>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} barSize={48}>
            <XAxis
              dataKey="name"
              tick={{
                fill: TEXT_TER,
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
              }}
              axisLine={{ stroke: CARD_BORDER }}
              tickLine={false}
            />
            <YAxis
              tick={{
                fill: TEXT_TER,
                fontSize: 10,
                fontFamily: "'DM Sans', sans-serif",
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtCurrency(v)}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                color: TEXT_SEC,
              }}
            />
            {visibleStages.map((stage) => (
              <Bar
                key={stage.id}
                dataKey={stage.id}
                name={stage.label}
                stackId="forecast"
                fill={stage.color}
                fillOpacity={0.8}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ── Stage Row with expandable deals ── */
function StageRow({
  stage,
  stageMonthData,
  stageTotal,
  months,
  allStageDeals,
  onDealClick,
}: {
  stage: (typeof PIPELINE_STAGES)[number]
  stageMonthData: (StageGroup | null)[]
  stageTotal: number
  months: ForecastMonth[]
  allStageDeals: Array<{ deal: ForecastDeal; monthLabel: string }>
  onDealClick: (contactId: string | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const colCount = months.length + 2

  return (
    <>
      {/* Stage header row */}
      <tr
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <td
          style={{
            padding: "10px 22px",
            color: TEXT,
            fontWeight: 500,
            borderBottom: `1px solid ${CARD_BORDER}`,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: stage.color,
                flexShrink: 0,
              }}
            />
            <span>{stage.label}</span>
            <span
              style={{
                fontSize: 10,
                color: TEXT_TER,
                marginLeft: 4,
              }}
            >
              {expanded ? "\u25B4" : "\u25BE"}
            </span>
          </span>
        </td>
        {stageMonthData.map((sg, i) => (
          <td
            key={i}
            style={{
              textAlign: "right",
              padding: "10px 18px",
              color: sg && sg.weightedValue > 0 ? TEXT : TEXT_TER,
              fontFamily: "'Bellfair', serif",
              fontSize: 13,
              borderBottom: `1px solid ${CARD_BORDER}`,
            }}
          >
            {sg ? fmtCurrency(sg.weightedValue) : "--"}
          </td>
        ))}
        <td
          style={{
            textAlign: "right",
            padding: "10px 22px",
            color: TEXT,
            fontFamily: "'Bellfair', serif",
            fontSize: 13,
            fontWeight: 600,
            borderBottom: `1px solid ${CARD_BORDER}`,
          }}
        >
          {fmtCurrency(stageTotal)}
        </td>
      </tr>

      {/* Expanded deal rows */}
      {expanded &&
        allStageDeals.map(({ deal, monthLabel }, idx) => (
          <tr
            key={`${deal.id}-${idx}`}
            onClick={(e) => {
              e.stopPropagation()
              onDealClick(deal.contactId)
            }}
            style={{ cursor: "pointer" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <td
              style={{
                padding: "7px 22px 7px 48px",
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ color: TEXT, fontSize: 11, fontWeight: 500 }}>
                  {deal.dealName}
                </span>
                <span style={{ color: TEXT_SEC, fontSize: 10 }}>
                  {deal.contactName}
                  {deal.companyName ? ` - ${deal.companyName}` : ""}
                </span>
              </div>
            </td>
            {months.map((m) => (
              <td
                key={m.label}
                style={{
                  textAlign: "right",
                  padding: "7px 18px",
                  fontSize: 11,
                  color: TEXT_TER,
                  borderBottom: `1px solid rgba(255,255,255,0.03)`,
                }}
              >
                {m.label === monthLabel ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    <HealthBadge health={deal.aiDealHealth} />
                    <span style={{ color: TEXT_SEC, fontSize: 10 }}>
                      {deal.winProbability != null
                        ? `${Math.round(deal.winProbability * 100)}%`
                        : "--"}
                    </span>
                    <span
                      style={{
                        color: TEXT,
                        fontFamily: "'Bellfair', serif",
                        fontSize: 12,
                      }}
                    >
                      {deal.dealValue != null
                        ? fmtCurrency(deal.dealValue)
                        : "--"}
                    </span>
                  </span>
                ) : (
                  ""
                )}
              </td>
            ))}
            <td
              style={{
                textAlign: "right",
                padding: "7px 22px",
                fontSize: 11,
                color: TEXT_SEC,
                fontFamily: "'Bellfair', serif",
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
              }}
            >
              {deal.weightedValue != null
                ? fmtCurrency(deal.weightedValue)
                : "--"}
            </td>
          </tr>
        ))}
    </>
  )
}
