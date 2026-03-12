"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  CARD_BORDER, TEXT_SECONDARY, TEXT_TERTIARY,
  FROST, RED, AMBER, ROSE_GOLD,
  SECTOR_COLORS, STATUS_COLORS, HEALTH_COLORS,
} from "@/components/crm/constants"
import type { Contact, Employee } from "@/components/crm/types"

import OverviewTab from "@/components/crm/detail/OverviewTab"
import TimelineTab from "@/components/crm/detail/TimelineTab"
import EmailsTab from "@/components/crm/detail/EmailsTab"
import DealsTab from "@/components/crm/detail/DealsTab"
import SentinelTab from "@/components/crm/detail/SentinelTab"

const TABS = [
  { id: "overview", label: "Overview", icon: "\uD83D\uDCCB" },
  { id: "timeline", label: "Timeline", icon: "\uD83D\uDD52" },
  { id: "emails", label: "Emails", icon: "\u2709\uFE0F" },
  { id: "deals", label: "Deals", icon: "\uD83D\uDCCA" },
  { id: "sentinel", label: "Sentinel", icon: "\uD83D\uDEE1\uFE0F" },
] as const

type TabId = typeof TABS[number]["id"]

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [contact, setContact] = useState<Contact | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [researching, setResearching] = useState(false)
  const [generatingBrief, setGeneratingBrief] = useState(false)

  const fetchContact = useCallback(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setContact(data.contact ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const fetchEmployees = useCallback(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchContact()
    fetchEmployees()
  }, [fetchContact, fetchEmployees])

  /* ── Quick actions ── */
  const askSentinel = () => {
    const name = contact?.company || contact?.name || ""
    router.push(`/ai?contactId=${id}&contactName=${encodeURIComponent(name)}`)
  }

  const researchCompany = async () => {
    setResearching(true)
    try {
      await fetch(`/api/ai/research/${id}`, { method: "POST" })
      fetchContact()
    } catch { /* silent */ }
    setResearching(false)
  }

  const generateBrief = async () => {
    if (!contact) return
    setGeneratingBrief(true)
    try {
      await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: id,
          title: `Meeting with ${contact.company || contact.name}`,
          attendees: [contact.email].filter(Boolean),
        }),
      })
      fetchContact()
    } catch { /* silent */ }
    setGeneratingBrief(false)
  }

  const handleDelete = async () => {
    try {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" })
      router.push("/crm")
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center", color: TEXT_TERTIARY }}>
        Loading...
      </div>
    )
  }

  if (!contact) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center", color: TEXT_TERTIARY }}>
        Contact not found.{" "}
        <span style={{ color: ROSE_GOLD, cursor: "pointer" }} onClick={() => router.push("/crm")}>
          Back to CRM
        </span>
      </div>
    )
  }

  const statusColor = STATUS_COLORS[contact.status] || STATUS_COLORS.lead
  const sectorColor = contact.sector ? SECTOR_COLORS[contact.sector] || SECTOR_COLORS.Other : null
  const healthColor = HEALTH_COLORS[contact.healthStatus] || HEALTH_COLORS.healthy

  return (
    <div className="page-content" style={{ padding: 0 }}>
      {/* ── Header ── */}
      <div
        className="sticky-header"
        style={{
          padding: "16px 32px 0",
          background: "rgba(6,7,9,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${CARD_BORDER}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => router.push("/crm")}
              style={{ background: "none", border: "none", color: TEXT_TERTIARY, fontSize: 18, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}
            >
              {"\u2190"}
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 24, fontWeight: 400, color: FROST, lineHeight: 1.2, margin: 0 }}>
                  {contact.company || contact.name}
                </h1>
                <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: statusColor.bg, color: statusColor.text }}>
                  {contact.status}
                </span>
                <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: healthColor.bg, color: healthColor.text }}>
                  {contact.healthStatus.replace("_", " ")}
                </span>
                {sectorColor && (
                  <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: sectorColor.bg, color: sectorColor.text }}>
                    {contact.sector}
                  </span>
                )}
              </div>
              {contact.company && (
                <p style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
                  {contact.name} {contact.segment && `\u00B7 ${contact.segment}`}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: RED, fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}
              >
                Delete
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: RED }}>Confirm?</span>
                <button onClick={handleDelete} style={{ background: RED, border: "none", color: FROST, fontSize: 11, padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}>Yes, delete</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary" style={{ padding: "6px 12px", fontSize: 11 }}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions Bar ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            onClick={askSentinel}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
              background: "linear-gradient(135deg, rgba(192,139,136,0.15), rgba(192,139,136,0.08))",
              border: "1px solid rgba(192,139,136,0.25)", color: ROSE_GOLD,
            }}
          >
            {"\uD83D\uDEE1\uFE0F"} Ask Sentinel
          </button>
          <button
            onClick={researchCompany}
            disabled={researching}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif", cursor: researching ? "wait" : "pointer",
              background: researching ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${researching ? "rgba(251,191,36,0.2)" : CARD_BORDER}`,
              color: researching ? AMBER : TEXT_SECONDARY,
            }}
          >
            {researching ? "Researching..." : "\uD83D\uDD0D Research Company"}
          </button>
          <button
            onClick={generateBrief}
            disabled={generatingBrief}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif", cursor: generatingBrief ? "wait" : "pointer",
              background: generatingBrief ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${generatingBrief ? "rgba(251,191,36,0.2)" : CARD_BORDER}`,
              color: generatingBrief ? AMBER : TEXT_SECONDARY,
            }}
          >
            {generatingBrief ? "Generating..." : "\uD83D\uDCCB Generate Brief"}
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${CARD_BORDER}`, color: TEXT_SECONDARY,
            }}
          >
            {"\u270F\uFE0F"} Add Interaction
          </button>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ display: "flex", gap: 0, margin: "0 -32px", padding: "0 32px" }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 18px",
                  fontSize: 11,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? ROSE_GOLD : TEXT_TERTIARY,
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? `2px solid ${ROSE_GOLD}` : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  marginBottom: -1,
                }}
              >
                {tab.icon} {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ padding: "28px 32px" }}>
        {activeTab === "overview" && (
          <OverviewTab contact={contact} employees={employees} onRefresh={fetchContact} />
        )}
        {activeTab === "timeline" && (
          <TimelineTab contactId={id} contact={contact} onRefresh={fetchContact} />
        )}
        {activeTab === "emails" && (
          <EmailsTab contactId={id} contactEmail={contact.email} />
        )}
        {activeTab === "deals" && (
          <DealsTab deals={contact.deals || []} contactId={id} employees={employees} onRefresh={fetchContact} />
        )}
        {activeTab === "sentinel" && (
          <SentinelTab
            contactId={id}
            contactName={contact.name}
            companyName={contact.company}
            insights={contact.aiInsights || []}
            briefs={contact.meetingBriefs || []}
            onRefresh={fetchContact}
          />
        )}
      </div>
    </div>
  )
}
