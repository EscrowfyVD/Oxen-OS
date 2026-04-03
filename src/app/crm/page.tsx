"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import PipelineView from "@/components/crm/PipelineView"
import TableView from "@/components/crm/TableView"
import CardView from "@/components/crm/CardView"
import ContactModal from "@/components/crm/ContactModal"
import DealModal from "@/components/crm/DealModal"
import type { Contact, Employee } from "@/components/crm/types"
import type { PipelineDeal } from "@/components/crm/PipelineView"
import {
  PIPELINE_STAGES,
  STAGE_PROBABILITY,
  STAGE_LABELS,
  VERTICALS,
  ACQUISITION_SOURCES,
  GEO_ZONES,
  DEAL_OWNERS,
  LOST_REASONS,
  fmtCurrencyFull,
  CRM_COLORS,
} from "@/lib/crm-config"

/* ── Design tokens ── */
const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"

type ViewMode = "kanban" | "table" | "cards"
type SubNav = "pipeline" | "contacts" | "companies" | "reports"

/* ── Filter state shape ── */
interface Filters {
  owner: string
  verticals: string[]
  source: string
  geo: string
  search: string
}

export default function CrmPage() {
  /* ── Access control ── */
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  /* ── Core data ── */
  const [deals, setDeals] = useState<PipelineDeal[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  /* ── UI state ── */
  const [viewMode, setViewMode] = useState<ViewMode>("kanban")
  const [subNav, setSubNav] = useState<SubNav>("pipeline")
  const [filters, setFilters] = useState<Filters>({
    owner: "All",
    verticals: [],
    source: "All",
    geo: "All",
    search: "",
  })

  /* ── Modals ── */
  const [showContactModal, setShowContactModal] = useState(false)
  const [showDealModal, setShowDealModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  /* ── Lost-deal modal ── */
  const [lostDeal, setLostDeal] = useState<PipelineDeal | null>(null)
  const [lostReason, setLostReason] = useState("")
  const [lostNotes, setLostNotes] = useState("")

  /* ── Vertical dropdown ── */
  const [verticalDropdownOpen, setVerticalDropdownOpen] = useState(false)
  const verticalDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (verticalDropdownRef.current && !verticalDropdownRef.current.contains(e.target as Node)) {
        setVerticalDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  /* ── Access check ── */
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        const dept = (data.employee?.department ?? "").toLowerCase()
        setHasAccess(dept !== "compliance")
        setAccessChecked(true)
      })
      .catch(() => setAccessChecked(true))
  }, [])

  /* ── Fetchers ── */
  const fetchDeals = useCallback(() => {
    fetch("/api/crm/deals")
      .then((r) => r.json())
      .then((data) => setDeals(data.deals ?? []))
      .catch(() => {})
  }, [])

  const fetchContacts = useCallback(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => {})
  }, [])

  const fetchEmployees = useCallback(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!hasAccess) return
    fetchDeals()
    fetchContacts()
    fetchEmployees()
  }, [hasAccess, fetchDeals, fetchContacts, fetchEmployees])

  /* ── Filtered deals ── */
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (filters.owner !== "All" && d.dealOwner !== filters.owner) return false
      if (filters.verticals.length > 0) {
        const hasMatch = filters.verticals.some((v) => d.vertical?.includes(v))
        if (!hasMatch) return false
      }
      if (filters.source !== "All" && d.acquisitionSource !== filters.source) return false
      if (filters.geo !== "All") {
        // Geo filter based on company or contact data — for now check deal's contact geoZone
        // Since deals don't carry geoZone directly, we skip if not "All"
        // This would require join data; for now we allow all
      }
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const contactName = d.contact
          ? `${d.contact.firstName} ${d.contact.lastName}`.toLowerCase()
          : d.dealName.toLowerCase()
        const companyName = (d.company?.name ?? "").toLowerCase()
        if (!contactName.includes(q) && !companyName.includes(q) && !d.dealName.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [deals, filters])

  /* ── Pipeline totals ── */
  const pipelineTotal = useMemo(() => {
    const activeDeals = filteredDeals.filter(
      (d) => d.stage !== "closed_won" && d.stage !== "closed_lost"
    )
    const total = activeDeals.reduce((sum, d) => sum + (d.dealValue ?? 0), 0)
    const weighted = activeDeals.reduce((sum, d) => sum + (d.weightedValue ?? 0), 0)
    return { total, weighted }
  }, [filteredDeals])

  /* ── Stage change handler ── */
  const handleStageChange = useCallback(
    async (dealId: string, newStage: string) => {
      const prob = STAGE_PROBABILITY[newStage] ?? 0.05
      try {
        await fetch(`/api/crm/deals/${dealId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: newStage, winProbability: prob }),
        })
        fetchDeals()
      } catch {
        // silent fail
      }
    },
    [fetchDeals]
  )

  const handleStageWon = useCallback(
    async (deal: PipelineDeal) => {
      try {
        await fetch(`/api/crm/deals/${deal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage: "closed_won",
            winProbability: 1.0,
            closedAt: new Date().toISOString(),
          }),
        })
        fetchDeals()
      } catch {
        // silent
      }
    },
    [fetchDeals]
  )

  const handleStageLost = useCallback((deal: PipelineDeal) => {
    setLostDeal(deal)
    setLostReason("")
    setLostNotes("")
  }, [])

  const confirmLostDeal = useCallback(async () => {
    if (!lostDeal || !lostReason) return
    try {
      await fetch(`/api/crm/deals/${lostDeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "closed_lost",
          winProbability: 0,
          lostReason,
          lostNotes: lostNotes || null,
          closedAt: new Date().toISOString(),
        }),
      })
      setLostDeal(null)
      fetchDeals()
    } catch {
      // silent
    }
  }, [lostDeal, lostReason, lostNotes, fetchDeals])

  const handleDealClick = useCallback((deal: PipelineDeal) => {
    // Navigate to deal detail or open modal
    window.location.href = `/crm/${deal.id}`
  }, [])

  /* ── Modal handlers ── */
  const openNewContact = () => {
    setEditingContact(null)
    setShowContactModal(true)
  }

  const openNewDeal = () => {
    setShowDealModal(true)
  }

  const handleContactSaved = (_data?: unknown) => {
    setShowContactModal(false)
    setEditingContact(null)
    fetchContacts()
    fetchDeals()
  }

  const handleDealSaved = (_data?: unknown) => {
    setShowDealModal(false)
    fetchDeals()
  }

  /* ── Guard renders ── */
  if (!accessChecked) return null
  if (!hasAccess) {
    return (
      <div style={{ padding: "80px 32px", textAlign: "center" }}>
        <h2 style={{ color: TEXT_PRIMARY, fontSize: 20, marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: TEXT_SECONDARY, fontSize: 14 }}>
          Compliance department does not have access to CRM.
        </p>
      </div>
    )
  }

  /* ── Shared styles ── */
  const pillBtn = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    fontSize: 11,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 600,
    border: "none",
    borderRadius: 20,
    cursor: "pointer",
    transition: "all 0.15s ease",
    background: active ? ROSE_GOLD : "rgba(255,255,255,0.06)",
    color: active ? "#060709" : TEXT_SECONDARY,
  })

  const selectStyle: React.CSSProperties = {
    padding: "7px 12px",
    fontSize: 11,
    fontFamily: "'DM Sans', sans-serif",
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 8,
    color: TEXT_PRIMARY,
    outline: "none",
    cursor: "pointer",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 28,
  }

  const inputStyle: React.CSSProperties = {
    padding: "7px 12px",
    fontSize: 11,
    fontFamily: "'DM Sans', sans-serif",
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 8,
    color: TEXT_PRIMARY,
    outline: "none",
    width: 180,
  }

  return (
    <div className="page-content" style={{ padding: 0, minHeight: "100vh" }}>
      {/* ══════════ STICKY HEADER ══════════ */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(6,7,9,0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${CARD_BORDER}`,
        }}
      >
        {/* Row 1: title + sub-nav + actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 32px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {/* Title block */}
            <div>
              <h1
                style={{
                  fontFamily: "'Bellfair', serif",
                  fontSize: 32,
                  fontWeight: 400,
                  color: "#FFFFFF",
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                CRM
              </h1>
              <p
                style={{
                  fontSize: 12,
                  color: TEXT_TERTIARY,
                  marginTop: 4,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Pipeline: {fmtCurrencyFull(pipelineTotal.total)} (weighted:{" "}
                {fmtCurrencyFull(pipelineTotal.weighted)})
              </p>
            </div>

            {/* Sub-navigation tabs */}
            <div
              style={{
                display: "flex",
                gap: 2,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 8,
                padding: 3,
              }}
            >
              {(
                [
                  { id: "pipeline", label: "Pipeline" },
                  { id: "contacts", label: "Contacts" },
                  { id: "companies", label: "Companies" },
                  { id: "reports", label: "Reports" },
                ] as { id: SubNav; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSubNav(tab.id)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 11,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    letterSpacing: 0.3,
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    background:
                      subNav === tab.id ? "rgba(192,139,136,0.15)" : "transparent",
                    color: subNav === tab.id ? TEXT_PRIMARY : TEXT_SECONDARY,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={openNewDeal}
              style={{
                padding: "8px 18px",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                background: ROSE_GOLD,
                color: "#060709",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              + New Deal
            </button>
            <button
              onClick={openNewContact}
              style={{
                padding: "8px 18px",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                background: "rgba(255,255,255,0.08)",
                color: TEXT_PRIMARY,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.12)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)"
              }}
            >
              + New Contact
            </button>
          </div>
        </div>

        {/* Row 2: View toggle + Filter bar */}
        {subNav === "pipeline" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 32px 14px",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {/* Left: view mode toggle */}
            <div style={{ display: "flex", gap: 4 }}>
              {(
                [
                  { id: "kanban", label: "Kanban" },
                  { id: "table", label: "Table" },
                  { id: "cards", label: "Cards" },
                ] as { id: ViewMode; label: string }[]
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  style={pillBtn(viewMode === mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Right: filters */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {/* Owner toggles */}
              <div style={{ display: "flex", gap: 3 }}>
                {["All", ...DEAL_OWNERS].map((owner) => (
                  <button
                    key={owner}
                    onClick={() =>
                      setFilters((f) => ({ ...f, owner }))
                    }
                    style={{
                      padding: "5px 12px",
                      fontSize: 10,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 600,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      background:
                        filters.owner === owner
                          ? "rgba(192,139,136,0.2)"
                          : "rgba(255,255,255,0.04)",
                      color:
                        filters.owner === owner ? ROSE_GOLD : TEXT_TERTIARY,
                    }}
                  >
                    {owner}
                  </button>
                ))}
              </div>

              {/* Vertical multi-select dropdown */}
              <div ref={verticalDropdownRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setVerticalDropdownOpen((v) => !v)}
                  style={{
                    ...selectStyle,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 120,
                  }}
                >
                  <span>
                    {filters.verticals.length === 0
                      ? "All Verticals"
                      : `${filters.verticals.length} vertical${filters.verticals.length > 1 ? "s" : ""}`}
                  </span>
                </button>
                {verticalDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      background: "#0F1118",
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: 10,
                      padding: 6,
                      zIndex: 200,
                      minWidth: 200,
                      maxHeight: 280,
                      overflowY: "auto",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}
                  >
                    {VERTICALS.map((v) => {
                      const selected = filters.verticals.includes(v)
                      return (
                        <label
                          key={v}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 11,
                            color: selected ? TEXT_PRIMARY : TEXT_SECONDARY,
                            fontFamily: "'DM Sans', sans-serif",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.06)"
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              setFilters((f) => ({
                                ...f,
                                verticals: selected
                                  ? f.verticals.filter((x) => x !== v)
                                  : [...f.verticals, v],
                              }))
                            }}
                            style={{
                              accentColor: ROSE_GOLD,
                              width: 14,
                              height: 14,
                            }}
                          />
                          {v}
                        </label>
                      )
                    })}
                    {filters.verticals.length > 0 && (
                      <button
                        onClick={() => setFilters((f) => ({ ...f, verticals: [] }))}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          marginTop: 4,
                          fontSize: 10,
                          fontFamily: "'DM Sans', sans-serif",
                          color: ROSE_GOLD,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Source dropdown */}
              <select
                value={filters.source}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, source: e.target.value }))
                }
                style={selectStyle}
              >
                <option value="All">All Sources</option>
                {ACQUISITION_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Geo zone dropdown */}
              <select
                value={filters.geo}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, geo: e.target.value }))
                }
                style={selectStyle}
              >
                <option value="All">All Geos</option>
                {GEO_ZONES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              {/* Search input */}
              <input
                type="text"
                placeholder="Search deals..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </div>

      {/* ══════════ CONTENT AREA ══════════ */}
      <div style={{ padding: "24px 32px" }}>
        {subNav === "pipeline" && (
          <>
            {viewMode === "kanban" && (
              <PipelineView
                deals={filteredDeals}
                onDealClick={handleDealClick}
                onStageChange={handleStageChange}
                onStageWon={handleStageWon}
                onStageLost={handleStageLost}
              />
            )}
            {viewMode === "table" && (
              <TableView
                deals={filteredDeals}
                onDealClick={handleDealClick}
              />
            )}
            {viewMode === "cards" && (
              <CardView
                deals={filteredDeals}
                onDealClick={handleDealClick}
              />
            )}
          </>
        )}

        {subNav === "contacts" && (
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 14,
              padding: "40px 20px",
              textAlign: "center",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Contacts view coming soon. Use the Pipeline tab to manage deals.
            </p>
          </div>
        )}

        {subNav === "companies" && (
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 14,
              padding: "40px 20px",
              textAlign: "center",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Companies view coming soon.
            </p>
          </div>
        )}

        {subNav === "reports" && (
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 14,
              padding: "40px 20px",
              textAlign: "center",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Reports view coming soon.
            </p>
          </div>
        )}
      </div>

      {/* ══════════ LOST DEAL MODAL ══════════ */}
      {lostDeal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => setLostDeal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0F1118",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 16,
              padding: "28px 32px",
              width: 440,
              maxWidth: "90vw",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            }}
          >
            <h3
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 22,
                color: "#FFFFFF",
                margin: "0 0 8px",
              }}
            >
              Mark Deal as Lost
            </h3>
            <p
              style={{
                fontSize: 12,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: 20,
              }}
            >
              {lostDeal.contact
                ? `${lostDeal.contact.firstName} ${lostDeal.contact.lastName}`
                : lostDeal.dealName}{" "}
              {lostDeal.company ? `at ${lostDeal.company.name}` : ""}
            </p>

            {/* Lost reason */}
            <label
              style={{
                display: "block",
                fontSize: 10,
                color: TEXT_TERTIARY,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
              }}
            >
              Lost Reason *
            </label>
            <select
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              style={{
                ...selectStyle,
                width: "100%",
                marginBottom: 16,
              }}
            >
              <option value="">Select reason...</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Lost notes */}
            <label
              style={{
                display: "block",
                fontSize: 10,
                color: TEXT_TERTIARY,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
              }}
            >
              Notes (optional)
            </label>
            <textarea
              value={lostNotes}
              onChange={(e) => setLostNotes(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 12,
                fontFamily: "'DM Sans', sans-serif",
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 8,
                color: TEXT_PRIMARY,
                outline: "none",
                resize: "vertical",
                marginBottom: 20,
              }}
            />

            {/* Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setLostDeal(null)}
                style={{
                  padding: "8px 18px",
                  fontSize: 12,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  background: "rgba(255,255,255,0.06)",
                  color: TEXT_SECONDARY,
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLostDeal}
                disabled={!lostReason}
                style={{
                  padding: "8px 18px",
                  fontSize: 12,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  background: !lostReason ? "rgba(248,113,113,0.3)" : "#F87171",
                  color: !lostReason ? TEXT_TERTIARY : "#060709",
                  border: "none",
                  borderRadius: 8,
                  cursor: !lostReason ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                Mark as Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODALS ══════════ */}
      {showContactModal && (
        <ContactModal
          mode={editingContact ? "edit" : "create"}
          onClose={() => {
            setShowContactModal(false)
            setEditingContact(null)
          }}
          contact={editingContact as any}
          onSave={handleContactSaved}
        />
      )}

      {showDealModal && (
        <DealModal
          mode="create"
          onClose={() => setShowDealModal(false)}
          deal={null}
          contacts={contacts.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, company: c.company?.name ?? null }))}
          onSave={handleDealSaved}
        />
      )}
    </div>
  )
}
