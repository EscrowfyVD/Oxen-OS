"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Globe, Users, TrendingUp, DollarSign, Briefcase,
  FileText, Activity, MapPin, ExternalLink,
} from "lucide-react"
import {
  STAGE_LABELS,
  STAGE_COLORS as PIPELINE_STAGE_COLORS,
  fmtCurrency,
  fmtCurrencyFull,
  CRM_COLORS,
  ACTIVITY_ICONS,
} from "@/lib/crm-config"

/* ── Tokens ── */
const CARD_BG = CRM_COLORS.card_bg
const CARD_BORDER = CRM_COLORS.card_border
const TEXT_PRIMARY = CRM_COLORS.text_primary
const TEXT_SECONDARY = CRM_COLORS.text_secondary
const TEXT_TERTIARY = CRM_COLORS.text_tertiary
const ROSE_GOLD = CRM_COLORS.rose_gold
const GREEN = CRM_COLORS.green
const GLASS_BLUR = CRM_COLORS.glass_blur
const GLASS_SHADOW = CRM_COLORS.glass_shadow

/* ── Types ── */
interface ContactRow {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  jobTitle: string | null
  lifecycleStage: string | null
  contactType: string | null
  relationshipStrength: string | null
  lastInteraction: string | null
}

interface DealRow {
  id: string
  dealName: string
  stage: string
  dealValue: number | null
  weightedValue: number | null
  winProbability: number | null
  dealOwner: string | null
  expectedCloseDate: string | null
  stageChangedAt: string | null
  daysInCurrentStage: number | null
  closedAt: string | null
  createdAt: string
}

interface ActivityRow {
  id: string
  type: string
  title: string | null
  notes: string | null
  createdAt: string
  contact?: { firstName: string | null; lastName: string | null } | null
}

interface Company {
  id: string
  name: string
  website: string | null
  domain: string | null
  industry: string | null
  description: string | null
  hqCountry: string | null
  hqCity: string | null
  vertical: string[]
  subVertical: string[]
  geoZone: string | null
  employeeCount: number | null
  revenueRange: string | null
  fundingTotal: string | null
  techStack: string[]
  linkedinUrl: string | null
  socialProfiles: Record<string, string> | null
  contacts: ContactRow[]
  deals: DealRow[]
  createdAt: string
  updatedAt: string
}

interface Aggregates {
  totalContacts: number
  activeDealsCount: number
  totalDeals: number
  totalDealValue: number
  totalWeightedValue: number
  wonDeals: number
  wonRevenue: number
}

type TabId = "overview" | "contacts" | "deals" | "activity" | "files"

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "deals", label: "Deals" },
  { id: "activity", label: "Activity" },
  { id: "files", label: "Files" },
]

const glassCard: React.CSSProperties = {
  background: CARD_BG,
  backdropFilter: GLASS_BLUR,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  padding: 22,
  boxShadow: GLASS_SHADOW,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: TEXT_TERTIARY,
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 4,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
}

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [aggregates, setAggregates] = useState<Aggregates | null>(null)
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>("overview")

  const fetchCompany = useCallback(() => {
    fetch(`/api/crm/companies/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCompany(data.company ?? null)
        setAggregates(data.aggregates ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const fetchActivities = useCallback(() => {
    if (!company) return
    // Fetch activities for all contacts in this company
    const contactIds = company.contacts.map((c) => c.id)
    if (contactIds.length === 0) return
    // Fetch from each contact's activity endpoint
    Promise.all(
      contactIds.map((cid) =>
        fetch(`/api/crm/contacts/${cid}/activities`)
          .then((r) => r.json())
          .then((data) => (data.activities ?? []) as ActivityRow[])
          .catch(() => [] as ActivityRow[])
      )
    ).then((results) => {
      const all = results
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setActivities(all)
    })
  }, [company])

  useEffect(() => {
    fetchCompany()
  }, [fetchCompany])

  useEffect(() => {
    if (activeTab === "activity" && company) fetchActivities()
  }, [activeTab, company, fetchActivities])

  if (loading) {
    return (
      <div style={{ padding: "80px 40px", color: TEXT_TERTIARY, textAlign: "center", background: "var(--void)", minHeight: "100vh" }}>
        Loading company...
      </div>
    )
  }

  if (!company) {
    return (
      <div style={{ padding: "80px 40px", color: TEXT_TERTIARY, textAlign: "center", background: "var(--void)", minHeight: "100vh" }}>
        Company not found
      </div>
    )
  }

  const stageColor = (stage: string) => PIPELINE_STAGE_COLORS[stage] ?? TEXT_TERTIARY
  const stageLabel = (stage: string) => STAGE_LABELS[stage] ?? stage

  return (
    <div style={{ padding: "32px 40px", minHeight: "100vh", background: "var(--void)" }}>
      {/* Back button */}
      <button
        onClick={() => router.push("/crm/companies")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: TEXT_SECONDARY,
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          padding: 0,
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={14} strokeWidth={1.8} />
        Back to Companies
      </button>

      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-start justify-between gap-4" style={{ marginBottom: 28 }}>
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
            {company.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 8 }}>
            {company.website && (
              <a
                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: ROSE_GOLD,
                  textDecoration: "none",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <Globe size={12} strokeWidth={1.8} />
                {company.domain ?? company.website}
                <ExternalLink size={10} strokeWidth={1.8} />
              </a>
            )}
            {company.industry && (
              <span style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                {company.industry}
              </span>
            )}
            {(company.hqCity || company.hqCountry) && (
              <span className="flex items-center gap-1" style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                <MapPin size={11} strokeWidth={1.8} />
                {[company.hqCity, company.hqCountry].filter(Boolean).join(", ")}
              </span>
            )}
          </div>

          {/* Vertical tags */}
          {company.vertical.length > 0 && (
            <div className="flex flex-wrap gap-1" style={{ marginTop: 10 }}>
              {company.vertical.map((v) => (
                <span
                  key={v}
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: 11,
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
        </div>
      </div>

      {/* ─── Metrics row ─── */}
      {aggregates && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {[
            { label: "Contacts", value: String(aggregates.totalContacts), icon: Users, color: TEXT_PRIMARY },
            { label: "Active Deals", value: String(aggregates.activeDealsCount), icon: TrendingUp, color: TEXT_PRIMARY },
            { label: "Pipeline Value", value: fmtCurrency(aggregates.totalWeightedValue), icon: Briefcase, color: CRM_COLORS.indigo },
            { label: "Revenue (Won)", value: fmtCurrency(aggregates.wonRevenue), icon: DollarSign, color: GREEN },
          ].map((metric) => (
            <div key={metric.label} style={glassCard}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <metric.icon size={14} strokeWidth={1.8} style={{ color: TEXT_TERTIARY }} />
                <span style={{ ...labelStyle, marginBottom: 0 }}>{metric.label}</span>
              </div>
              <span
                style={{
                  fontFamily: "'Bellfair', serif",
                  fontSize: 26,
                  color: metric.color,
                  lineHeight: 1,
                }}
              >
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="flex gap-1" style={{ marginBottom: 24, borderBottom: `1px solid ${CARD_BORDER}`, paddingBottom: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 18px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? `2px solid ${ROSE_GOLD}` : "2px solid transparent",
              color: activeTab === tab.id ? TEXT_PRIMARY : TEXT_TERTIARY,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
              transition: "color 0.2s, border-color 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─── */}

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {/* Company Info */}
          <div style={glassCard}>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 16, marginTop: 0 }}>
              Company Information
            </h3>
            {[
              { label: "Name", value: company.name },
              { label: "Industry", value: company.industry },
              { label: "HQ", value: [company.hqCity, company.hqCountry].filter(Boolean).join(", ") || null },
              { label: "Geo Zone", value: company.geoZone },
              { label: "Website", value: company.website },
              { label: "Domain", value: company.domain },
              { label: "Employee Count", value: company.employeeCount ? String(company.employeeCount) : null },
              { label: "Revenue Range", value: company.revenueRange },
              { label: "Funding Total", value: company.fundingTotal },
            ].map((field) => (
              <div key={field.label} style={{ marginBottom: 12 }}>
                <span style={labelStyle}>{field.label}</span>
                <p style={{ fontSize: 13, color: field.value ? TEXT_PRIMARY : TEXT_TERTIARY, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                  {field.value || "---"}
                </p>
              </div>
            ))}
          </div>

          {/* Enrichment / Verticals */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={glassCard}>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 16, marginTop: 0 }}>
                Verticals & Sub-Verticals
              </h3>
              {company.vertical.length > 0 ? (
                <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
                  {company.vertical.map((v) => (
                    <span key={v} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, color: ROSE_GOLD, background: "rgba(192,139,136,0.12)", fontFamily: "'DM Sans', sans-serif" }}>
                      {v}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: TEXT_TERTIARY }}>No verticals assigned</p>
              )}
              {company.subVertical.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {company.subVertical.map((sv) => (
                    <span key={sv} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, color: CRM_COLORS.indigo, background: "rgba(129,140,248,0.12)", fontFamily: "'DM Sans', sans-serif" }}>
                      {sv}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={glassCard}>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 16, marginTop: 0 }}>
                Tech Stack & Enrichment
              </h3>
              {company.techStack.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {company.techStack.map((t) => (
                    <span key={t} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, color: CRM_COLORS.cyan, background: "rgba(34,211,238,0.12)", fontFamily: "'DM Sans', sans-serif" }}>
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: TEXT_TERTIARY }}>No tech stack data</p>
              )}
              {company.linkedinUrl && (
                <div style={{ marginTop: 14 }}>
                  <span style={labelStyle}>LinkedIn</span>
                  <a
                    href={company.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: ROSE_GOLD, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {company.linkedinUrl}
                  </a>
                </div>
              )}
            </div>

            {company.description && (
              <div style={glassCard}>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 10, marginTop: 0 }}>
                  Description
                </h3>
                <p style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                  {company.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTACTS */}
      {activeTab === "contacts" && (
        <div style={glassCard}>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 16, marginTop: 0 }}>
            Contacts ({company.contacts.length})
          </h3>
          {company.contacts.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_TERTIARY }}>No contacts linked to this company yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Name", "Email", "Job Title", "Stage", "Type", "Strength"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 14px",
                          fontSize: 10,
                          color: TEXT_TERTIARY,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                          borderBottom: `1px solid ${CARD_BORDER}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {company.contacts.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/crm/${c.id}`)}
                      style={{ cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 14px", fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || "---"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {c.email || "---"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {c.jobTitle || "---"}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {c.lifecycleStage && (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 10,
                              fontWeight: 500,
                              color: stageColor(c.lifecycleStage),
                              background: `${stageColor(c.lifecycleStage)}18`,
                              fontFamily: "'DM Sans', sans-serif",
                            }}
                          >
                            {stageLabel(c.lifecycleStage)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>
                        {c.contactType || "---"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>
                        {c.relationshipStrength?.replace(/_/g, " ") || "---"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DEALS */}
      {activeTab === "deals" && (
        <div style={glassCard}>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 16, marginTop: 0 }}>
            Deals ({company.deals.length})
          </h3>
          {company.deals.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_TERTIARY }}>No deals linked to this company yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Deal Name", "Stage", "Value", "Weighted", "Owner", "Expected Close", "Days in Stage"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 14px",
                          fontSize: 10,
                          color: TEXT_TERTIARY,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                          borderBottom: `1px solid ${CARD_BORDER}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {company.deals.map((d) => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {d.dealName}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 500,
                            color: stageColor(d.stage),
                            background: `${stageColor(d.stage)}18`,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {stageLabel(d.stage)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontFamily: "'Bellfair', serif", fontSize: 14, color: TEXT_PRIMARY }}>
                        {d.dealValue ? fmtCurrencyFull(d.dealValue) : "---"}
                      </td>
                      <td style={{ padding: "12px 14px", fontFamily: "'Bellfair', serif", fontSize: 14, color: TEXT_SECONDARY }}>
                        {d.weightedValue ? fmtCurrency(d.weightedValue) : "---"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {d.dealOwner || "---"}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {d.expectedCloseDate
                          ? new Date(d.expectedCloseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "---"}
                      </td>
                      <td style={{ padding: "12px 14px", fontFamily: "'Bellfair', serif", fontSize: 14, color: TEXT_SECONDARY }}>
                        {d.daysInCurrentStage ?? "---"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY */}
      {activeTab === "activity" && (
        <div style={glassCard}>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 16, marginTop: 0 }}>
            Activity Timeline
          </h3>
          {activities.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_TERTIARY }}>No activities recorded for this company yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {activities.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: "14px 0",
                    borderBottom: i < activities.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
                    {ACTIVITY_ICONS[a.type] || "o"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                      <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>
                        {a.title || a.type.replace(/_/g, " ")}
                      </span>
                      {a.contact && (
                        <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                          - {[a.contact.firstName, a.contact.lastName].filter(Boolean).join(" ")}
                        </span>
                      )}
                    </div>
                    {a.notes && (
                      <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: "4px 0 0", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
                        {a.notes.length > 200 ? a.notes.slice(0, 200) + "..." : a.notes}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: TEXT_TERTIARY, whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif" }}>
                    {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FILES */}
      {activeTab === "files" && (
        <div style={glassCard}>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 16, marginTop: 0 }}>
            Files & Documents
          </h3>
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <FileText size={36} strokeWidth={1.2} style={{ color: TEXT_TERTIARY, marginBottom: 10, opacity: 0.5 }} />
            <p style={{ fontSize: 13, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
              No files linked to this company yet.
            </p>
            <p style={{ fontSize: 11, color: TEXT_TERTIARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
              Drive integration coming soon
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
