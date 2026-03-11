"use client"

interface ActivityItem {
  id: string
  action: string
  detail: string
  userId: string
  createdAt: string
}

const actionLabels: Record<string, string> = {
  wiki_created: "📝 Wiki page created",
  wiki_updated: "📝 Wiki page updated",
  callnote_generated: "📅 Call notes generated",
  employee_added: "👥 Employee added",
  employee_updated: "👥 Employee updated",
  kpi_added: "📊 KPI updated",
}

export default function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
        ⚡ Recent Activity
      </h3>
      {activities.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          No recent activity
        </p>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 10).map((a) => (
            <div key={a.id}>
              <div className="text-xs font-medium" style={{ color: "var(--text-mid)" }}>
                {actionLabels[a.action] ?? a.action}
              </div>
              <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                {a.detail} ·{" "}
                {new Date(a.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
