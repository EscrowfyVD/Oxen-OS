"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, Building2, Users, TrendingUp, DollarSign } from "lucide-react"
import {
  VERTICALS,
  GEO_ZONES,
  STAGE_LABELS,
  fmtCurrency,
  CRM_COLORS,
} from "@/lib/crm-config"

/* ── Design tokens ── */
const CARD_BG = CRM_COLORS.card_bg
const CARD_BORDER = CRM_COLORS.card_border
const TEXT_PRIMARY = CRM_COLORS.text_primary
const TEXT_SECONDARY = CRM_COLORS.text_secondary
const TEXT_TERTIARY = CRM_COLORS.text_tertiary
const ROSE_GOLD = CRM_COLORS.rose_gold
const GLASS_BLUR = CRM_COLORS.glass_blur
const GLASS_SHADOW = CRM_COLORS.glass_shadow

const INDUSTRIES = [
  "Financial Services",
  "Technology",
  "Legal",
  "Real Estate",
  "Gaming",
  "Consulting",
  "Logistics",
  "Other",
]

interface CompanyCard {
  id: string
  name: string
  industry: string | null
  hqCountry: string | null
  hqCity: string | null
  vertical: string[]
  geoZone: string | null
  domain: string | null
  website: string | null
  contacts: { id: string }[]
  deals: { id: string; stage: string; dealValue: number | null }[]
}

export default function CompaniesListPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterVertical, setFilterVertical] = useState("all")
  const [filterGeoZone, setFilterGeoZone] = useState("all")
  const [filterIndustry, setFilterIndustry] = useState("all")

  const fetchCompanies = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (filterVertical !== "all") params.set("vertical", filterVertical)
    if (filterGeoZone !== "all") params.set("geoZone", filterGeoZone)
    if (filterIndustry !== "all") params.set("industry", filterIndustry)

    fetch(`/api/crm/companies?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [search, filterVertical, filterGeoZone, filterIndustry])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  const getActiveDeals = (deals: CompanyCard["deals"]) =>
    deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")

  const getTotalRevenue = (deals: CompanyCard["deals"]) =>
    deals
      .filter((d) => d.stage === "closed_won")
      .reduce((s, d) => s + (d.dealValue ?? 0), 0)

  const selectStyle: React.CSSProperties = {
    background: "var(--surface-input)",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    minWidth: 130,
  }

  return (
    <div style={{ padding: "32px 40px", minHeight: "100vh", background: "var(--void)" }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 28 }}>
        <div>
          <h1
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 32,
              color: TEXT_PRIMARY,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Companies
          </h1>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
            {companies.length} companies in your CRM
          </p>
        </div>
        <button
          onClick={() => {/* TODO: open new company modal */}}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            background: `linear-gradient(135deg, ${ROSE_GOLD}, #D4A5A3)`,
            border: "none",
            borderRadius: 10,
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
        >
          <Plus size={15} strokeWidth={2} />
          New Company
        </button>
      </div>

      {/* Search + Filters */}
      <div
        className="flex flex-wrap items-center gap-3"
        style={{ marginBottom: 24 }}
      >
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 360 }}>
          <Search
            size={15}
            strokeWidth={1.8}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: TEXT_TERTIARY,
            }}
          />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px 10px 36px",
              background: "var(--surface-input)",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 10,
              fontSize: 13,
              color: TEXT_PRIMARY,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
        </div>

        <select
          value={filterVertical}
          onChange={(e) => setFilterVertical(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Verticals</option>
          {VERTICALS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select
          value={filterGeoZone}
          onChange={(e) => setFilterGeoZone(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Geo Zones</option>
          {GEO_ZONES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <select
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All Industries</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: TEXT_TERTIARY, fontSize: 14 }}>
          Loading companies...
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 18,
          }}
        >
          {companies.map((company) => {
            const activeDeals = getActiveDeals(company.deals)
            const revenue = getTotalRevenue(company.deals)

            return (
              <div
                key={company.id}
                onClick={() => router.push(`/crm/companies/${company.id}`)}
                style={{
                  background: CARD_BG,
                  backdropFilter: GLASS_BLUR,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 14,
                  padding: 22,
                  cursor: "pointer",
                  transition: "border-color 0.2s, transform 0.15s",
                  boxShadow: GLASS_SHADOW,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(192,139,136,0.3)"
                  e.currentTarget.style.transform = "translateY(-2px)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = CARD_BORDER
                  e.currentTarget.style.transform = "translateY(0)"
                }}
              >
                {/* Company name + industry */}
                <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      style={{
                        fontFamily: "'Bellfair', serif",
                        fontSize: 20,
                        color: TEXT_PRIMARY,
                        margin: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {company.name}
                    </h3>
                    {company.industry && (
                      <p style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                        {company.industry}
                      </p>
                    )}
                  </div>
                  <Building2 size={18} strokeWidth={1.5} style={{ color: TEXT_TERTIARY, flexShrink: 0 }} />
                </div>

                {/* HQ Location */}
                {(company.hqCity || company.hqCountry) && (
                  <p style={{ fontSize: 11, color: TEXT_TERTIARY, marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>
                    {[company.hqCity, company.hqCountry].filter(Boolean).join(", ")}
                  </p>
                )}

                {/* Vertical tags */}
                {company.vertical.length > 0 && (
                  <div className="flex flex-wrap gap-1" style={{ marginBottom: 14 }}>
                    {company.vertical.map((v) => (
                      <span
                        key={v}
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 500,
                          color: ROSE_GOLD,
                          background: "rgba(192,139,136,0.12)",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}

                {/* Metrics row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 8,
                    paddingTop: 12,
                    borderTop: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div className="flex items-center justify-center gap-1" style={{ marginBottom: 2 }}>
                      <Users size={11} strokeWidth={1.8} style={{ color: TEXT_TERTIARY }} />
                      <span
                        style={{
                          fontFamily: "'Bellfair', serif",
                          fontSize: 16,
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {company.contacts.length}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      Contacts
                    </span>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div className="flex items-center justify-center gap-1" style={{ marginBottom: 2 }}>
                      <TrendingUp size={11} strokeWidth={1.8} style={{ color: TEXT_TERTIARY }} />
                      <span
                        style={{
                          fontFamily: "'Bellfair', serif",
                          fontSize: 16,
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {activeDeals.length}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      Active Deals
                    </span>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div className="flex items-center justify-center gap-1" style={{ marginBottom: 2 }}>
                      <DollarSign size={11} strokeWidth={1.8} style={{ color: TEXT_TERTIARY }} />
                      <span
                        style={{
                          fontFamily: "'Bellfair', serif",
                          fontSize: 16,
                          color: revenue > 0 ? "#34D399" : TEXT_PRIMARY,
                        }}
                      >
                        {fmtCurrency(revenue)}
                      </span>
                    </div>
                    <span style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      Revenue
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && companies.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            color: TEXT_TERTIARY,
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <Building2 size={40} strokeWidth={1.2} style={{ color: TEXT_TERTIARY, marginBottom: 12, opacity: 0.5 }} />
          <p>No companies found</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your filters or add a new company</p>
        </div>
      )}
    </div>
  )
}
