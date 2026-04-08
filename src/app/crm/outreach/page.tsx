"use client"

import { useState, useEffect, useCallback } from "react"
import { CRM_COLORS } from "@/lib/crm-config"

/* ── Design Tokens ── */
const BG = "var(--void)"
const CARD_BG = CRM_COLORS.card_bg
const CARD_BORDER = CRM_COLORS.card_border
const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const GLASS = { background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, backdropFilter: CRM_COLORS.glass_blur, WebkitBackdropFilter: CRM_COLORS.glass_blur, boxShadow: CRM_COLORS.glass_shadow }

/* ── Types ── */
interface OutreachDomain {
  id: string
  domain: string
  owner: string
  mailbox: string
  provider: string
  status: string
  warmupStartDate: string | null
  activeDate: string | null
  spfValid: boolean
  dkimValid: boolean
  dmarcValid: boolean
  trackingDomain: string | null
  trackingValid: boolean
  openRate: number | null
  replyRate: number | null
  bounceRate: number | null
  spamRate: number | null
  inboxPlacement: number | null
  isBlacklisted: boolean
  blacklistDetails: string | null
  lastHealthCheck: string | null
  notes: string | null
  createdAt: string
}

interface OutreachCampaign {
  id: string
  name: string
  lemlistCampaignId: string | null
  vertical: string | null
  owner: string
  domainId: string | null
  domain: OutreachDomain | null
  status: string
  platform: string
  totalSent: number
  totalOpened: number
  totalClicked: number
  totalReplied: number
  totalBounced: number
  totalUnsubscribed: number
  repliesInterested: number
  repliesNotInterested: number
  repliesOoo: number
  meetingsBooked: number
  startDate: string | null
  endDate: string | null
  createdAt: string
}

interface SuppressionEntry {
  id: string
  email: string
  reason: string
  source: string | null
  addedBy: string | null
  contactId: string | null
  createdAt: string
}

interface OutreachAlert {
  id: string
  type: string
  severity: string
  domainId: string | null
  campaignId: string | null
  title: string
  detail: string
  resolved: boolean
  resolvedAt: string | null
  resolvedBy: string | null
  createdAt: string
}

/* ── Helpers ── */
function pct(n: number, d: number): string {
  if (d === 0) return "0%"
  return `${((n / d) * 100).toFixed(1)}%`
}

function rateColor(type: "bounce" | "spam" | "open" | "reply", value: number | null): string {
  if (value === null) return TEXT3
  if (type === "bounce") return value < 2 ? "#34D399" : value < 3 ? "#FBBF24" : "#F87171"
  if (type === "spam") return value < 0.1 ? "#34D399" : value < 0.3 ? "#FBBF24" : "#F87171"
  if (type === "open") return value > 40 ? "#34D399" : value > 30 ? "#FBBF24" : "#F87171"
  if (type === "reply") return value > 5 ? "#34D399" : value > 3 ? "#FBBF24" : "#F87171"
  return TEXT3
}

function statusBadge(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    warmup: { bg: "rgba(96,165,250,0.15)", color: "#60A5FA" },
    active: { bg: "rgba(52,211,153,0.15)", color: "#34D399" },
    paused: { bg: "rgba(251,191,36,0.15)", color: "#FBBF24" },
    blacklisted: { bg: "rgba(248,113,113,0.15)", color: "#F87171" },
    completed: { bg: "rgba(156,163,175,0.15)", color: "#9CA3AF" },
    draft: { bg: "rgba(156,163,175,0.15)", color: "#9CA3AF" },
  }
  const c = colors[status] ?? colors.active
  return { display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: c.bg, color: c.color, textTransform: "capitalize" as const }
}

function reasonBadge(reason: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    unsubscribed: { bg: "rgba(248,113,113,0.15)", color: "#F87171" },
    bounced: { bg: "rgba(251,191,36,0.15)", color: "#FBBF24" },
    "do_not_contact": { bg: "rgba(168,85,247,0.15)", color: "#A855F7" },
    "spam_complaint": { bg: "rgba(248,113,113,0.15)", color: "#F87171" },
    manual: { bg: "rgba(156,163,175,0.15)", color: "#9CA3AF" },
  }
  const c = colors[reason] ?? colors.manual
  return { display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: c.bg, color: c.color, textTransform: "capitalize" as const }
}

function fmtDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function warmupWeeks(startDate: string | null): number {
  if (!startDate) return 0
  const diffMs = Date.now() - new Date(startDate).getTime()
  return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)))
}

const lbl: React.CSSProperties = { fontSize: 10, color: TEXT3, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }
const val: React.CSSProperties = { fontSize: 18, fontFamily: "'Bellfair', serif", color: TEXT }
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "var(--surface-input)", color: TEXT, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" }
const btnPrimary: React.CSSProperties = { padding: "8px 20px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }
const btnSecondary: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "var(--surface-input)", color: TEXT2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }

type Section = "domains" | "campaigns" | "suppression" | "warmup"

/* ════════════════════════════════════════════════════════════════
   OUTREACH COMMAND CENTER
   ════════════════════════════════════════════════════════════════ */
export default function OutreachPage() {
  const [section, setSection] = useState<Section>("domains")
  const [ownerFilter, setOwnerFilter] = useState("all")

  // Data
  const [domains, setDomains] = useState<OutreachDomain[]>([])
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([])
  const [suppression, setSuppression] = useState<SuppressionEntry[]>([])
  const [alerts, setAlerts] = useState<OutreachAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncingLemlist, setSyncingLemlist] = useState(false)

  // Suppression
  const [suppressionSearch, setSuppressionSearch] = useState("")
  const [suppressionPage, setSuppressionPage] = useState(1)
  const [suppressionTotal, setSuppressionTotal] = useState(0)

  // Modals
  const [showAddDomain, setShowAddDomain] = useState(false)
  const [showAddCampaign, setShowAddCampaign] = useState(false)
  const [showAddSuppression, setShowAddSuppression] = useState(false)
  const [showImportSuppression, setShowImportSuppression] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<OutreachCampaign | null>(null)

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000) }

  /* ── Fetchers ── */
  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/outreach/domains")
      if (res.ok) { const data = await res.json(); setDomains(data.domains ?? []) }
    } catch { /* */ }
  }, [])

  const fetchCampaigns = useCallback(async () => {
    const params = ownerFilter !== "all" ? `?owner=${ownerFilter}` : ""
    try {
      const res = await fetch(`/api/crm/outreach/campaigns${params}`)
      if (res.ok) { const data = await res.json(); setCampaigns(data.campaigns ?? []) }
    } catch { /* */ }
  }, [ownerFilter])

  const fetchSuppression = useCallback(async (page = 1) => {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "50")
    if (suppressionSearch) params.set("q", suppressionSearch)
    try {
      const res = await fetch(`/api/crm/outreach/suppression?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSuppression(data.entries ?? [])
        setSuppressionTotal(data.pagination?.total ?? 0)
        setSuppressionPage(page)
      }
    } catch { /* */ }
  }, [suppressionSearch])

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/outreach/alerts?resolved=false")
      if (res.ok) { const data = await res.json(); setAlerts(data.alerts ?? []) }
    } catch { /* */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchDomains(), fetchCampaigns(), fetchAlerts(), fetchSuppression()])
      .finally(() => setLoading(false))
  }, [fetchDomains, fetchCampaigns, fetchAlerts, fetchSuppression])

  const handleSyncMetrics = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/crm/outreach/check-health", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        showToast(`Health check complete: ${data.checked} domains checked, ${data.alerts} alerts generated`)
        fetchDomains()
        fetchAlerts()
      }
    } catch { showToast("Health check failed") }
    setSyncing(false)
  }

  const handleSyncLemlist = async () => {
    setSyncingLemlist(true)
    try {
      const res = await fetch("/api/lemlist/sync", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        showToast(`Synced ${data.outreachCampaignsSynced ?? data.campaigns} campaigns from Lemlist. ${data.synced} contacts matched.`)
        fetchCampaigns()
      } else {
        showToast("Lemlist sync failed")
      }
    } catch { showToast("Lemlist sync failed") }
    setSyncingLemlist(false)
  }

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/crm/outreach/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      })
      if (res.ok) fetchAlerts()
    } catch { /* */ }
  }

  const handleDeleteSuppression = async (id: string) => {
    try {
      const res = await fetch(`/api/crm/outreach/suppression/${id}`, { method: "DELETE" })
      if (res.ok) { fetchSuppression(suppressionPage); showToast("Entry removed") }
    } catch { /* */ }
  }

  const handleExportSuppression = async () => {
    const res = await fetch("/api/crm/outreach/suppression/export")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `suppression-list-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredDomains = ownerFilter === "all" ? domains : domains.filter(d => d.owner === ownerFilter)
  const warmupDomains = domains.filter(d => d.status === "warmup")

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="page-content" style={{ padding: 0, background: BG, minHeight: "100vh" }}>
      {/* ════ HEADER ════ */}
      <div style={{ padding: "16px 32px", borderBottom: `1px solid ${CARD_BORDER}`, background: "var(--header-bg)", backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 32, fontWeight: 400, color: "var(--text-primary)", margin: 0, lineHeight: 1.2 }}>Outreach Command Center</h1>
            <p style={{ fontSize: 12, color: TEXT3, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
              {domains.length} domains &middot; {campaigns.length} campaigns &middot; {suppression.length} suppressed
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={{ ...selectStyle, minWidth: 120 }}>
              <option value="all">All Owners</option>
              <option value="Andy">Andy</option>
              <option value="Paul Louis">Paul Louis</option>
            </select>
            <button onClick={handleSyncMetrics} disabled={syncing} style={{ ...btnSecondary, opacity: syncing ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={syncing ? { animation: "spin 1s linear infinite" } : undefined}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              {syncing ? "Checking..." : "Sync Metrics"}
            </button>
            <button onClick={handleSyncLemlist} disabled={syncingLemlist} style={{ ...btnSecondary, opacity: syncingLemlist ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={syncingLemlist ? { animation: "spin 1s linear infinite" } : undefined}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              {syncingLemlist ? "Syncing..." : "Sync Lemlist"}
            </button>
          </div>
        </div>

        {/* Section Nav */}
        <div style={{ display: "flex", gap: 2, background: "var(--surface-elevated)", borderRadius: 8, padding: 3 }}>
          {([
            { id: "domains" as Section, label: "Domain Health" },
            { id: "campaigns" as Section, label: "Campaigns" },
            { id: "suppression" as Section, label: "Suppression List" },
            { id: "warmup" as Section, label: "Warmup Tracker" },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id)}
              style={{ padding: "6px 14px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, border: "none", borderRadius: 6, cursor: "pointer", transition: "all 0.15s", background: section === tab.id ? `${ROSE}22` : "transparent", color: section === tab.id ? TEXT : TEXT3 }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: TEXT3, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading outreach data...</div>
      ) : (
        <div style={{ padding: "20px 32px" }}>
          {/* ════ ALERTS BAR ════ */}
          {alerts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {alerts.map((alert) => (
                <div key={alert.id} style={{ ...GLASS, padding: "10px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: `3px solid ${alert.severity === "critical" ? "#F87171" : "#FBBF24"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={statusBadge(alert.severity === "critical" ? "blacklisted" : "paused")}>{alert.severity}</span>
                    <span style={{ fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{alert.title}</span>
                    <span style={{ fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif" }}>{alert.detail}</span>
                  </div>
                  <button onClick={() => handleResolveAlert(alert.id)} style={{ ...btnSecondary, padding: "4px 12px", fontSize: 11 }}>Resolve</button>
                </div>
              ))}
            </div>
          )}

          {/* ════ SECTION 1: DOMAIN HEALTH ════ */}
          {section === "domains" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 22, color: TEXT, margin: 0 }}>Domain Health</h2>
                <button onClick={() => setShowAddDomain(true)} style={btnPrimary}>+ Add Domain</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
                {filteredDomains.map((d) => (
                  <div key={d.id} style={{ ...GLASS, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{d.domain}</div>
                        <div style={{ fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{d.mailbox}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ ...statusBadge("active"), background: d.owner === "Andy" ? "rgba(96,165,250,0.15)" : "rgba(168,85,247,0.15)", color: d.owner === "Andy" ? "#60A5FA" : "#A855F7" }}>{d.owner}</span>
                        <span style={statusBadge(d.isBlacklisted ? "blacklisted" : d.status)}>{d.isBlacklisted ? "Blacklisted" : d.status}</span>
                      </div>
                    </div>

                    {/* DNS Indicators */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                      {[
                        { label: "SPF", ok: d.spfValid },
                        { label: "DKIM", ok: d.dkimValid },
                        { label: "DMARC", ok: d.dmarcValid },
                        { label: "Tracking", ok: d.trackingValid },
                      ].map((dns) => (
                        <div key={dns.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dns.ok ? "#34D399" : "#F87171" }} />
                          <span style={{ fontSize: 11, color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>{dns.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Health Metrics */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                      {[
                        { label: "Open", value: d.openRate, type: "open" as const },
                        { label: "Reply", value: d.replyRate, type: "reply" as const },
                        { label: "Bounce", value: d.bounceRate, type: "bounce" as const },
                        { label: "Spam", value: d.spamRate, type: "spam" as const },
                      ].map((m) => (
                        <div key={m.label} style={{ textAlign: "center" }}>
                          <div style={lbl}>{m.label}</div>
                          <div style={{ ...val, fontSize: 16, color: rateColor(m.type, m.value) }}>{m.value !== null ? `${m.value.toFixed(1)}%` : "—"}</div>
                        </div>
                      ))}
                    </div>

                    {/* Warmup Progress */}
                    {d.status === "warmup" && d.warmupStartDate && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ ...lbl, marginBottom: 4 }}>Warmup Progress — Week {warmupWeeks(d.warmupStartDate) + 1}</div>
                        <div style={{ height: 6, borderRadius: 3, background: "var(--surface-input)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, #60A5FA, ${ROSE})`, width: `${Math.min(100, (warmupWeeks(d.warmupStartDate) / 5) * 100)}%`, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    )}

                    {d.lastHealthCheck && (
                      <div style={{ marginTop: 10, fontSize: 10, color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>Last check: {fmtDate(d.lastHealthCheck)}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════ SECTION 2: CAMPAIGNS ════ */}
          {section === "campaigns" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 22, color: TEXT, margin: 0 }}>Campaign Performance</h2>
                <button onClick={() => setShowAddCampaign(true)} style={btnPrimary}>+ Add Campaign</button>
              </div>
              <div style={{ ...GLASS, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {["Campaign", "Vertical", "Owner", "Domain", "Status", "Sent", "Opened", "Replied", "Bounced", "Meetings", "Started"].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", fontSize: 10, color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.length === 0 ? (
                      <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: TEXT3, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No campaigns yet</td></tr>
                    ) : campaigns.map((c) => {
                      const replyRateNum = c.totalSent > 0 ? (c.totalReplied / c.totalSent) * 100 : 0
                      return (
                        <tr key={c.id} onClick={() => setSelectedCampaign(c)} style={{ borderBottom: `1px solid ${CARD_BORDER}`, cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = `${ROSE}08`)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                            {c.name}
                            {c.lemlistCampaignId && <span style={{ marginLeft: 6, display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: "rgba(96,165,250,0.15)", color: "#60A5FA", verticalAlign: "middle" }}>lemlist</span>}
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif" }}>{c.vertical ?? "—"}</td>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif" }}>{c.owner}</td>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif" }}>{c.domain?.domain ?? "—"}</td>
                          <td style={{ padding: "10px 12px" }}><span style={statusBadge(c.status)}>{c.status}</span></td>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: TEXT, fontFamily: "'Bellfair', serif" }}>{c.totalSent}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: TEXT, fontFamily: "'Bellfair', serif" }}>{pct(c.totalOpened, c.totalSent)}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, fontFamily: "'Bellfair', serif", color: rateColor("reply", replyRateNum) }}>{pct(c.totalReplied, c.totalSent)}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, fontFamily: "'Bellfair', serif", color: rateColor("bounce", c.totalSent > 0 ? (c.totalBounced / c.totalSent) * 100 : 0) }}>{pct(c.totalBounced, c.totalSent)}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, color: ROSE, fontFamily: "'Bellfair', serif", fontWeight: 600 }}>{c.meetingsBooked}</td>
                          <td style={{ padding: "10px 12px", fontSize: 12, color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>{fmtDate(c.startDate)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════ SECTION 3: SUPPRESSION LIST ════ */}
          {section === "suppression" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 22, color: TEXT, margin: 0 }}>Global Suppression List</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowAddSuppression(true)} style={btnPrimary}>+ Add</button>
                  <button onClick={() => setShowImportSuppression(true)} style={btnSecondary}>Import CSV</button>
                  <button onClick={handleExportSuppression} style={btnSecondary}>Export</button>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={suppressionSearch}
                  onChange={(e) => setSuppressionSearch(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 340 }}
                />
              </div>

              <div style={{ ...GLASS, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {["Email", "Reason", "Source", "Added By", "Date", ""].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", fontSize: 10, color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suppression.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: TEXT3, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No suppressed emails</td></tr>
                    ) : suppression.map((s) => (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{s.email}</td>
                        <td style={{ padding: "10px 12px" }}><span style={reasonBadge(s.reason)}>{s.reason.replace(/_/g, " ")}</span></td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif" }}>{s.source ?? "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif" }}>{s.addedBy ?? "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>{fmtDate(s.createdAt)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <button onClick={() => handleDeleteSuppression(s.id)} style={{ background: "none", border: "none", color: "#F87171", cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {suppressionTotal > 50 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                  <button disabled={suppressionPage <= 1} onClick={() => fetchSuppression(suppressionPage - 1)} style={{ ...btnSecondary, opacity: suppressionPage <= 1 ? 0.4 : 1 }}>Prev</button>
                  <span style={{ fontSize: 12, color: TEXT3, fontFamily: "'DM Sans', sans-serif", lineHeight: "32px" }}>Page {suppressionPage}</span>
                  <button disabled={suppressionPage * 50 >= suppressionTotal} onClick={() => fetchSuppression(suppressionPage + 1)} style={{ ...btnSecondary, opacity: suppressionPage * 50 >= suppressionTotal ? 0.4 : 1 }}>Next</button>
                </div>
              )}
            </div>
          )}

          {/* ════ SECTION 5: WARMUP TRACKER ════ */}
          {section === "warmup" && (
            <div>
              <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 22, color: TEXT, margin: 0, marginBottom: 16 }}>Warmup Tracker</h2>
              {warmupDomains.length === 0 ? (
                <div style={{ ...GLASS, padding: 40, textAlign: "center", color: TEXT3, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No domains currently in warmup</div>
              ) : warmupDomains.map((d) => {
                const weeks = warmupWeeks(d.warmupStartDate)
                const phases = [
                  { label: "Warmup Only", weeks: "1-2", color: "#60A5FA", active: weeks < 2 },
                  { label: "Low Volume", weeks: "3-4", color: "#FBBF24", active: weeks >= 2 && weeks < 4 },
                  { label: "Full Volume", weeks: "5+", color: "#34D399", active: weeks >= 4 },
                ]
                return (
                  <div key={d.id} style={{ ...GLASS, padding: 20, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, fontFamily: "'DM Sans', sans-serif" }}>{d.domain}</span>
                        <span style={{ fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif", marginLeft: 10 }}>{d.mailbox}</span>
                      </div>
                      <span style={{ fontSize: 12, color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>Week {weeks + 1} — Started {fmtDate(d.warmupStartDate)}</span>
                    </div>

                    {/* Timeline */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {phases.map((phase, i) => (
                        <div key={i} style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: phase.active ? `${phase.color}20` : "var(--surface-input)", border: phase.active ? `2px solid ${phase.color}` : `1px solid ${CARD_BORDER}`, transition: "all 0.3s" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: phase.active ? phase.color : TEXT3, fontFamily: "'DM Sans', sans-serif" }}>{phase.label}</div>
                          <div style={{ fontSize: 10, color: TEXT3, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Week {phase.weeks}</div>
                        </div>
                      ))}
                    </div>

                    {/* Warmup Rules */}
                    <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "var(--surface-input)" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: TEXT3, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", marginBottom: 6 }}>Warmup Rules</div>
                      <div style={{ fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
                        {weeks < 2 ? "Week 1-2: Send only warmup emails. No cold outreach. Max 10 emails/day." : weeks < 4 ? "Week 3-4: Begin low-volume cold outreach. Max 25 emails/day. Monitor bounce rate closely." : "Week 5+: Full volume enabled. Max 50 emails/day. Continue monitoring deliverability."}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════ MODALS ════ */}

      {/* Add Domain Modal */}
      {showAddDomain && <AddDomainModal onClose={() => setShowAddDomain(false)} onSaved={() => { setShowAddDomain(false); fetchDomains(); showToast("Domain added") }} />}

      {/* Add Campaign Modal */}
      {showAddCampaign && <AddCampaignModal domains={domains} onClose={() => setShowAddCampaign(false)} onSaved={() => { setShowAddCampaign(false); fetchCampaigns(); showToast("Campaign added") }} />}

      {/* Campaign Detail Modal */}
      {selectedCampaign && <CampaignDetailModal campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />}

      {/* Add Suppression Modal */}
      {showAddSuppression && <AddSuppressionModal onClose={() => setShowAddSuppression(false)} onSaved={() => { setShowAddSuppression(false); fetchSuppression(); showToast("Entry added") }} />}

      {/* Import Suppression Modal */}
      {showImportSuppression && <ImportSuppressionModal onClose={() => setShowImportSuppression(false)} onSaved={(count) => { setShowImportSuppression(false); fetchSuppression(); showToast(`Imported ${count} entries`) }} />}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: "var(--surface-elevated)", border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: "12px 20px", color: TEXT, fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", maxWidth: 420, animation: "slideUp 0.25s ease-out" }}>
          {toast}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MODALS
   ═══════════════════════════════════════════════ */

const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }
const modalCard: React.CSSProperties = { background: "var(--card-bg-solid)", border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" as const, animation: "slideUp 0.25s ease-out" }
const modalTitle: React.CSSProperties = { fontFamily: "'Bellfair', serif", fontSize: 22, color: TEXT, margin: 0, marginBottom: 20 }
const fieldLabel: React.CSSProperties = { fontSize: 11, color: TEXT3, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "block" }
const fieldGroup: React.CSSProperties = { marginBottom: 14 }

function AddDomainModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ domain: "", owner: "Andy", mailbox: "", provider: "google_workspace" })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.domain || !form.mailbox) return
    setSaving(true)
    const res = await fetch("/api/crm/outreach/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    if (res.ok) onSaved()
    setSaving(false)
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitle}>Add Domain</h2>
        <div style={fieldGroup}><label style={fieldLabel}>Domain</label><input style={inputStyle} value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="getoxen.com" /></div>
        <div style={fieldGroup}><label style={fieldLabel}>Mailbox</label><input style={inputStyle} value={form.mailbox} onChange={(e) => setForm({ ...form, mailbox: e.target.value })} placeholder="andy@getoxen.com" /></div>
        <div style={fieldGroup}><label style={fieldLabel}>Owner</label><select style={selectStyle} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}><option>Andy</option><option>Paul Louis</option></select></div>
        <div style={fieldGroup}><label style={fieldLabel}>Provider</label><select style={selectStyle} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}><option value="google_workspace">Google Workspace</option><option value="outlook">Outlook</option><option value="other">Other</option></select></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Add Domain"}</button>
        </div>
      </div>
    </div>
  )
}

function AddCampaignModal({ domains, onClose, onSaved }: { domains: OutreachDomain[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", vertical: "", owner: "Andy", domainId: "", platform: "lemlist", startDate: "" })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    const body = { ...form, domainId: form.domainId || null, startDate: form.startDate || null }
    const res = await fetch("/api/crm/outreach/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (res.ok) onSaved()
    setSaving(false)
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitle}>Add Campaign</h2>
        <div style={fieldGroup}><label style={fieldLabel}>Campaign Name</label><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Q2 FinTech Outreach" /></div>
        <div style={fieldGroup}><label style={fieldLabel}>Vertical</label><input style={inputStyle} value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} placeholder="FinTech/Crypto" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={fieldGroup}><label style={fieldLabel}>Owner</label><select style={selectStyle} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}><option>Andy</option><option>Paul Louis</option></select></div>
          <div style={fieldGroup}><label style={fieldLabel}>Domain</label><select style={selectStyle} value={form.domainId} onChange={(e) => setForm({ ...form, domainId: e.target.value })}><option value="">None</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={fieldGroup}><label style={fieldLabel}>Platform</label><select style={selectStyle} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}><option value="lemlist">Lemlist</option><option value="smartlead">Smartlead</option><option value="clay">Clay</option></select></div>
          <div style={fieldGroup}><label style={fieldLabel}>Start Date</label><input type="date" style={inputStyle} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Add Campaign"}</button>
        </div>
      </div>
    </div>
  )
}

function CampaignDetailModal({ campaign, onClose }: { campaign: OutreachCampaign; onClose: () => void }) {
  const c = campaign
  const openRate = c.totalSent > 0 ? (c.totalOpened / c.totalSent) * 100 : 0
  const replyRate = c.totalSent > 0 ? (c.totalReplied / c.totalSent) * 100 : 0
  const bounceRate = c.totalSent > 0 ? (c.totalBounced / c.totalSent) * 100 : 0
  const totalReplies = c.repliesInterested + c.repliesNotInterested + c.repliesOoo
  const iBar = totalReplies > 0 ? (c.repliesInterested / totalReplies) * 100 : 0
  const nBar = totalReplies > 0 ? (c.repliesNotInterested / totalReplies) * 100 : 0
  const oBar = totalReplies > 0 ? (c.repliesOoo / totalReplies) * 100 : 0

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalCard, maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ ...modalTitle, marginBottom: 0 }}>{c.name}</h2>
          <span style={statusBadge(c.status)}>{c.status}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 4, fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif" }}>
          <span>{c.owner}</span><span>&middot;</span><span>{c.vertical ?? "No vertical"}</span><span>&middot;</span><span>{c.domain?.domain ?? "No domain"}</span><span>&middot;</span><span>{c.platform}</span>
        </div>
        <div style={{ fontSize: 12, color: TEXT3, fontFamily: "'DM Sans', sans-serif", marginBottom: 20 }}>Started: {fmtDate(c.startDate)}</div>

        {/* Metrics Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Sent", value: c.totalSent, color: TEXT },
            { label: "Opened", value: `${openRate.toFixed(1)}%`, color: rateColor("open", openRate) },
            { label: "Replied", value: `${replyRate.toFixed(1)}%`, color: rateColor("reply", replyRate) },
            { label: "Bounced", value: `${bounceRate.toFixed(1)}%`, color: rateColor("bounce", bounceRate) },
            { label: "Clicked", value: c.totalClicked, color: TEXT },
            { label: "Unsubscribed", value: c.totalUnsubscribed, color: c.totalUnsubscribed > 0 ? "#F87171" : TEXT },
            { label: "Meetings", value: c.meetingsBooked, color: ROSE },
            { label: "Total Replies", value: c.totalReplied, color: TEXT },
          ].map((m) => (
            <div key={m.label} style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--surface-input)" }}>
              <div style={lbl}>{m.label}</div>
              <div style={{ ...val, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Reply Breakdown */}
        {totalReplies > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...lbl, marginBottom: 8 }}>Reply Breakdown</div>
            <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", background: "var(--surface-input)" }}>
              {iBar > 0 && <div style={{ width: `${iBar}%`, background: "#34D399", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 600 }}>{c.repliesInterested}</div>}
              {nBar > 0 && <div style={{ width: `${nBar}%`, background: "#F87171", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 600 }}>{c.repliesNotInterested}</div>}
              {oBar > 0 && <div style={{ width: `${oBar}%`, background: "#FBBF24", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 600 }}>{c.repliesOoo}</div>}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: "#34D399", fontFamily: "'DM Sans', sans-serif" }}>Interested ({c.repliesInterested})</span>
              <span style={{ fontSize: 11, color: "#F87171", fontFamily: "'DM Sans', sans-serif" }}>Not Interested ({c.repliesNotInterested})</span>
              <span style={{ fontSize: 11, color: "#FBBF24", fontFamily: "'DM Sans', sans-serif" }}>OOO ({c.repliesOoo})</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSecondary}>Close</button>
        </div>
      </div>
    </div>
  )
}

function AddSuppressionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ email: "", reason: "manual", source: "" })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.email) return
    setSaving(true)
    const res = await fetch("/api/crm/outreach/suppression", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    if (res.ok) onSaved()
    setSaving(false)
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitle}>Add to Suppression List</h2>
        <div style={fieldGroup}><label style={fieldLabel}>Email</label><input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
        <div style={fieldGroup}><label style={fieldLabel}>Reason</label><select style={selectStyle} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option value="manual">Manual</option><option value="unsubscribed">Unsubscribed</option><option value="bounced">Bounced</option><option value="do_not_contact">Do Not Contact</option><option value="spam_complaint">Spam Complaint</option></select></div>
        <div style={fieldGroup}><label style={fieldLabel}>Source</label><input style={inputStyle} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Lemlist, manual" /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Add"}</button>
        </div>
      </div>
    </div>
  )
}

function ImportSuppressionModal({ onClose, onSaved }: { onClose: () => void; onSaved: (count: number) => void }) {
  const [text, setText] = useState("")
  const [reason, setReason] = useState("manual")
  const [saving, setSaving] = useState(false)

  const handleImport = async () => {
    const emails = text.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes("@"))
    if (emails.length === 0) return
    setSaving(true)
    const res = await fetch("/api/crm/outreach/suppression/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails, reason, source: "csv_import" }) })
    if (res.ok) {
      const data = await res.json()
      onSaved(data.imported ?? emails.length)
    }
    setSaving(false)
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <h2 style={modalTitle}>Import Suppression List</h2>
        <div style={fieldGroup}><label style={fieldLabel}>Paste Emails (one per line, or comma-separated)</label><textarea style={{ ...inputStyle, height: 160, resize: "vertical" as const }} value={text} onChange={(e) => setText(e.target.value)} placeholder={"email1@example.com\nemail2@example.com"} /></div>
        <div style={fieldGroup}><label style={fieldLabel}>Reason for all</label><select style={selectStyle} value={reason} onChange={(e) => setReason(e.target.value)}><option value="manual">Manual</option><option value="unsubscribed">Unsubscribed</option><option value="bounced">Bounced</option><option value="do_not_contact">Do Not Contact</option><option value="spam_complaint">Spam Complaint</option></select></div>
        <div style={{ fontSize: 12, color: TEXT3, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
          {text.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes("@")).length} emails detected
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleImport} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? "Importing..." : "Import"}</button>
        </div>
      </div>
    </div>
  )
}
