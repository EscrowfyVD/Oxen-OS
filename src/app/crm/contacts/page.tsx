"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  STAGE_COLORS, STAGE_LABELS, LIFECYCLE_STAGES,
  VERTICALS, GEO_ZONES, DEAL_OWNERS, CONTACT_TYPES,
  OWNER_COLORS, CRM_COLORS,
} from "@/lib/crm-config"

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
  lastInteraction: string | null
  totalInteractions: number
  createdAt: string
}

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

  // Filters
  const [search, setSearch] = useState("")
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
  }, [search, lifecycleStage, dealOwner, vertical, geoZone, contactType, sortBy, sortDir])

  useEffect(() => { fetchContacts(1) }, [fetchContacts])

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
          <div>
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 32, fontWeight: 400, color: "#fff", margin: 0, lineHeight: 1.2 }}>Contacts</h1>
            <p style={{ fontSize: 12, color: TEXT3, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
              {pagination.total} contact{pagination.total !== 1 ? "s" : ""} in database
            </p>
          </div>
          <button onClick={() => router.push("/crm?tab=clients")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            + New Contact
          </button>
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

      {/* ════ TABLE ════ */}
      <div style={{ padding: "20px 32px" }}>
        <div style={{ ...GLASS, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle} onClick={() => handleSort("firstName")}>Name{sortArrow("firstName")}</th>
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
                    <td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: "40px 12px", color: TEXT3 }}>Loading...</td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: "40px 12px", color: TEXT3 }}>No contacts found</td>
                  </tr>
                ) : (
                  contacts.map((c) => {
                    const stageColor = STAGE_COLORS[c.lifecycleStage] || "#9CA3AF"
                    const stageLabel = STAGE_LABELS[c.lifecycleStage] || c.lifecycleStage || "—"
                    const ownerColor = OWNER_COLORS[c.dealOwner || ""] || "#9CA3AF"
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
    </div>
  )
}
