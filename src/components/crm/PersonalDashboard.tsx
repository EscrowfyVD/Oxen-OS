"use client"

import { useState, useEffect, useCallback } from "react"
import {
  PIPELINE_STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  ACTIVITY_ICONS,
  OWNER_COLORS,
  CRM_COLORS,
  fmtCurrency,
  getAgingColor,
  getAgingLabel,
} from "@/lib/crm-config"

/* ── Design Tokens ── */
const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT = "#F0F0F2"
const TEXT_SEC = "rgba(240,240,242,0.55)"
const TEXT_TER = "rgba(240,240,242,0.3)"
const ROSE = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"
const RED = "#F87171"

const GLASS: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
}

/* ── Helpers ── */
function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

function getSuggestedAction(daysSinceLastActivity: number): string {
  if (daysSinceLastActivity >= 30) return "Consider closing or re-engaging"
  if (daysSinceLastActivity >= 14) return "Send follow-up email"
  return "Schedule a check-in"
}

/* ── Types ── */
interface DashboardTask {
  id: string
  title: string
  type: string
  dueDate: string
  contactName: string | null
  overdueDays?: number
}

interface DashboardActivity {
  id: string
  type: string
  description: string
  date: string
  contactName: string | null
}

interface StaleDeal {
  id: string
  dealName: string
  contactName: string | null
  daysSinceLastActivity: number
}

interface FunnelStage {
  stageId: string
  count: number
  value: number
}

interface PerformanceMetric {
  label: string
  thisMonth: number
  lastMonth: number
}

interface DashboardData {
  activeDeals: number
  pipelineValue: number
  meetingsThisWeek: number
  overdueTasks: number
  funnel: FunnelStage[]
  closedWon: { count: number; value: number }
  closedLost: { count: number; value: number }
  tasksOverdue: DashboardTask[]
  tasksDueToday: DashboardTask[]
  tasksThisWeek: DashboardTask[]
  recentActivity: DashboardActivity[]
  staleDeals: StaleDeal[]
  performance: PerformanceMetric[]
}

/* ── Props ── */
interface PersonalDashboardProps {
  ownerName: string | null
  isAdmin: boolean
  onStageClick: (stageId: string) => void
}

/* ── Task Type Icons ── */
const TASK_TYPE_ICONS: Record<string, string> = {
  follow_up_email: "📧",
  follow_up_call: "📞",
  schedule_meeting: "📅",
  send_proposal: "📋",
  pre_meeting_prep: "📝",
  post_meeting_summary: "📝",
  conference_followup: "🎪",
  send_documents: "📎",
  internal_discussion: "💬",
  crm_data_update: "🔄",
  other: "📌",
}

/* ── Skeleton Pulse Keyframes (injected once) ── */
let stylesInjected = false
function injectSkeletonStyles() {
  if (stylesInjected || typeof document === "undefined") return
  stylesInjected = true
  const style = document.createElement("style")
  style.textContent = `
    @keyframes oxen-skeleton-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }
  `
  document.head.appendChild(style)
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function PersonalDashboard({ ownerName, isAdmin, onStageClick }: PersonalDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"personal" | "team">(ownerName ? "personal" : "team")

  const effectiveOwner = viewMode === "team" ? null : ownerName

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = effectiveOwner ? `?owner=${encodeURIComponent(effectiveOwner)}` : ""
    fetch(`/api/crm/dashboard${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [effectiveOwner])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    injectSkeletonStyles()
  }, [])

  /* ── Today's date formatted ── */
  const todayStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  /* ── Loading Skeleton ── */
  if (loading) {
    return <SkeletonDashboard />
  }

  if (!data) {
    return (
      <div style={{ padding: "80px 32px", textAlign: "center" }}>
        <p style={{ color: TEXT_SEC, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
          Failed to load dashboard data.
        </p>
      </div>
    )
  }

  /* ── Funnel calculations ── */
  const funnelStages = data.funnel.filter(
    (f) => f.stageId !== "closed_won" && f.stageId !== "closed_lost"
  )
  const maxFunnelValue = Math.max(...funnelStages.map((f) => f.value), 1)

  const isTeam = effectiveOwner === null

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh" }}>
      {/* ═══════ 1. HEADER ═══════ */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 32,
            fontWeight: 400,
            color: "#FFFFFF",
            margin: 0,
            lineHeight: 1.2,
          }}>
            {isTeam ? "Team Dashboard" : `${getGreeting()}, ${ownerName}`}
          </h1>
          <p style={{
            fontSize: 12,
            color: TEXT_TER,
            marginTop: 4,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {todayStr}
          </p>
        </div>

        {isAdmin && (
          <div style={{
            display: "flex",
            gap: 2,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            padding: 3,
          }}>
            {(["personal", "team"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "6px 16px",
                  fontSize: 11,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: viewMode === mode ? ROSE : "transparent",
                  color: viewMode === mode ? "#060709" : TEXT_SEC,
                }}
              >
                {mode === "personal" ? "Personal" : "Team"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ 2. KPI CARDS ═══════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {/* Active Deals */}
        <div style={{ ...GLASS, padding: 20 }}>
          <span style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 28,
            color: TEXT,
            lineHeight: 1,
            display: "block",
          }}>
            {data.activeDeals}
          </span>
          <span style={{
            fontSize: 11,
            color: TEXT_SEC,
            fontFamily: "'DM Sans', sans-serif",
            marginTop: 6,
            display: "block",
          }}>
            Active Deals
          </span>
        </div>

        {/* Pipeline Value */}
        <div style={{ ...GLASS, padding: 20, borderTop: `2px solid ${ROSE}` }}>
          <span style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 28,
            color: TEXT,
            lineHeight: 1,
            display: "block",
          }}>
            {fmtCurrency(data.pipelineValue)}
          </span>
          <span style={{
            fontSize: 11,
            color: TEXT_SEC,
            fontFamily: "'DM Sans', sans-serif",
            marginTop: 6,
            display: "block",
          }}>
            Pipeline Value
          </span>
        </div>

        {/* Meetings This Week */}
        <div style={{ ...GLASS, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📅</span>
            <span style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 28,
              color: TEXT,
              lineHeight: 1,
            }}>
              {data.meetingsThisWeek}
            </span>
          </div>
          <span style={{
            fontSize: 11,
            color: TEXT_SEC,
            fontFamily: "'DM Sans', sans-serif",
            marginTop: 6,
            display: "block",
          }}>
            Meetings This Week
          </span>
        </div>

        {/* Overdue Tasks */}
        <div style={{ ...GLASS, padding: 20 }}>
          <span style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 28,
            color: data.overdueTasks > 0 ? RED : GREEN,
            lineHeight: 1,
            display: "block",
          }}>
            {data.overdueTasks}
          </span>
          <span style={{
            fontSize: 11,
            color: TEXT_SEC,
            fontFamily: "'DM Sans', sans-serif",
            marginTop: 6,
            display: "block",
          }}>
            Overdue Tasks
          </span>
        </div>
      </div>

      {/* ═══════ 3. DEALS FUNNEL ═══════ */}
      <div style={{ ...GLASS, padding: 22, marginBottom: 24 }}>
        <h3 style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          color: TEXT,
          margin: "0 0 18px",
        }}>
          {isTeam ? "Team Pipeline" : "My Pipeline"}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {funnelStages.map((stage) => {
            const pct = Math.max((stage.value / maxFunnelValue) * 100, 4)
            const stageColor = STAGE_COLORS[stage.stageId] ?? TEXT_TER
            return (
              <div
                key={stage.stageId}
                onClick={() => onStageClick(stage.stageId)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  padding: "6px 8px",
                  borderRadius: 8,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
              >
                {/* Left: label + count */}
                <div style={{ width: 160, flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 12,
                    color: TEXT,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                  }}>
                    {STAGE_LABELS[stage.stageId] ?? stage.stageId}
                  </span>
                  <span style={{
                    fontSize: 10,
                    color: stageColor,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 600,
                    background: `${stageColor}18`,
                    padding: "2px 7px",
                    borderRadius: 10,
                  }}>
                    {stage.count}
                  </span>
                </div>

                {/* Bar */}
                <div style={{ flex: 1, height: 20, background: "rgba(255,255,255,0.04)", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: stageColor,
                    borderRadius: 6,
                    opacity: 0.7,
                    transition: "width 0.4s ease",
                  }} />
                </div>

                {/* Right: value */}
                <span style={{
                  width: 80,
                  textAlign: "right",
                  fontFamily: "'Bellfair', serif",
                  fontSize: 14,
                  color: TEXT_SEC,
                  flexShrink: 0,
                }}>
                  {fmtCurrency(stage.value)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Bottom summary */}
        <div style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px solid ${CARD_BORDER}`,
          display: "flex",
          gap: 24,
          fontSize: 12,
          fontFamily: "'DM Sans', sans-serif",
          color: TEXT_SEC,
        }}>
          <span>
            <span style={{ color: GREEN }}>Closed Won:</span>{" "}
            {data.closedWon.count} ({fmtCurrency(data.closedWon.value)})
          </span>
          <span>
            <span style={{ color: RED }}>Closed Lost:</span>{" "}
            {data.closedLost.count}
          </span>
        </div>
      </div>

      {/* ═══════ 4. TWO-COLUMN: TASKS + ACTIVITY ═══════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* ── Left: Tasks Today ── */}
        <div style={{ ...GLASS, padding: 22 }}>
          <h3 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            margin: "0 0 16px",
          }}>
            Tasks Today
          </h3>

          {data.tasksOverdue.length === 0 && data.tasksDueToday.length === 0 && data.tasksThisWeek.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>✅</span>
              <p style={{
                fontSize: 13,
                color: GREEN,
                fontFamily: "'DM Sans', sans-serif",
                margin: 0,
              }}>
                All clear! No tasks due today.
              </p>
            </div>
          ) : (
            <>
              {/* Overdue */}
              {data.tasksOverdue.length > 0 && (
                <TaskSection
                  title="Overdue"
                  titleColor={RED}
                  tasks={data.tasksOverdue}
                  dotColor={RED}
                />
              )}

              {/* Due Today */}
              {data.tasksDueToday.length > 0 && (
                <TaskSection
                  title="Due Today"
                  titleColor={AMBER}
                  tasks={data.tasksDueToday}
                  dotColor={AMBER}
                />
              )}

              {/* This Week */}
              {data.tasksThisWeek.length > 0 && (
                <TaskSection
                  title="This Week"
                  titleColor={TEXT_SEC}
                  tasks={data.tasksThisWeek}
                  dotColor={TEXT_TER}
                />
              )}
            </>
          )}
        </div>

        {/* ── Right: Recent Activity ── */}
        <div style={{ ...GLASS, padding: 22 }}>
          <h3 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            margin: "0 0 16px",
          }}>
            Recent Activity
          </h3>

          {data.recentActivity.length === 0 ? (
            <p style={{ fontSize: 12, color: TEXT_TER, fontFamily: "'DM Sans', sans-serif" }}>
              No recent activity.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {data.recentActivity.slice(0, 10).map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 6px",
                    borderRadius: 8,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                >
                  <span style={{ fontSize: 14, lineHeight: "20px", flexShrink: 0 }}>
                    {ACTIVITY_ICONS[act.type] ?? "📌"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12,
                      color: TEXT,
                      fontFamily: "'DM Sans', sans-serif",
                      margin: 0,
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {act.description}
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      {act.contactName && (
                        <span style={{ fontSize: 10, color: ROSE, fontFamily: "'DM Sans', sans-serif" }}>
                          {act.contactName}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: TEXT_TER, fontFamily: "'DM Sans', sans-serif" }}>
                        {timeAgo(act.date)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════ 5. STALE DEALS ALERT ═══════ */}
      {data.staleDeals.length > 0 && (
        <div style={{
          ...GLASS,
          padding: 22,
          marginBottom: 24,
          borderLeft: `3px solid ${AMBER}`,
        }}>
          <h3 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            margin: "0 0 14px",
          }}>
            ⚠️ Deals Needing Attention
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.staleDeals.map((deal) => {
              const agingColor = getAgingColor(deal.daysSinceLastActivity)
              return (
                <div
                  key={deal.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 8px",
                    borderRadius: 8,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 12,
                      color: TEXT,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {deal.dealName}
                    </span>
                    {deal.contactName && (
                      <span style={{ fontSize: 10, color: TEXT_TER, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                        {deal.contactName}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10,
                      color: agingColor,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 600,
                    }}>
                      {deal.daysSinceLastActivity}d inactive
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: TEXT_SEC,
                      fontFamily: "'DM Sans', sans-serif",
                      fontStyle: "italic",
                    }}>
                      {getSuggestedAction(deal.daysSinceLastActivity)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════ 6. PERFORMANCE SECTION ═══════ */}
      <div style={{ ...GLASS, padding: 22 }}>
        <h3 style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          color: TEXT,
          margin: "0 0 18px",
        }}>
          {isTeam ? "Team Performance" : "My Performance"}
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {(data.performance.length > 0 ? data.performance : DEFAULT_PERFORMANCE).map((metric) => {
            const delta = metric.thisMonth - metric.lastMonth
            let deltaColor = TEXT_TER
            let deltaSymbol = "—"
            if (delta > 0) { deltaColor = GREEN; deltaSymbol = "▲" }
            if (delta < 0) { deltaColor = RED; deltaSymbol = "▼" }

            return (
              <div key={metric.label} style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: 10,
                padding: "14px 16px",
              }}>
                <span style={{
                  fontSize: 10,
                  color: TEXT_TER,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  display: "block",
                  marginBottom: 8,
                }}>
                  {metric.label}
                </span>
                <span style={{
                  fontFamily: "'Bellfair', serif",
                  fontSize: 24,
                  color: TEXT,
                  lineHeight: 1,
                  display: "block",
                }}>
                  {metric.label === "Revenue Won" ? fmtCurrency(metric.thisMonth) : metric.thisMonth}
                </span>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, color: deltaColor, fontFamily: "'DM Sans', sans-serif" }}>
                    {deltaSymbol}
                  </span>
                  <span style={{ fontSize: 10, color: TEXT_TER, fontFamily: "'DM Sans', sans-serif" }}>
                    vs last month:{" "}
                    {metric.label === "Revenue Won" ? fmtCurrency(metric.lastMonth) : metric.lastMonth}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Default performance metrics (fallback) ── */
const DEFAULT_PERFORMANCE: PerformanceMetric[] = [
  { label: "Deals Created", thisMonth: 0, lastMonth: 0 },
  { label: "Meetings Booked", thisMonth: 0, lastMonth: 0 },
  { label: "Proposals Sent", thisMonth: 0, lastMonth: 0 },
  { label: "Deals Won", thisMonth: 0, lastMonth: 0 },
  { label: "Deals Lost", thisMonth: 0, lastMonth: 0 },
  { label: "Revenue Won", thisMonth: 0, lastMonth: 0 },
]

/* ── Task Section Sub-component ── */
function TaskSection({
  title,
  titleColor,
  tasks,
  dotColor,
}: {
  title: string
  titleColor: string
  tasks: DashboardTask[]
  dotColor: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h4 style={{
        fontSize: 11,
        fontWeight: 600,
        color: titleColor,
        fontFamily: "'DM Sans', sans-serif",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        margin: "0 0 8px",
      }}>
        {title}
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 6px",
              borderRadius: 8,
              cursor: "pointer",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
          >
            {/* Dot */}
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
            }} />

            {/* Type icon */}
            <span style={{ fontSize: 12, flexShrink: 0 }}>
              {TASK_TYPE_ICONS[task.type] ?? "📌"}
            </span>

            {/* Title + contact */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 12,
                color: TEXT,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {task.title}
              </span>
              {task.contactName && (
                <span style={{ fontSize: 10, color: TEXT_TER, fontFamily: "'DM Sans', sans-serif" }}>
                  {task.contactName}
                </span>
              )}
            </div>

            {/* Type badge */}
            <span style={{
              fontSize: 9,
              color: TEXT_TER,
              fontFamily: "'DM Sans', sans-serif",
              background: "rgba(255,255,255,0.05)",
              padding: "2px 7px",
              borderRadius: 8,
              flexShrink: 0,
              textTransform: "capitalize",
            }}>
              {(task.type ?? "").replace(/_/g, " ")}
            </span>

            {/* Time overdue */}
            {task.overdueDays != null && task.overdueDays > 0 && (
              <span style={{
                fontSize: 10,
                color: RED,
                fontFamily: "'DM Sans', sans-serif",
                flexShrink: 0,
              }}>
                {task.overdueDays}d overdue
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Skeleton Dashboard ── */
function SkeletonDashboard() {
  const skeletonBlock = (w: string | number, h: number): React.CSSProperties => ({
    width: typeof w === "number" ? w : w,
    height: h,
    borderRadius: 8,
    background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
    backgroundSize: "200% 100%",
    animation: "oxen-skeleton-pulse 1.5s ease-in-out infinite",
  })

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh" }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 28 }}>
        <div style={skeletonBlock(280, 32)} />
        <div style={{ ...skeletonBlock(180, 14), marginTop: 8 }} />
      </div>

      {/* KPI row skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...GLASS, padding: 20 }}>
            <div style={skeletonBlock(60, 28)} />
            <div style={{ ...skeletonBlock(90, 12), marginTop: 10 }} />
          </div>
        ))}
      </div>

      {/* Funnel skeleton */}
      <div style={{ ...GLASS, padding: 22, marginBottom: 24 }}>
        <div style={skeletonBlock(120, 16)} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <div style={skeletonBlock(140, 14)} />
            <div style={{ ...skeletonBlock("100%", 20), flex: 1 }} />
            <div style={skeletonBlock(60, 14)} />
          </div>
        ))}
      </div>

      {/* Two-column skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ ...GLASS, padding: 22 }}>
            <div style={skeletonBlock(100, 16)} />
            {[0, 1, 2].map((j) => (
              <div key={j} style={{ ...skeletonBlock("100%", 14), marginTop: 12 }} />
            ))}
          </div>
        ))}
      </div>

      {/* Performance skeleton */}
      <div style={{ ...GLASS, padding: 22 }}>
        <div style={skeletonBlock(130, 16)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 18 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={skeletonBlock(80, 10)} />
              <div style={{ ...skeletonBlock(50, 24), marginTop: 8 }} />
              <div style={{ ...skeletonBlock(100, 10), marginTop: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
