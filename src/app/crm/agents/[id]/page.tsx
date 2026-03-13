"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import Counter from "@/components/dashboard/Counter"
import AgentModal from "@/components/crm/AgentModal"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, GREEN, AMBER, ROSE_GOLD, RED, INDIGO,
  AGENT_TYPE_COLORS, HEALTH_COLORS, STATUS_COLORS,
  CHART_COLORS, labelStyle,
} from "@/components/crm/constants"
import type { Agent } from "@/components/crm/types"

interface AgentStats {
  totalClients: number
  totalRevenue: number
  totalGtv: number
  avgCommission: number
  activeDeals: number
  monthlyTrend: Array<{ month: string; revenue: number }>
}

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [agent, setAgent] = useState<Agent | null>(null)
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const fetchAgent = useCallback(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((data) => { setAgent(data.agent ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const fetchStats = useCallback(() => {
    fetch(`/api/agents/${id}/stats`)
      .then((r) => r.json())
      .then((data) => setStats(data.stats ?? null))
      .catch(() => {})
  }, [id])

  useEffect(() => { fetchAgent(); fetchStats() }, [fetchAgent, fetchStats])

  const handleDelete = async () => {
    try {
      await fetch(`/api/agents/${id}`, { method: "DELETE" })
      router.push("/crm")
    } catch { /* silent */ }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)

  if (loading) return <div style={{ padding: "60px 32px", textAlign: "center", color: TEXT_TERTIARY }}>Loading...</div>
  if (!agent) return (
    <div style={{ padding: "60px 32px", textAlign: "center", color: TEXT_TERTIARY }}>
      Agent not found. <span style={{ color: ROSE_GOLD, cursor: "pointer" }} onClick={() => router.push("/crm")}>Back to CRM</span>
    </div>
  )

  const typeColor = AGENT_TYPE_COLORS[agent.type] ?? AGENT_TYPE_COLORS.other
  const statusColor = agent.status === "active" ? GREEN : agent.status === "inactive" ? TEXT_TERTIARY : AMBER

  const kpis = [
    { label: "Referred Clients", value: stats?.totalClients ?? 0, color: INDIGO, prefix: "" },
    { label: "Total Revenue", value: stats?.totalRevenue ?? 0, color: GREEN, prefix: "\u20AC" },
    { label: "Commission Rate", value: agent.commissionDirect, color: ROSE_GOLD, prefix: "", suffix: "%" },
    { label: "Active Deals", value: stats?.activeDeals ?? 0, color: AMBER, prefix: "" },
  ]

  return (
    <div className="page-content" style={{ padding: 0 }}>
      {/* Header */}
      <div className="sticky-header" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px", background: "rgba(6,7,9,0.88)", backdropFilter: "blur(24px)",
        borderBottom: `1px solid ${CARD_BORDER}`, position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => router.push("/crm")} style={{ background: "none", border: "none", color: TEXT_TERTIARY, fontSize: 18, cursor: "pointer", padding: "4px 8px" }}>
            {"\u2190"}
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 24, fontWeight: 400, color: FROST, margin: 0 }}>{agent.name}</h1>
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: typeColor.bg, color: typeColor.text }}>
                {agent.type.replace(/_/g, " ")}
              </span>
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: `${statusColor}18`, color: statusColor }}>
                {agent.status}
              </span>
            </div>
            {agent.company && <p style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{agent.company}</p>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowEditModal(true)} className="header-btn">Edit</button>
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} style={{
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
              color: RED, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
              padding: "6px 14px", borderRadius: 6, cursor: "pointer",
            }}>Delete</button>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: RED }}>Confirm?</span>
              <button onClick={handleDelete} style={{ background: RED, border: "none", color: FROST, fontSize: 11, padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}>Yes</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary" style={{ padding: "6px 12px", fontSize: 11 }}>No</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "28px 32px" }}>
        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{kpi.label}</div>
              <div style={{ fontSize: 28, fontFamily: "'Bellfair', serif", color: FROST, marginTop: 8 }}>
                {kpi.prefix}<Counter target={kpi.value} duration={600} />{kpi.suffix ?? ""}
              </div>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
          {/* Left: Agent Info */}
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 24 }}>
            <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: "0 0 16px" }}>Agent Information</h3>
            {[
              { label: "Email", value: agent.email },
              { label: "Phone", value: agent.phone },
              { label: "Telegram", value: agent.telegram },
              { label: "WhatsApp", value: agent.whatsapp },
              { label: "Country", value: agent.country },
              { label: "Website", value: agent.website },
              { label: "Direct Commission", value: `${agent.commissionDirect}%` },
              { label: "Indirect Commission", value: `${agent.commissionIndirect}%` },
              { label: "Onboarded", value: agent.onboardedAt ? new Date(agent.onboardedAt).toLocaleDateString() : null },
            ].map(({ label, value }) => value && (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={labelStyle}>{label}</div>
                <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
              </div>
            ))}
            {agent.notes && (
              <div style={{ marginTop: 8 }}>
                <div style={labelStyle}>Notes</div>
                <div style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>{agent.notes}</div>
              </div>
            )}
          </div>

          {/* Right: Clients + Chart */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Revenue Chart */}
            {stats?.monthlyTrend && stats.monthlyTrend.length > 1 && (
              <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: 24 }}>
                <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: "0 0 16px" }}>Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stats.monthlyTrend}>
                    <defs>
                      <linearGradient id="agentRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GREEN} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `\u20AC${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: CHART_COLORS.tooltip, border: `1px solid ${CARD_BORDER}`, borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: TEXT_TERTIARY }}
                      formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke={GREEN} fill="url(#agentRevGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Referred Clients Table */}
            <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST, margin: 0 }}>
                  Referred Clients ({agent.referredClients?.length ?? 0})
                </h3>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                    {["Name", "Company", "Revenue", "Status", "Health"].map((h) => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: "left", fontSize: 10, color: TEXT_TERTIARY,
                        textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(agent.referredClients as any[] ?? []).map((client: any) => {
                    const hc = HEALTH_COLORS[client.healthStatus] ?? HEALTH_COLORS.healthy
                    const sc = STATUS_COLORS[client.status] ?? STATUS_COLORS.lead
                    return (
                      <tr key={client.id} onClick={() => router.push(`/crm/${client.id}`)} style={{
                        borderBottom: `1px solid ${CARD_BORDER}`, cursor: "pointer",
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "10px 14px", fontSize: 13, color: FROST, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{client.name}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>{client.company || "\u2014"}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: GREEN, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{formatCurrency(client.monthlyRevenue ?? 0)}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: sc.bg, color: sc.text, fontFamily: "'DM Sans', sans-serif" }}>{client.status}</span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: hc.bg, color: hc.text, fontFamily: "'DM Sans', sans-serif" }}>{client.healthStatus?.replace("_", " ")}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {(!agent.referredClients || agent.referredClients.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ padding: 40, textAlign: "center", color: TEXT_TERTIARY, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No referred clients yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <AgentModal
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
        agent={agent}
        onSaved={() => { setShowEditModal(false); fetchAgent(); fetchStats() }}
      />
    </div>
  )
}
