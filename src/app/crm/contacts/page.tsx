"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  STAGE_LABELS, LIFECYCLE_STAGES,
  VERTICALS, GEO_ZONES, DEAL_OWNERS, CONTACT_TYPES,
  CRM_COLORS,
  OUTREACH_GROUPS,
} from "@/lib/crm-config"
import CsvImportWizard from "@/components/crm/CsvImportWizard"
import KanbanBoard from "@/components/crm/KanbanBoard"
import type { KanbanContact } from "@/components/crm/KanbanBoard"
import ContactSlideOver from "@/components/crm/ContactSlideOver"
import InlineEditableTable from "@/components/crm/InlineEditableTable"
import type { TableContact } from "@/components/crm/InlineEditableTable"
import PushToLemlistModal from "@/components/crm/PushToLemlistModal"

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
interface CrmContact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  jobTitle: string | null
  company: { id: string; name: string; website?: string | null } | null
  companyId: string | null
  lifecycleStage: string
  contactType: string
  geoZone: string | null
  dealOwner: string | null
  vertical: string[]
  subVertical: string[]
  outreachGroup: string | null
  acquisitionSource: string | null
  acquisitionSourceDetail: string | null
  lastInteraction: string | null
  totalInteractions: number
  city: string | null
  country: string | null
  icpFit: string | null
  relationshipStrength: string | null
  lemlistCampaignId: string | null
  lemlistCampaignName: string | null
  lemlistStatus: string | null
  lemlistStep: number | null
  lemlistTotalSteps: number | null
  lemlistEnrolledAt: string | null
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

/* ════════════════════════════════════════════════════════════════
   CONTACT LIST PAGE
   ════════════════════════════════════════════════════════════════ */
export default function ContactListPage() {
  const router = useRouter()

  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [lemlistContacts, setLemlistContacts] = useState<TableContact[] | null>(null)
  const [lemlistMode, setLemlistMode] = useState<"selected" | "all">("selected")
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

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
  const [lemlistCampaign, setLemlistCampaign] = useState("all")
  const [lemlistCampaigns, setLemlistCampaigns] = useState<string[]>([])

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
    if (lemlistCampaign !== "all") params.set("lemlistCampaign", lemlistCampaign)

    try {
      const res = await fetch(`/api/crm/contacts?${params.toString()}`)
      const data = await res.json()
      setContacts(data.contacts ?? [])
      setPagination(data.pagination ?? { page: 1, limit: 50, total: 0, totalPages: 1 })
    } catch { /* ignore */ }
    setLoading(false)
  }, [search, outreachGroup, lifecycleStage, dealOwner, vertical, geoZone, contactType, lemlistCampaign, sortBy, sortDir])

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
    if (lemlistCampaign !== "all") params.set("lemlistCampaign", lemlistCampaign)

    try {
      const res = await fetch(`/api/crm/contacts?${params.toString()}`)
      const data = await res.json()
      setKanbanContacts(data.contacts ?? [])
      setPagination(data.pagination ?? { page: 1, limit: 500, total: 0, totalPages: 1 })
    } catch { /* ignore */ }
    setKanbanLoading(false)
  }, [search, outreachGroup, lifecycleStage, dealOwner, vertical, geoZone, contactType, lemlistCampaign])

  // Fetch distinct Lemlist campaign names for filter dropdown
  useEffect(() => {
    fetch("/api/lemlist/campaigns")
      .then(r => r.ok ? r.json() : [])
      .then((campaigns: { _id: string; name: string }[]) => {
        setLemlistCampaigns(campaigns.map(c => c.name).filter(Boolean))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (viewMode === "list") fetchContacts(1)
    else fetchKanbanContacts()
  }, [fetchContacts, fetchKanbanContacts, viewMode])

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

  /* ═══ Inline table callbacks ═══ */
  const handleCellSave = useCallback(async (contactId: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        // Optimistic update
        const updated = await res.json()
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...updated.contact } : c))
        return true
      }
      return false
    } catch { return false }
  }, [])

  const handleCreateContact = useCallback(async (data: Record<string, unknown>): Promise<string | null> => {
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        fetchContacts(pagination.page)
        return ((await res.json()).contact?.id) || null
      }
      return null
    } catch { return null }
  }, [fetchContacts, pagination.page])

  const handleDeleteContacts = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      const results = await Promise.all(ids.map(id => fetch(`/api/crm/contacts/${id}`, { method: "DELETE" })))
      const ok = results.every(r => r.ok)
      if (ok) fetchContacts(pagination.page)
      return ok
    } catch { return false }
  }, [fetchContacts, pagination.page])

  const handleBulkUpdate = useCallback(async (ids: string[], data: Record<string, unknown>): Promise<boolean> => {
    try {
      const results = await Promise.all(ids.map(id =>
        fetch(`/api/crm/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      ))
      const ok = results.every(r => r.ok)
      if (ok) fetchContacts(pagination.page)
      return ok
    } catch { return false }
  }, [fetchContacts, pagination.page])

  const handleSyncLemlist = useCallback(async () => {
    setSyncing(true)
    setToast(null)
    try {
      const res = await fetch("/api/lemlist/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setToast(`Synced ${data.synced} contacts from ${data.campaigns} campaigns. ${data.notFound} contacts not found in CRM.`)
        if (viewMode === "list") fetchContacts(pagination.page)
        else fetchKanbanContacts()
      } else {
        setToast(`Sync failed: ${data.error || "Unknown error"}`)
      }
    } catch {
      setToast("Sync failed: network error")
    }
    setSyncing(false)
    setTimeout(() => setToast(null), 8000)
  }, [fetchContacts, fetchKanbanContacts, pagination.page, viewMode])

  const selectStyle: React.CSSProperties = {
    background: "var(--surface-input)",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 8,
    color: TEXT2,
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    minWidth: 100,
  }

  return (
    <div className="page-content" style={{ padding: 0, background: BG, minHeight: "100vh" }}>
      {/* ════ HEADER ════ */}
      <div style={{ padding: "16px 32px", borderBottom: `1px solid ${CARD_BORDER}`, background: "var(--header-bg)", backdropFilter: "blur(24px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 32, fontWeight: 400, color: "var(--text-primary)", margin: 0, lineHeight: 1.2 }}>Contacts</h1>
              <p style={{ fontSize: 12, color: TEXT3, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
                {pagination.total} contact{pagination.total !== 1 ? "s" : ""} in database
              </p>
            </div>
            {/* View Toggle */}
            <div style={{ display: "flex", background: "var(--surface-elevated)", borderRadius: 8, padding: 3, marginLeft: 8 }}>
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
                if (lemlistCampaign !== "all") params.set("lemlistCampaign", lemlistCampaign)
                const res = await fetch(`/api/crm/contacts/export?${params}`)
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `crm-contacts-${new Date().toISOString().slice(0, 10)}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
              style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "var(--surface-input)", color: TEXT2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            <button
              onClick={() => setShowImportWizard(true)}
              style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "var(--surface-input)", color: TEXT2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import
            </button>
            <button
              onClick={() => {
                setLemlistContacts(contacts as unknown as TableContact[])
                setLemlistMode("all")
              }}
              style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "var(--surface-input)", color: TEXT2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Push to Lemlist
            </button>
            <button
              onClick={handleSyncLemlist}
              disabled={syncing}
              style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "var(--surface-input)", color: TEXT2, fontSize: 13, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6, opacity: syncing ? 0.6 : 1 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={syncing ? { animation: "spin 1s linear infinite" } : undefined}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              {syncing ? "Syncing..." : "Sync Lemlist"}
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
            style={{ flex: "1 1 220px", background: "var(--surface-input)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8, color: TEXT, padding: "7px 12px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", minWidth: 200 }}
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
          <select value={lemlistCampaign} onChange={(e) => setLemlistCampaign(e.target.value)} style={selectStyle}>
            <option value="all">All Campaigns</option>
            <option value="not_enrolled">Not Enrolled</option>
            <option value="completed">Completed</option>
            {lemlistCampaigns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ════ CONTENT ════ */}
      {viewMode === "list" ? (
        <div style={{ padding: "20px 32px" }}>
          <div style={{ ...GLASS, overflow: "hidden" }}>
            <InlineEditableTable
              contacts={contacts as unknown as TableContact[]}
              loading={loading}
              pagination={pagination}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={(field, dir) => { setSortBy(field as SortField); setSortDir(dir) }}
              onPageChange={(page) => fetchContacts(page)}
              onCellSave={handleCellSave}
              onCreateContact={handleCreateContact}
              onDeleteContacts={handleDeleteContacts}
              onBulkUpdate={handleBulkUpdate}
              onContactClick={(id) => setSelectedContactId(id)}
              onPushToLemlist={(selected) => {
                setLemlistContacts(selected)
                setLemlistMode("selected")
              }}
            />
          </div>
        </div>
      ) : (
        <KanbanBoard
          contacts={kanbanContacts}
          loading={kanbanLoading}
          onStageChange={handleKanbanStageChange}
          onContactClick={(id) => setSelectedContactId(id)}
        />
      )}

      {/* CSV Import Wizard Modal */}
      {showImportWizard && (
        <CsvImportWizard
          onClose={() => setShowImportWizard(false)}
          onComplete={() => fetchContacts(1)}
        />
      )}

      {/* Push to Lemlist Modal */}
      {lemlistContacts && (
        <PushToLemlistModal
          contacts={lemlistContacts}
          mode={lemlistMode}
          totalFilteredCount={lemlistMode === "all" ? pagination.total : undefined}
          onClose={() => setLemlistContacts(null)}
          onComplete={() => fetchContacts(pagination.page)}
        />
      )}

      {/* Contact Slide-Over Panel */}
      <ContactSlideOver
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
        onContactUpdated={() => {
          if (viewMode === "list") fetchContacts(pagination.page)
          else fetchKanbanContacts()
        }}
      />

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: "var(--surface-elevated)", border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: "12px 20px", color: TEXT, fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", maxWidth: 420, animation: "slideUp 0.25s ease-out" }}>
          {toast}
        </div>
      )}
    </div>
  )
}
