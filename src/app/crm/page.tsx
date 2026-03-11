"use client"

import { useState, useEffect, useCallback } from "react"
import OverviewTab from "@/components/crm/OverviewTab"
import ClientsTab from "@/components/crm/ClientsTab"
import CroPipelineTab from "@/components/crm/CroPipelineTab"
import RevenueTab from "@/components/crm/RevenueTab"
import ForecastTab from "@/components/crm/ForecastTab"
import ReportsTab from "@/components/crm/ReportsTab"
import ContactModal from "@/components/crm/ContactModal"
import DealModal from "@/components/crm/DealModal"
import type {
  Contact, Employee, CrmStats,
  OverviewData, PipelineData, ForecastData, MetricsData,
} from "@/components/crm/types"

/* ── Design tokens ── */
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const FROST = "#FFFFFF"

type TabId = "overview" | "clients" | "pipeline" | "revenue" | "forecast" | "reports"

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "clients", label: "Clients" },
  { id: "pipeline", label: "Pipeline" },
  { id: "revenue", label: "Revenue" },
  { id: "forecast", label: "Forecast" },
  { id: "reports", label: "Reports" },
]

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stats, setStats] = useState<CrmStats | null>(null)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [pipelineData, setPipelineData] = useState<PipelineData | null>(null)
  const [forecastData, setForecastData] = useState<ForecastData | null>(null)
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [showContactModal, setShowContactModal] = useState(false)
  const [showDealModal, setShowDealModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  /* ── Fetchers ── */
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

  const fetchStats = useCallback(() => {
    fetch("/api/contacts/stats")
      .then((r) => r.json())
      .then((data) => setStats(data.stats ?? null))
      .catch(() => {})
  }, [])

  const fetchOverview = useCallback(() => {
    fetch("/api/crm/overview")
      .then((r) => r.json())
      .then((data) => setOverview(data.overview ?? null))
      .catch(() => {})
  }, [])

  const fetchPipeline = useCallback(() => {
    fetch("/api/crm/pipeline")
      .then((r) => r.json())
      .then((data) => setPipelineData(data.pipeline ?? null))
      .catch(() => {})
  }, [])

  const fetchForecast = useCallback(() => {
    fetch("/api/crm/forecast")
      .then((r) => r.json())
      .then((data) => setForecastData(data.forecast ?? null))
      .catch(() => {})
  }, [])

  const fetchMetrics = useCallback(() => {
    fetch("/api/crm/metrics")
      .then((r) => r.json())
      .then((data) => setMetricsData(data.metrics ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchContacts()
    fetchEmployees()
    fetchStats()
    fetchOverview()
    fetchPipeline()
    fetchForecast()
    fetchMetrics()
  }, [fetchContacts, fetchEmployees, fetchStats, fetchOverview, fetchPipeline, fetchForecast, fetchMetrics])

  const refreshAll = () => {
    fetchContacts()
    fetchStats()
    fetchOverview()
    fetchPipeline()
    fetchForecast()
    fetchMetrics()
  }

  /* ── Handlers ── */
  const openNewContact = () => {
    setEditingContact(null)
    setShowContactModal(true)
  }

  const openNewDeal = () => {
    setShowDealModal(true)
  }

  const handleContactSaved = () => {
    setShowContactModal(false)
    setEditingContact(null)
    refreshAll()
  }

  const handleDealSaved = () => {
    setShowDealModal(false)
    refreshAll()
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)

  const tabDescriptions: Record<TabId, string> = {
    overview: overview
      ? `${overview.activeCustomers} active customers · ${formatCurrency(overview.monthlyRevenue)}/mo revenue`
      : "Revenue intelligence overview",
    clients: `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} in database`,
    pipeline: pipelineData
      ? `${pipelineData.totalDeals} deals · ${formatCurrency(pipelineData.totalWeightedRevenue)} weighted`
      : "Sales pipeline & deals",
    revenue: "Monthly GTV & revenue analysis",
    forecast: forecastData
      ? `${formatCurrency(forecastData.currentMonthlyRevenue)}/mo base revenue`
      : "Revenue forecast & projections",
    reports: "Analytics & conversion metrics",
  }

  return (
    <div className="page-content" style={{ padding: 0 }}>
      {/* ── Header ── */}
      <div
        className="sticky-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          background: "rgba(6,7,9,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${CARD_BORDER}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div>
            <h1
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 28,
                fontWeight: 400,
                color: FROST,
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Revenue Intelligence
            </h1>
            <p
              style={{
                fontSize: 12,
                color: TEXT_TERTIARY,
                marginTop: 4,
                fontFamily: "'DM Sans', sans-serif",
                lineHeight: 1.4,
              }}
            >
              {tabDescriptions[activeTab]}
            </p>
          </div>

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              gap: 2,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 8,
              padding: 3,
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
                  background: activeTab === tab.id ? "rgba(192,139,136,0.15)" : "transparent",
                  color: activeTab === tab.id ? TEXT_PRIMARY : TEXT_SECONDARY,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {activeTab === "pipeline" && (
            <button className="header-btn" onClick={openNewDeal}>
              + New Deal
            </button>
          )}
          <button className="header-btn" onClick={openNewContact}>
            + New Contact
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ padding: "28px 32px" }}>
        {activeTab === "overview" && (
          <OverviewTab data={overview} />
        )}

        {activeTab === "clients" && (
          <ClientsTab contacts={contacts} employees={employees} />
        )}

        {activeTab === "pipeline" && (
          <CroPipelineTab data={pipelineData} onNewDeal={openNewDeal} />
        )}

        {activeTab === "revenue" && (
          <RevenueTab data={metricsData} />
        )}

        {activeTab === "forecast" && (
          <ForecastTab data={forecastData} />
        )}

        {activeTab === "reports" && (
          <ReportsTab stats={stats} />
        )}
      </div>

      {/* ── Contact Modal ── */}
      <ContactModal
        show={showContactModal}
        onClose={() => {
          setShowContactModal(false)
          setEditingContact(null)
        }}
        contact={editingContact}
        employees={employees}
        onSaved={handleContactSaved}
      />

      {/* ── Deal Modal ── */}
      <DealModal
        show={showDealModal}
        onClose={() => setShowDealModal(false)}
        deal={null}
        contacts={contacts}
        employees={employees}
        onSaved={handleDealSaved}
      />
    </div>
  )
}
