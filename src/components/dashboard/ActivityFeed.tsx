"use client"

interface ActivityItem {
  id: string
  action: string
  detail: string
  userId: string
  createdAt: string
}

const actionConfig: Record<string, { label: string; icon: string; color: string }> = {
  wiki_created: { label: "Wiki page created", icon: "\uD83D\uDCDD", color: "var(--blue)" },
  wiki_updated: { label: "Wiki page updated", icon: "\uD83D\uDCDD", color: "var(--blue)" },
  callnote_generated: { label: "Call notes generated", icon: "\uD83D\uDCC5", color: "var(--green)" },
  employee_added: { label: "Employee added", icon: "\uD83D\uDC65", color: "var(--purple)" },
  employee_updated: { label: "Employee updated", icon: "\uD83D\uDC65", color: "var(--purple)" },
  kpi_added: { label: "KPI updated", icon: "\uD83D\uDCCA", color: "var(--yellow)" },
}

export default function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-header">
        <span style={{ fontSize: 14 }}>{"\u26A1"}</span>
        <span>Recent Activity</span>
      </div>
      <div className="card-body">
        {activities.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center"
            style={{ padding: "24px 0", color: "var(--text-dim)" }}
          >
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>{"\u26A1"}</div>
            <div style={{ fontSize: 12 }}>No recent activity</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {activities.slice(0, 10).map((a) => {
              const config = actionConfig[a.action] ?? {
                label: a.action,
                icon: "\u2022",
                color: "var(--text-mid)",
              }
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-3"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Timeline dot */}
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: `${config.color}18`,
                      fontSize: 13,
                      marginTop: 1,
                    }}
                  >
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--text-mid)",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {config.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        fontFamily: "'DM Sans', sans-serif",
                        marginTop: 1,
                      }}
                    >
                      {a.detail} {"\u00B7"}{" "}
                      {new Date(a.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
