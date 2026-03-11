"use client"

import Counter from "@/components/dashboard/Counter"
import Sparkline from "@/components/dashboard/Sparkline"
import DonutChart from "@/components/dashboard/DonutChart"
import RevenueChart from "@/components/dashboard/RevenueChart"
import {
  CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, AMBER, INDIGO, RED, ROSE_GOLD, PURPLE,
  STATUS_COLORS, SECTOR_COLORS,
} from "./constants"
import type { CrmStats } from "./types"

interface ReportsTabProps {
  stats: CrmStats | null
}

export default function ReportsTab({ stats }: ReportsTabProps) {
  if (!stats) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 0",
          color: TEXT_TERTIARY,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
        }}
      >
        Loading reports...
      </div>
    )
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)

  /* Build sparkline-like data arrays for KPI cards */
  const monthCounts = stats.monthlyNew.map((m) => m.count)
  const sparkData = monthCounts.length >= 2 ? monthCounts : [0, 1, 2, 3, 2, 4]

  /* Donut chart segments for sectors */
  const sectorColorMap: Record<string, string> = {
    iGaming: ROSE_GOLD,
    Crypto: GREEN,
    "Family Office": INDIGO,
    Luxury: AMBER,
    Fintech: PURPLE,
    Other: TEXT_SECONDARY,
  }
  const donutSegments = stats.bySector.map((s) => ({
    value: s.count,
    color: sectorColorMap[s.sector] || TEXT_SECONDARY,
  }))

  /* Revenue chart data for monthly new clients */
  const monthlyData = stats.monthlyNew.map((m) => ({
    label: m.month.substring(5), // "MM" from "YYYY-MM"
    value: m.count,
  }))

  /* Status order for pipeline bars */
  const statusOrder = ["lead", "qualified", "proposal", "negotiation", "won", "lost"]
  const maxStatusCount = Math.max(...stats.byStatus.map((s) => s.count), 1)

  return (
    <div>
      {/* ── KPI Cards ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
          animationDelay: "0.05s",
        }}
      >
        {/* Total Contacts */}
        <div className="kpi-card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
          <div
            style={{
              fontSize: 10,
              color: TEXT_TERTIARY,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Total Contacts
          </div>
          <div
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              fontWeight: 400,
              color: FROST,
              lineHeight: 1,
            }}
          >
            <Counter target={stats.totalContacts} />
          </div>
          <div style={{ position: "absolute", bottom: 8, right: 12, opacity: 0.5 }}>
            <Sparkline data={sparkData} color={ROSE_GOLD} width={80} height={28} />
          </div>
        </div>

        {/* Pipeline Value */}
        <div className="kpi-card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
          <div
            style={{
              fontSize: 10,
              color: TEXT_TERTIARY,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Pipeline Value
          </div>
          <div
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              fontWeight: 400,
              color: FROST,
              lineHeight: 1,
            }}
          >
            <Counter target={stats.pipelineValue} prefix="€" />
          </div>
          <div style={{ position: "absolute", bottom: 8, right: 12, opacity: 0.5 }}>
            <Sparkline data={sparkData} color={GREEN} width={80} height={28} />
          </div>
        </div>

        {/* Won Deals */}
        <div className="kpi-card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
          <div
            style={{
              fontSize: 10,
              color: TEXT_TERTIARY,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Won Deals
          </div>
          <div
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              fontWeight: 400,
              color: FROST,
              lineHeight: 1,
              marginBottom: 4,
            }}
          >
            <Counter target={stats.wonDeals} />
          </div>
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
            {formatCurrency(stats.wonValue)}
          </div>
          <div style={{ position: "absolute", bottom: 8, right: 12, opacity: 0.5 }}>
            <Sparkline data={sparkData} color={AMBER} width={80} height={28} />
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="kpi-card" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
          <div
            style={{
              fontSize: 10,
              color: TEXT_TERTIARY,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Conversion Rate
          </div>
          <div
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              fontWeight: 400,
              color: FROST,
              lineHeight: 1,
            }}
          >
            <Counter target={stats.conversionRate} />
            <span style={{ fontSize: 18, color: TEXT_SECONDARY }}>%</span>
          </div>
          <div style={{ position: "absolute", bottom: 8, right: 12, opacity: 0.5 }}>
            <Sparkline data={sparkData} color={INDIGO} width={80} height={28} />
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 24,
          animationDelay: "0.1s",
        }}
      >
        {/* Pipeline by Status */}
        <div className="card" style={{ padding: "20px" }}>
          <div
            style={{
              fontSize: 13,
              fontFamily: "'Bellfair', serif",
              color: FROST,
              marginBottom: 16,
            }}
          >
            Pipeline by Status
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {statusOrder.map((status) => {
              const item = stats.byStatus.find((s) => s.status === status)
              const count = item?.count ?? 0
              const value = item?.value ?? 0
              const color = STATUS_COLORS[status]?.text || TEXT_TERTIARY
              const barWidth = maxStatusCount > 0 ? (count / maxStatusCount) * 100 : 0

              return (
                <div key={status}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: TEXT_SECONDARY,
                        fontFamily: "'DM Sans', sans-serif",
                        textTransform: "capitalize",
                      }}
                    >
                      {status}
                    </span>
                    <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {count} · {formatCurrency(value)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.04)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barWidth}%`,
                        borderRadius: 3,
                        background: color,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Clients by Sector */}
        <div className="card" style={{ padding: "20px" }}>
          <div
            style={{
              fontSize: 13,
              fontFamily: "'Bellfair', serif",
              color: FROST,
              marginBottom: 16,
            }}
          >
            Clients by Sector
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <DonutChart
              segments={donutSegments.length > 0 ? donutSegments : [{ value: 1, color: "rgba(255,255,255,0.06)" }]}
              size={120}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {stats.bySector.map((s) => {
                const color = sectorColorMap[s.sector] || TEXT_SECONDARY
                return (
                  <div key={s.sector} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: TEXT_SECONDARY,
                        fontFamily: "'DM Sans', sans-serif",
                        flex: 1,
                      }}
                    >
                      {s.sector}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: TEXT_TERTIARY,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {s.count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row: Monthly + Top Deals ── */}
      <div
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          animationDelay: "0.15s",
        }}
      >
        {/* Monthly New Clients */}
        <div className="card" style={{ padding: "20px" }}>
          <div
            style={{
              fontSize: 13,
              fontFamily: "'Bellfair', serif",
              color: FROST,
              marginBottom: 16,
            }}
          >
            Monthly New Clients
          </div>
          {monthlyData.length > 0 ? (
            <RevenueChart data={monthlyData} />
          ) : (
            <div style={{ color: TEXT_TERTIARY, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              No data yet
            </div>
          )}
        </div>

        {/* Top Deals */}
        <div className="card" style={{ padding: "20px" }}>
          <div
            style={{
              fontSize: 13,
              fontFamily: "'Bellfair', serif",
              color: FROST,
              marginBottom: 16,
            }}
          >
            Top Deals
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.topDeals.length > 0 ? (
              stats.topDeals.slice(0, 8).map((deal, i) => {
                const statusColor = STATUS_COLORS[deal.status] || STATUS_COLORS.lead
                return (
                  <div
                    key={deal.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 0",
                      borderBottom: i < stats.topDeals.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: TEXT_TERTIARY,
                        fontFamily: "'DM Sans', sans-serif",
                        fontVariantNumeric: "tabular-nums",
                        width: 16,
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: TEXT_PRIMARY,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {deal.company || deal.name}
                      </div>
                      {deal.company && (
                        <div style={{ fontSize: 10, color: TEXT_TERTIARY }}>{deal.name}</div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        fontWeight: 500,
                        padding: "2px 6px",
                        borderRadius: 8,
                        background: statusColor.bg,
                        color: statusColor.text,
                      }}
                    >
                      {deal.status}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Bellfair', serif",
                        fontSize: 13,
                        color: FROST,
                        minWidth: 70,
                        textAlign: "right",
                      }}
                    >
                      {formatCurrency(deal.value ?? 0)}
                    </span>
                  </div>
                )
              })
            ) : (
              <div style={{ color: TEXT_TERTIARY, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                No deals yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
