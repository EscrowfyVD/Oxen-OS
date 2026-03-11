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
    { metric: "Revenue", value: 0, icon: "💰" },
    { metric: "Active Clients", value: 0, icon: "👤" },
    { metric: "Pipeline Value", value: 0, icon: "📊" },
    { metric: "Team Members", value: teamCount, icon: "👥" },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of Oxen Finance operations" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {defaultKpis.map((kpi) => {
          const entry = kpis.find((k) => k.metric === kpi.metric.toLowerCase().replace(/ /g, "_"))
          return (
            <KpiCard
              key={kpi.metric}
              label={kpi.metric}
              value={entry?.value ?? kpi.value}
              previousValue={entry?.previousValue}
              icon={kpi.icon}
            />
          )
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
