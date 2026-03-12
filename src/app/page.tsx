"use client"

import { useEffect, useState } from "react"
import Counter from "@/components/dashboard/Counter"
import Sparkline from "@/components/dashboard/Sparkline"
import RevenueChart from "@/components/dashboard/RevenueChart"
import DonutChart from "@/components/dashboard/DonutChart"

/* ── Design tokens ── */
const VOID = "#060709"
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"
const INDIGO = "#818CF8"
const RED = "#F87171"
const FROST = "#FFFFFF"

/* ── KPI definitions ── */
const KPI_CARDS = [
  {
    label: "Active Clients",
    target: 47,
    prefix: "",
    change: "\u2191 12% vs last month",
    up: true,
    data: [12, 18, 22, 19, 28, 34, 31, 38, 42, 47],
    color: GREEN,
  },
  {
    label: "Pipeline Value",
    target: 2400000,
    prefix: "\u20AC",
    change: "\u2191 8.3% growth",
    up: true,
    data: [800, 950, 1100, 1300, 1500, 1700, 1900, 2100, 2250, 2400],
    color: ROSE_GOLD,
  },
  {
    label: "Monthly Volume",
    target: 5600000,
    prefix: "\u20AC",
    change: "\u2191 23% vs prev.",
    up: true,
    data: [2100, 2400, 2800, 3200, 3100, 3800, 4200, 4600, 5100, 5600],
    color: INDIGO,
  },
  {
    label: "Open Tasks",
    target: 7,
    prefix: "",
    change: "4 to do \u00B7 3 in progress",
    up: false,
    data: [8, 7, 9, 6, 8, 7, 6, 7],
    color: AMBER,
  },
]

/* ── Static data ── */
const RECENT_ACTIVITY = [
  { label: "New KYB submitted", client: "Meridian Ventures Ltd", time: "2 min ago", status: "pending" },
  { label: "SEPA Inbound", client: "\u20AC45,000.00", time: "12 min ago", status: "completed" },
  { label: "EUR \u2192 BTC", client: "3.2 BTC @ \u20AC21,450", time: "34 min ago", status: "completed" },
  { label: "EDD Required", client: "Falcon Group SA", time: "1h ago", status: "action" },
  { label: "LP Settlement", client: "\u20AC128,500.00", time: "2h ago", status: "completed" },
]

const CALENDAR_EVENTS = [
  { time: "10:00", title: "Discovery Call \u2014 Vanguard Digital", type: "call" },
  { time: "11:30", title: "Compliance Review \u2014 Q1 SAR", type: "compliance" },
  { time: "14:00", title: "Arthur \u00D7 LP Negotiation", type: "meeting" },
  { time: "16:00", title: "Onboarding Follow-up \u2014 Monaco Client", type: "call" },
]

const REVENUE_DATA = [
  { label: "Sep", value: 42000 },
  { label: "Oct", value: 58000 },
  { label: "Nov", value: 51000 },
  { label: "Dec", value: 67000 },
  { label: "Jan", value: 73000 },
  { label: "Feb", value: 89000 },
  { label: "Mar", value: 95000 },
]

const DONUT_SEGMENTS = [
  { label: "iGaming", value: 18, color: ROSE_GOLD },
  { label: "Crypto", value: 12, color: GREEN },
  { label: "Family Office", value: 9, color: INDIGO },
  { label: "Luxury", value: 8, color: AMBER },
]

const QUICK_ACTIONS = [
  { icon: "\u2B21", label: "Onboard Client" },
  { icon: "\u2197", label: "Send Payment" },
  { icon: "\u21CC", label: "Exchange" },
  { icon: "\u25C8", label: "Generate Report" },
]

const STATUS_COLORS: Record<string, string> = {
  pending: AMBER,
  completed: GREEN,
  action: RED,
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  call: GREEN,
  compliance: AMBER,
  meeting: INDIGO,
}

const LEAVE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  vacation: { bg: "rgba(52,211,153,0.12)", text: GREEN },
  sick: { bg: "rgba(248,113,113,0.12)", text: RED },
  ooo: { bg: "rgba(129,140,248,0.12)", text: INDIGO },
}

export default function DashboardPage() {
  const [clock, setClock] = useState("")
  const [whoIsOut, setWhoIsOut] = useState<Array<{ id: string; employee: { name: string; initials: string; avatarColor: string }; type: string }>>([])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch("/api/leaves/who-is-out")
      .then((r) => r.json())
      .then((data) => setWhoIsOut(data.today ?? []))
      .catch(() => {})
  }, [])

  return (
    <div className="page-content" style={{ padding: 0 }}>
      {/* ── Header ── */}
      <div
        className="sticky-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          background: "rgba(6,7,9,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${CARD_BORDER}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 28,
              fontWeight: 400,
              color: FROST,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              fontSize: 12,
              color: TEXT_TERTIARY,
              marginTop: 4,
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.4,
            }}
          >
            Overview of Oxen Finance operations
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontSize: 13,
              color: TEXT_SECONDARY,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: 1,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {clock}
          </span>
          <button className="header-btn">New Client</button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding: "28px 32px" }}>
        {/* ── KPI Cards ── */}
        <div
          className="fade-in"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginBottom: 20,
            animationDelay: "0.05s",
          }}
        >
          {KPI_CARDS.map((kpi) => (
            <div
              key={kpi.label}
              className="kpi-card"
              style={{ position: "relative", overflow: "hidden" }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: TEXT_TERTIARY,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 8,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {kpi.label}
              </div>
              <div
                style={{
                  fontFamily: "'Bellfair', serif",
                  fontSize: 32,
                  fontWeight: 400,
                  color: FROST,
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                <Counter target={kpi.target} prefix={kpi.prefix} />
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: kpi.up ? GREEN : TEXT_TERTIARY,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {kpi.change}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  right: 16,
                  opacity: 0.6,
                }}
              >
                <Sparkline data={kpi.data} color={kpi.color} width={100} height={32} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Quick Actions ── */}
        <div
          className="card fade-in"
          style={{ marginBottom: 20, animationDelay: "0.1s" }}
        >
          <div style={{ padding: 20 }}>
            <div
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 16,
                color: TEXT_PRIMARY,
                marginBottom: 16,
              }}
            >
              Quick Actions
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
              }}
            >
              {QUICK_ACTIONS.map((action) => (
                <button key={action.label} className="quick-btn">
                  <span style={{ fontSize: 18, opacity: 0.6 }}>{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Who's Out Today ── */}
        <div
          className="card fade-in"
          style={{ marginBottom: 20, animationDelay: "0.12s", overflow: "hidden" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              background: "rgba(255,255,255,0.01)",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {"\uD83C\uDFD6\uFE0F"} Who&apos;s Out Today
            </span>
            <a
              href="/absences"
              style={{
                fontSize: 11,
                color: ROSE_GOLD,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              View All &rarr;
            </a>
          </div>
          <div style={{ padding: "12px 20px" }}>
            {whoIsOut.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
                <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                  Everyone&apos;s in today
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {whoIsOut.map((w) => {
                  const lc = LEAVE_TYPE_COLORS[w.type] || LEAVE_TYPE_COLORS.vacation
                  return (
                    <div
                      key={w.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "rgba(255,255,255,0.02)",
                        border: `1px solid ${CARD_BORDER}`,
                        borderRadius: 8,
                        padding: "6px 12px",
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: w.employee.avatarColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 8,
                          fontWeight: 600,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {w.employee.initials}
                      </div>
                      <span style={{ fontSize: 11, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {w.employee.name}
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          padding: "1px 6px",
                          borderRadius: 6,
                          background: lc.bg,
                          color: lc.text,
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {w.type}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Activity + Today's Schedule ── */}
        <div
          className="fade-in"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 20,
            animationDelay: "0.15s",
          }}
        >
          {/* Recent Activity */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: "rgba(255,255,255,0.01)",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Recent Activity
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: ROSE_GOLD,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                }}
              >
                View All &rarr;
              </span>
            </div>
            <div style={{ padding: "8px 20px 12px" }}>
              {RECENT_ACTIVITY.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom:
                      i < RECENT_ACTIVITY.length - 1
                        ? "1px solid rgba(255,255,255,0.03)"
                        : "none",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: STATUS_COLORS[item.status] || TEXT_TERTIARY,
                      boxShadow: `0 0 6px ${STATUS_COLORS[item.status] || TEXT_TERTIARY}`,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: TEXT_PRIMARY,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: TEXT_TERTIARY,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {item.client}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: TEXT_TERTIARY,
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: "'DM Sans', sans-serif",
                      flexShrink: 0,
                    }}
                  >
                    {item.time}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: "rgba(255,255,255,0.01)",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Today&apos;s Schedule
              </span>
            </div>
            <div style={{ padding: "8px 20px 12px" }}>
              {CALENDAR_EVENTS.map((evt, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom:
                      i < CALENDAR_EVENTS.length - 1
                        ? "1px solid rgba(255,255,255,0.03)"
                        : "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: TEXT_TERTIARY,
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: "'DM Sans', sans-serif",
                      width: 44,
                      flexShrink: 0,
                    }}
                  >
                    {evt.time}
                  </span>
                  <div
                    style={{
                      width: 2,
                      height: 24,
                      borderRadius: 1,
                      background: EVENT_TYPE_COLORS[evt.type] || TEXT_TERTIARY,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: TEXT_PRIMARY,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {evt.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Revenue + Client Segments ── */}
        <div
          className="fade-in"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
            animationDelay: "0.2s",
          }}
        >
          {/* Monthly Revenue */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: "rgba(255,255,255,0.01)",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Monthly Revenue
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: ROSE_GOLD,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                }}
              >
                Export &rarr;
              </span>
            </div>
            <div style={{ padding: "20px 20px 16px" }}>
              <RevenueChart data={REVENUE_DATA} />
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  marginTop: 14,
                  paddingTop: 10,
                  borderTop: "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.12)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      color: TEXT_TERTIARY,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Previous
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: ROSE_GOLD,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      color: TEXT_TERTIARY,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Current
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Client Segments */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: "rgba(255,255,255,0.01)",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Client Segments
              </span>
            </div>
            <div
              style={{
                padding: "20px",
                display: "flex",
                alignItems: "center",
                gap: 24,
              }}
            >
              <DonutChart
                segments={DONUT_SEGMENTS.map((s) => ({
                  value: s.value,
                  color: s.color,
                }))}
                size={110}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {DONUT_SEGMENTS.map((seg) => (
                  <div
                    key={seg.label}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: seg.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: TEXT_SECONDARY,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {seg.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: TEXT_TERTIARY,
                        fontFamily: "'DM Sans', sans-serif",
                        marginLeft: "auto",
                      }}
                    >
                      {seg.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
