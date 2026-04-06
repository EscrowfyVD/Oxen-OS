"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Counter from "@/components/dashboard/Counter"
import { getAvatarGradient } from "@/lib/avatar"

/* ── Design tokens ── */
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"
const INDIGO = "#818CF8"
const FROST = "#FFFFFF"

/* ── Types ── */
interface ActivityItem {
  id: string
  action: string
  detail: string
  icon: string
  color: string
  link: string | null
  createdAt: string
}

interface ScheduleAttendee {
  email: string
  name: string
  initials: string
  avatarColor: string | null
  icon: string | null
}

interface ScheduleEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  location: string | null
  meetLink: string | null
  attendees: ScheduleAttendee[]
}

interface QuickAction {
  icon: string
  label: string
  href: string
  modal?: string
}

interface DashboardData {
  stats: {
    activeClients: number
    pipelineValue: number
    monthlyVolume: number
    userOpenTasks: number
  }
  activityFeed: ActivityItem[]
  schedule: ScheduleEvent[]
  scheduleLabel: string
  quickActions: QuickAction[]
}

/* ── Helpers ── */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
}

const KPI_COLORS = [GREEN, ROSE_GOLD, INDIGO, AMBER]

export default function DashboardPage() {
  const router = useRouter()
  const [clock, setClock] = useState("")
  const [data, setData] = useState<DashboardData | null>(null)

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
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
  }, [])

  const stats = data?.stats
  const kpiCards = [
    { label: "Active Clients", value: Number(stats?.activeClients) || 0, prefix: "", color: KPI_COLORS[0] },
    { label: "Pipeline Value", value: Number(stats?.pipelineValue) || 0, prefix: "\u20AC", color: KPI_COLORS[1] },
    { label: "Monthly Volume", value: Number(stats?.monthlyVolume) || 0, prefix: "\u20AC", color: KPI_COLORS[2] },
    { label: "Your Open Tasks", value: Number(stats?.userOpenTasks) || 0, prefix: "", color: KPI_COLORS[3] },
  ]

  const handleQuickAction = (action: QuickAction) => {
    if (action.href !== "#") {
      router.push(action.href)
    }
    // Modal actions (contact, task, agent) would be handled by parent or dedicated pages
    // For now, navigate to the relevant module page
    if (action.modal === "contact") router.push("/crm")
    if (action.modal === "task") router.push("/tasks")
    if (action.modal === "agent") router.push("/crm")
  }

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
              fontSize: 32,
              fontWeight: 400,
              color: FROST,
              lineHeight: 1.2,
              margin: 0,
              letterSpacing: "0.5px",
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
          {kpiCards.map((kpi) => (
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
                <Counter target={kpi.value} prefix={kpi.prefix} />
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: kpi.color,
                  opacity: 0.6,
                }}
              />
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
              {(data?.quickActions ?? []).map((action) => (
                <button
                  key={action.label}
                  className="quick-btn"
                  onClick={() => handleQuickAction(action)}
                >
                  <span style={{ fontSize: 18, opacity: 0.6 }}>{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Activity + Today's Schedule ── */}
        <div
          className="fade-in"
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 2fr",
            gap: 16,
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
            </div>
            <div style={{ padding: "4px 20px 12px" }}>
              {(!data || data.activityFeed.length === 0) ? (
                <div style={{ padding: "20px 0", textAlign: "center" }}>
                  <span style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                    No recent activity yet
                  </span>
                </div>
              ) : (
                data.activityFeed.map((item, i) => (
                  <div
                    key={item.id}
                    onClick={() => item.link && router.push(item.link)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom:
                        i < data.activityFeed.length - 1
                          ? "1px solid rgba(255,255,255,0.03)"
                          : "none",
                      cursor: item.link ? "pointer" : "default",
                      transition: "background 0.15s",
                      borderRadius: 6,
                      marginLeft: -4,
                      marginRight: -4,
                      paddingLeft: 4,
                      paddingRight: 4,
                    }}
                    onMouseEnter={(e) => {
                      if (item.link) e.currentTarget.style.background = "rgba(255,255,255,0.02)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 14 }}>{item.icon}</span>
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: item.color,
                          boxShadow: `0 0 6px ${item.color}`,
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="truncate"
                        style={{
                          fontSize: 12,
                          color: TEXT_PRIMARY,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {item.detail}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: TEXT_TERTIARY,
                        fontVariantNumeric: "tabular-nums",
                        fontFamily: "'DM Sans', sans-serif",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {relativeTime(item.createdAt)}
                    </div>
                  </div>
                ))
              )}
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
                {data?.scheduleLabel ?? "Today\u2019s Schedule"}
              </span>
            </div>
            <div style={{ padding: "4px 20px 12px" }}>
              {(!data || data.schedule.length === 0) ? (
                <div style={{ padding: "20px 0", textAlign: "center" }}>
                  <span style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                    No meetings scheduled today
                  </span>
                </div>
              ) : (
                data.schedule.map((evt, i) => (
                  <div
                    key={evt.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom:
                        i < data.schedule.length - 1
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
                        paddingTop: 2,
                      }}
                    >
                      {formatTime(evt.startTime)}
                    </span>
                    <div
                      style={{
                        width: 2,
                        height: 32,
                        borderRadius: 1,
                        background: ROSE_GOLD,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="truncate"
                        style={{
                          fontSize: 12,
                          color: TEXT_PRIMARY,
                          fontFamily: "'DM Sans', sans-serif",
                          marginBottom: 4,
                        }}
                      >
                        {evt.title}
                      </div>
                      {/* Attendee avatars */}
                      {evt.attendees.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {evt.attendees.slice(0, 5).map((att, j) => (
                            <div
                              key={j}
                              title={att.name}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: getAvatarGradient(att.avatarColor),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 7,
                                fontWeight: 600,
                                color: "#fff",
                                border: "1.5px solid var(--bg-card, #0F1118)",
                                marginLeft: j > 0 ? -6 : 0,
                                zIndex: 5 - j,
                                position: "relative",
                              }}
                            >
                              {att.icon || att.initials}
                            </div>
                          ))}
                          {evt.attendees.length > 5 && (
                            <span
                              style={{
                                fontSize: 9,
                                color: TEXT_TERTIARY,
                                marginLeft: 4,
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              +{evt.attendees.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {/* View Full Calendar link */}
              <div
                style={{
                  paddingTop: 10,
                  borderTop: "1px solid rgba(255,255,255,0.03)",
                  marginTop: 4,
                }}
              >
                <a
                  href="/calendar"
                  style={{
                    fontSize: 11,
                    color: ROSE_GOLD,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >
                  View Full Calendar &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
