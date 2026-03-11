"use client"

import { useEffect, useState } from "react"
import PageHeader from "@/components/layout/PageHeader"
import KpiCard from "@/components/dashboard/KpiCard"
import UpcomingCalls from "@/components/dashboard/UpcomingCalls"
import RecentWiki from "@/components/dashboard/RecentWiki"
import ActivityFeed from "@/components/dashboard/ActivityFeed"

interface KpiData {
  metric: string
  value: number
  previousValue?: number
}

interface ActivityItem {
  id: string
  action: string
  detail: string
  userId: string
  createdAt: string
}

const KPI_CONFIG: Record<string, { icon: string; color: string }> = {
  Revenue: { icon: "\uD83D\uDCB0", color: "#5CB868" },
  "Active Clients": { icon: "\uD83D\uDC64", color: "#5B9BBF" },
  "Pipeline Value": { icon: "\uD83D\uDCCA", color: "#9B7FD4" },
  "Team Members": { icon: "\uD83D\uDC65", color: "#C08B88" },
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KpiData[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [teamCount, setTeamCount] = useState(0)

  useEffect(() => {
    fetch("/api/kpi")
      .then((r) => r.json())
      .then((data) => setKpis(data.kpis ?? []))
      .catch(() => {})

    fetch("/api/activity")
      .then((r) => r.json())
      .then((data) => setActivities(data.activities ?? []))
      .catch(() => {})

    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setTeamCount(data.employees?.length ?? 0))
      .catch(() => {})
  }, [])

  const defaultKpis = [
    { metric: "Revenue", value: 0 },
    { metric: "Active Clients", value: 0 },
    { metric: "Pipeline Value", value: 0 },
    { metric: "Team Members", value: teamCount },
  ]

  return (
    <div className="page-content">
      <PageHeader title="Dashboard" description="Overview of Oxen Finance operations" />

      {/* KPI Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        style={{ marginBottom: 28 }}
      >
        {defaultKpis.map((kpi) => {
          const entry = kpis.find(
            (k) => k.metric === kpi.metric.toLowerCase().replace(/ /g, "_")
          )
          const config = KPI_CONFIG[kpi.metric] ?? { icon: "\uD83D\uDCCA", color: "var(--rose)" }
          return (
            <KpiCard
              key={kpi.metric}
              label={kpi.metric}
              value={entry?.value ?? kpi.value}
              previousValue={entry?.previousValue}
              icon={config.icon}
              color={config.color}
            />
          )
        })}
      </div>

      {/* Welcome highlight box */}
      <div className="highlight-box" style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: 4,
          }}
        >
          {"\uD83D\uDC4B"} Welcome to Oxen OS
        </div>
        <div style={{ fontSize: 12, color: "var(--text-mid)", lineHeight: 1.6 }}>
          Your team&apos;s internal operating system. Manage calendars, knowledge base, and team
          structure all in one place.
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1">
          <UpcomingCalls />
        </div>
        <div className="lg:col-span-1">
          <RecentWiki />
        </div>
        <div className="lg:col-span-1">
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  )
}
