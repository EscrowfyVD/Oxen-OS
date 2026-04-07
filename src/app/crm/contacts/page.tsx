"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  STAGE_COLORS, STAGE_LABELS, LIFECYCLE_STAGES,
  VERTICALS, GEO_ZONES, DEAL_OWNERS, CONTACT_TYPES,
  OWNER_COLORS, CRM_COLORS,
  OUTREACH_GROUPS, OUTREACH_GROUP_COLORS,
} from "@/lib/crm-config"
import CsvImportWizard from "@/components/crm/CsvImportWizard"
import KanbanBoard from "@/components/crm/KanbanBoard"
import type { KanbanContact } from "@/components/crm/KanbanBoard"

/* ── Design Tokens ── */
const BG = "#060709"
const CARD_BG = CRM_COLORS.card_bg
const CARD_BORDER = CRM_COLORS.card_border
const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const GLASS = { background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, backdropFilter: CRM_COLORS.glass_blur, WebkitBackdropFilter: CRM_COLORS.glass_blur, boxShadow: CRM_COLORS.glass_shadow }

/* ── Types ── */
interface CrmContact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  company: { id: string; name: string; website?: string | null } | null
  lifecycleStage: string
  contactType: string
  geoZone: string | null
  dealOwner: string | null
  vertical: string[]
  outreachGroup: string | null
  acquisitionSource: string | null
  acquisitionSourceDetail: string | null
  jobTitle: string | null
  lastInteraction: string | null
  totalInteractions: number
  createdAt: string
}

type ViewMode = "list" | "kanban"

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/* ── Sort State ── */
type SortField = "firstName" | "company" | "email" | "lifecycleStage" | "contactType" | "geoZone" | "dealOwner" | "lastInteraction" | "totalInteractions" | "createdAt"

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

/* ── Badge ── */
function Badge({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", fontSize: 10, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", borderRadius: 16, background: bg || `${color}18`, color, letterSpacing: 0.2, whiteSpace: "nowrap" }}>
      {label}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════
   CONTACT LIST PAGE
   ════════════════════════════════════════════════════════════════ */
export default function ContactListPage() {
  const router = useRouter()

  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [showImportWizard, setShowImportWizard] = useState(false)

  // View mode (persisted in localStorage)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("crm_contacts_view") as ViewMode) || "list"
    }
    return "list"
  })

  const switchView = (mode: ViewMode) => {
    setViewMode(mode)
    if (typeof window !== "undefined") localStorage.setItem("crm_contacts_view", mode)
  }

  // For kanban state
  const [kanbanContacts, setKanbanContacts] = useState<KanbanContact[]>([])
  const [kanbanLoading, setKanbanLoading] = useState(false)

  // Filters
  const [search, setSearch] = useState("")
  const [outreachGroup, setOutreachGroup] = useState("all")
  const [lifecycleStage, setLifecycleStage] = useState("all")
  const [dealOwner, setDealOwner] = useState("all")
  const [vertical, setVertical] = useState("all")
  const [geoZone, setGeoZone] = useState("all")
  const [contactType, setContactType] = useState("all")

  // Sort
  const [sortBy, setSortBy] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const fetchContacts = useCallback(async (page = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "50")
    params.set("sortBy", sortBy)
    params.set("sortDir", sortDir)
    if (search) params.set("q", search)
    if (outreachGroup !== "all") params.set("outreachGroup", outreachGroup)
    if (lifecycleStage !== "all") params.set("lifecycleStage", lifecycleStage)
    if (dealOwner !== "all") params.set("dealOwner", dealOwner)
    if (vertical !== "all") params.set("vertical", vertical)
    if (geoZone !== "all") params.set("geoZone", geoZone)
    if (contactType !== "all") params.set("contactType", contactType)

    try {
      const res = await fetch(`/api/crm/contacts?${params.toString()}`)
      const data = await res.json()
      setContacts(data.contacts ?? [])
      setPagination(data.pagination ?? { page: 1, limit: 50, total: 0, totalPages: 1 })
    } catch { /* ignore */ }
    setLoading(false)
  }, [search, outreachGroup, lifecycleStage, dealOwner, vertical, geoZone, contactType, sortBy, sortDir])

  const fetchKanbanContacts = useCallback(async () => {
    setKanbanLoading(true)
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("limit", "500")
    if (search) params.set("q", search)
    if (outreachGroup !== "all") params.set("outreachGroup", outreachGroup)
    if (lifecycleStage !== "all") params.set("lifecycleStage", lifecycleStage)
    if (dealOwner !== "all") params.set("dealOwner", dealOwner)
    if (vertical !== "all") params.set("vertical", vertical)
    if (geoZone !== "all") params.set("geoZone", geoZone)
    if (contactType !== "all") params.set("contactType", contactType)

    try {
      const res = await fetch(`/api/crm/contacts?${params.toString()}`)
      const data = await res.json()
      setKanbanContacts(data.contacts ?? [])
      setPagination(data.pagination ?? { page: 1, limit: 500, total: 0, totalPages: 1 })
    } catch { /* ignore */ }
    setKanbanLoading(false)
  }, [search, outreachGroup, lifecycleStage, dealOwner, vertical, geoZone, contactType])

  useEffect(() => {
    if (viewMode === "list") fetchContacts(1)
    else fetchKanbanContacts()
  }, [fetchContacts, fetchKanbanContacts, viewMode])

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortDir("asc")
    }
  }

  const sortArrow = (field: SortField) => {
    if (sortBy !== field) return ""
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  const handleKanbanStageChange = async (contactId: string, newStage: string) => {
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifecycleStage: newStage }),
      })
      if (res.ok) {
        // Refresh kanban data
        fetchKanbanContacts()
      }
    } catch { /* ignore */ }
  }

  const selectStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 8,
    color: TEXT2,
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    minWidth: 100,
  }

  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: 10,
    color: TEXT3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    borderBottom: `1px solid ${CARD_BORDER}`,
  }

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    borderBottom: `1px solid ${CARD_BORDER}`,
    color: TEXT,
  }

  return (
    <div className="page-content" style={{ padding: 0, background: BG, minHeight: "100vh" }}>
      {/* ════ HEADER ════ */}
      <div style={{ padding: "16px 32px", borderBottom: `1px solid ${CARD_BORDER}`, background: "rgba(6,7,9,0.88)", backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 32, fontWeight: 400, color: "#fff", margin: 0, lineHeight: 1.2 }}>Contacts</h1>
              <p style={{ fontSize: 12, color: TEXT3, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                {pagination.total} contact{pagination.total !== 1 ? "s" : ""} in database
              </p>
            </div>
            {/* View Toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3, marginLeft: 8 }}>
              <button
                onClick={() => switchView("list")}
                style={{ padding: "6px 14px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, border: "none", borderRadius: 6, cursor: "pointer", transition: "all 0.15s", background: viewMode === "list" ? `${ROSE}22` : "transparent", color: viewMode === "list" ? TEXT : TEXT3, display: "flex", alignItems: "center", gap: 5 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                List
              </button>
              <button
                onClick={() => switchView("kanban")}
                style={{ padding: "6px 14px", fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, border: "none", borderRadius: 6, cursor: "pointer", transition: "all 0.15s", background: viewMode === "kanban" ? `${ROSE}22` : "transparent", color: viewMode === "kanban" ? TEXT : TEXT3, display: "flex", alignItems: "center", gap: 5 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="16" rx="1"/></svg>
                Kanban
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={async () => {
                const params = new URLSearchParams()
                if (search) params.set("q", search)
                if (outreachGroup !== "all") params.set("outreachGroup", outreachGroup)
                if (lifecycleStage !== "all") params.set("lifecycleStage", lifecycleStage)
                if (dealOwner !== "all") params.set("dealOwner", dealOwner)
                if (vertical !== "all") params.set("vertical", vertical)
                if (geoZone !== "all") params.set("geoZone", geoZone)
                if (contactType !== "all") params.set("contactType", contactType)
                const res = await fetch(`/api/crm/contacts/export?${params}`)
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `crm-contacts-${new Date().toISOString().slice(0, 10)}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
              style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.06)", color: TEXT2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            <button
              onClick={() => setShowImportWizard(true)}
              style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.06)", color: TEXT2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import CSV
            </button>
            <button onClick={() => router.push("/crm?tab=clients")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              + New Contact
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search name, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 220px", background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, color: TEXT, padding: "7px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", minWidth: 200 }}
          />
          <select value={outreachGroup} onChange={(e) => setOutreachGroup(e.target.value)} style={selectStyle}>
            <option value="all">All Groups</option>
            {OUTREACH_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.short}</option>)}
          </select>
          <select value={lifecycleStage} onChange={(e) => setLifecycleStage(e.target.value)} style={selectStyle}>
            <option value="all">All Stages</option>
            {LIFECYCLE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s] || s}</option>)}
          </select>
          <select value={dealOwner} onChange={(e) => setDealOwner(e.target.value)} style={selectStyle}>
            <option value="all">All Owners</option>
            {DEAL_OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={vertical} onChange={(e) => setVertical(e.target.value)} style={selectStyle}>
            <option value="all">All Verticals</option>
            {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={geoZone} onChange={(e) => setGeoZone(e.target.value)} style={selectStyle}>
            <option value="all">All Geos</option>
            {GEO_ZONES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={contactType} onChange={(e) => setContactType(e.target.value)} style={selectStyle}>
            <option value="all">All Types</option>
            {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {/* ════ CONTENT ════ */}
      {viewMode === "list" ? (
        <div style={{ padding: "20px 32px" }}>
          <div style={{ ...GLASS, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle} onClick={() => handleSort("firstName")}>Name{sortArrow("firstName")}</th>
                    <th style={thStyle}>Group</th>
                    <th style={thStyle} onClick={() => handleSort("company")}>Company{sortArrow("company")}</th>
                    <th style={thStyle} onClick={() => handleSort("email")}>Email{sortArrow("email")}</th>
                    <th style={thStyle} onClick={() => handleSort("lifecycleStage")}>Stage{sortArrow("lifecycleStage")}</th>
                    <th style={thStyle} onClick={() => handleSort("contactType")}>Type{sortArrow("contactType")}</th>
                    <th style={thStyle} onClick={() => handleSort("geoZone")}>Geo{sortArrow("geoZone")}</th>
                    <th style={thStyle} onClick={() => handleSort("dealOwner")}>Owner{sortArrow("dealOwner")}</th>
                    <th style={thStyle} onClick={() => handleSort("lastInteraction")}>Last Contact{sortArrow("lastInteraction")}</th>
                    <th style={thStyle} onClick={() => handleSort("totalInteractions")}>Interactions{sortArrow("totalInteractions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && contacts.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: "40px 12px", color: TEXT3 }}>Loading...</td>
                    </tr>
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: "40px 12px", color: TEXT3 }}>No contacts found</td>
                    </tr>
                  ) : (
                    contacts.map((c) => {
                      const stageColor = STAGE_COLORS[c.lifecycleStage] || "#9CA3AF"
                      const stageLabel = STAGE_LABELS[c.lifecycleStage] || c.lifecycleStage || "—"
                      const ownerColor = OWNER_COLORS[c.dealOwner || ""] || "#9CA3AF"
                      const groupObj = c.outreachGroup ? OUTREACH_GROUPS.find((g) => g.id === c.outreachGroup) : null
                      return (
                        <tr
                          key={c.id}
                          onClick={() => router.push(`/crm/contacts/${c.id}`)}
                          style={{ cursor: "pointer", transition: "background 0.15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</div>
                          </td>
                          <td style={tdStyle}>
                            {groupObj ? (
                              <Badge label={groupObj.short} color={groupObj.color} />
                            ) : <span style={{ fontSize: 11, color: TEXT3 }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, color: TEXT2 }}>{c.company?.name || "—"}</td>
                          <td style={{ ...tdStyle, color: TEXT2, fontSize: 12 }}>{c.email || "—"}</td>
                          <td style={tdStyle}><Badge label={stageLabel} color={stageColor} /></td>
                          <td style={tdStyle}>
                            {c.contactType ? (
                              <Badge label={c.contactType} color="#A78BFA" bg="rgba(167,139,250,0.12)" />
                            ) : "—"}
                          </td>
                          <td style={{ ...tdStyle, color: TEXT2, fontSize: 12 }}>{c.geoZone || "—"}</td>
                          <td style={tdStyle}>
                            {c.dealOwner ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 18, height: 18, borderRadius: "50%", background: ownerColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                  {c.dealOwner.charAt(0)}
                                </div>
                                <span style={{ fontSize: 12, color: TEXT2 }}>{c.dealOwner}</span>
                              </div>
                            ) : "—"}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: TEXT2 }}>{relativeTime(c.lastInteraction)}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <span style={{ fontFamily: "'Bellfair', serif", fontSize: 14, color: TEXT }}>{c.totalInteractions}</span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: "14px 0", borderTop: `1px solid ${CARD_BORDER}` }}>
                <button
                  onClick={() => fetchContacts(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: pagination.page <= 1 ? TEXT3 : TEXT2, fontSize: 12, cursor: pagination.page <= 1 ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 12, color: TEXT2, fontFamily: "'DM Sans', sans-serif" }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchContacts(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: pagination.page >= pagination.totalPages ? TEXT3 : TEXT2, fontSize: 12, cursor: pagination.page >= pagination.totalPages ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <KanbanBoard
          contacts={kanbanContacts}
          loading={kanbanLoading}
          onStageChange={handleKanbanStageChange}
        />
      )}

      {/* CSV Import Wizard Modal */}
      {showImportWizard && (
        <CsvImportWizard
          onClose={() => setShowImportWizard(false)}
          onComplete={() => fetchContacts(1)}
        />
      )}
    </div>
  )
}
