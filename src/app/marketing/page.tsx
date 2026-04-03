"use client"

import { useState, useEffect, useCallback } from "react"
import OverviewTab from "@/components/marketing/OverviewTab"
import ContentTab from "@/components/marketing/ContentTab"
import MetricsTab from "@/components/marketing/MetricsTab"
import IntelTab from "@/components/marketing/IntelTab"
import IdeaModal from "@/components/marketing/IdeaModal"
import IntelModal from "@/components/marketing/IntelModal"
import ComplianceCheckTab from "@/components/marketing/ComplianceCheckTab"
import { fmtNum } from "@/components/marketing/constants"
import type { SocialMetric, ContentIdea, MarketingIntel, MarketingSummary, Employee } from "@/components/marketing/types"

/* ── Design tokens ── */
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const CARD_BG = "rgba(15,17,24,0.6)"
const GREEN = "#34D399"

type TabId = "overview" | "content" | "metrics" | "intel" | "compliance"
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "content", label: "Content Ideas" },
  { id: "metrics", label: "Social Metrics" },
  { id: "intel", label: "Veille / Intel" },
  { id: "compliance", label: "✅ Compliance Check" },
]

export default function MarketingPage() {
  const [summary, setSummary] = useState<MarketingSummary | null>(null)
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [metrics, setMetrics] = useState<SocialMetric[]>([])
  const [intel, setIntel] = useState<MarketingIntel[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeTab, setActiveTab] = useState<TabId>("overview")

  /* Idea modal state */
  const [showIdeaModal, setShowIdeaModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null)

  /* Intel modal state */
  const [showIntelModal, setShowIntelModal] = useState(false)
  const [editingIntel, setEditingIntel] = useState<MarketingIntel | null>(null)

  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)

  // Check access (admin+ OR Marketing department)
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        const rl = data.employee?.roleLevel ?? "member"
        const dept = (data.employee?.department ?? "").toLowerCase()
        setHasAccess(rl === "super_admin" || rl === "admin" || dept === "marketing")
        setAccessChecked(true)
      })
      .catch(() => setAccessChecked(true))
  }, [])

  /* ── Fetchers (must be before early returns to satisfy React hooks rules) ── */
  const fetchSummary = useCallback(() => {
    fetch("/api/marketing/metrics/summary")
      .then((r) => r.json())
      .then((data) => setSummary(data.summary ?? null))
      .catch(() => {})
  }, [])

  const fetchIdeas = useCallback(() => {
    fetch("/api/marketing/ideas")
      .then((r) => r.json())
      .then((data) => setIdeas(data.ideas ?? []))
      .catch(() => {})
  }, [])

  const fetchMetrics = useCallback(() => {
    fetch("/api/marketing/metrics")
      .then((r) => r.json())
      .then((data) => setMetrics(data.metrics ?? []))
      .catch(() => {})
  }, [])

  const fetchIntel = useCallback(() => {
    fetch("/api/marketing/intel")
      .then((r) => r.json())
      .then((data) => setIntel(data.intel ?? []))
      .catch(() => {})
  }, [])

  const fetchEmployees = useCallback(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.employees ?? []).map((e: Record<string, string>) => ({
          id: e.id,
          name: e.name,
          initials: e.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?",
          role: e.role ?? "",
        }))
        setEmployees(list)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!hasAccess) return
    fetchSummary()
    fetchIdeas()
    fetchMetrics()
    fetchIntel()
    fetchEmployees()
  }, [hasAccess, fetchSummary, fetchIdeas, fetchMetrics, fetchIntel, fetchEmployees])

  if (!accessChecked) return null
  if (!hasAccess) {
    return (
      <div style={{ padding: "80px 32px", textAlign: "center" }}>
        <h2 style={{ color: TEXT_PRIMARY, fontSize: 20, marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: TEXT_SECONDARY, fontSize: 14 }}>You need admin access or be part of the Marketing team to view this page.</p>
      </div>
    )
  }

  const refreshAll = () => {
    fetchSummary()
    fetchIdeas()
    fetchMetrics()
    fetchIntel()
  }

  /* ── Idea handlers ── */
  const openNewIdea = () => {
    setEditingIdea(null)
    setShowIdeaModal(true)
  }

  const openEditIdea = (idea: ContentIdea) => {
    setEditingIdea(idea)
    setShowIdeaModal(true)
  }

  const handleIdeaSaved = () => {
    setShowIdeaModal(false)
    setEditingIdea(null)
    refreshAll()
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch(`/api/marketing/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      fetchIdeas()
      fetchSummary()
    } catch { /* silent */ }
  }

  /* ── Intel handlers ── */
  const openNewIntel = () => {
    setEditingIntel(null)
    setShowIntelModal(true)
  }

  const openEditIntel = (item: MarketingIntel) => {
    setEditingIntel(item)
    setShowIntelModal(true)
  }

  const handleIntelSaved = () => {
    setShowIntelModal(false)
    setEditingIntel(null)
    fetchIntel()
  }

  const handleDeleteIntel = async (id: string) => {
    try {
      await fetch(`/api/marketing/intel/${id}`, { method: "DELETE" })
      fetchIntel()
    } catch { /* silent */ }
  }

  /* ── Metrics save handler ── */
  const handleMetricsSave = async (data: {
    platform: string; date: string; followers: number; impressions: number;
    engagement: number; clicks: number; posts: number
  }) => {
    try {
      await fetch("/api/marketing/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      fetchMetrics()
      fetchSummary()
    } catch { /* silent */ }
  }

  /* ── Subtitle ── */
  const subtitle = summary
    ? `${fmtNum(summary.totalFollowers)} followers · ${fmtNum(summary.monthlyImpressions)} impressions this month`
    : "Loading marketing data..."

  return (
    <div className="page-content" style={{ padding: 0, background: "#060709", minHeight: "100vh" }}>
      {/* Header */}
      <div
        className="fade-in"
        style={{
          padding: "24px 28px 0",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 32, fontWeight: 400, color: TEXT_PRIMARY, margin: 0, lineHeight: 1.2 }}>
              Marketing
            </h1>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 6 }}>
              {subtitle}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {activeTab === "content" && (
              <button onClick={openNewIdea} className="btn-primary" style={{ padding: "7px 16px", fontSize: 11 }}>
                + New Idea
              </button>
            )}
            {activeTab === "intel" && (
              <button onClick={openNewIntel} className="btn-primary" style={{ padding: "7px 16px", fontSize: 11 }}>
                + Add Intel
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${CARD_BORDER}` }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 20px",
                fontSize: 12,
                fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                color: activeTab === tab.id ? TEXT_PRIMARY : TEXT_TERTIARY,
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #C08B88" : "2px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: "20px 28px 40px" }}>
        {activeTab === "overview" && (
          <OverviewTab summary={summary} />
        )}
        {activeTab === "content" && (
          <ContentTab
            ideas={ideas}
            onEdit={openEditIdea}
            onAdd={openNewIdea}
            onStatusChange={handleStatusChange}
            onRefresh={fetchIdeas}
          />
        )}
        {activeTab === "metrics" && (
          <MetricsTab
            metrics={metrics}
            onSave={handleMetricsSave}
          />
        )}
        {activeTab === "intel" && (
          <IntelTab
            intel={intel}
            onAdd={openNewIntel}
            onEdit={openEditIntel}
            onDelete={handleDeleteIntel}
          />
        )}
        {activeTab === "compliance" && (
          <ComplianceCheckTab />
        )}
      </div>

      {/* Modals */}
      {showIdeaModal && (
        <IdeaModal
          idea={editingIdea}
          employees={employees}
          onClose={() => { setShowIdeaModal(false); setEditingIdea(null) }}
          onSave={handleIdeaSaved}
        />
      )}
      {showIntelModal && (
        <IntelModal
          intel={editingIntel}
          onClose={() => { setShowIntelModal(false); setEditingIntel(null) }}
          onSave={handleIntelSaved}
        />
      )}
    </div>
  )
}
