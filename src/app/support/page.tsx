"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import OverviewTab from "@/components/support/OverviewTab"
import TicketsTab from "@/components/support/TicketsTab"
import ReportsTab from "@/components/support/ReportsTab"
import TicketModal from "@/components/support/TicketModal"
import { fmtDuration } from "@/components/support/constants"
import type { SupportTicket, SupportStats, DailyStats, Employee } from "@/components/support/types"

/* ── Design tokens ── */
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const GREEN = "#34D399"

type TabId = "overview" | "tickets" | "reports"
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "tickets", label: "Tickets" },
  { id: "reports", label: "Reports" },
]

export default function SupportPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [stats, setStats] = useState<SupportStats | null>(null)
  const [daily, setDaily] = useState<DailyStats[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [showTicketModal, setShowTicketModal] = useState(false)

  /* ── Fetchers ── */
  const fetchTickets = useCallback(() => {
    fetch("/api/support/tickets")
      .then((r) => r.json())
      .then((data) => setTickets(data.tickets ?? []))
      .catch(() => {})
  }, [])

  const fetchStats = useCallback(() => {
    fetch("/api/support/stats")
      .then((r) => r.json())
      .then((data) => setStats(data.stats ?? null))
      .catch(() => {})
  }, [])

  const fetchDaily = useCallback(() => {
    fetch("/api/support/stats/daily?days=30")
      .then((r) => r.json())
      .then((data) => setDaily(data.daily ?? []))
      .catch(() => {})
  }, [])

  const fetchEmployees = useCallback(() => {
    fetch("/api/employees")
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
    fetchTickets()
    fetchStats()
    fetchDaily()
    fetchEmployees()
  }, [fetchTickets, fetchStats, fetchDaily, fetchEmployees])

  const refreshAll = () => {
    fetchTickets()
    fetchStats()
    fetchDaily()
  }

  /* ── Handlers ── */
  const handleTicketSaved = () => {
    setShowTicketModal(false)
    refreshAll()
  }

  const handleSelectTicket = (ticket: SupportTicket) => {
    router.push(`/support/${ticket.id}`)
  }

  // Get unique agent names from tickets
  const agents = [...new Set(tickets.map((t) => t.assignedTo).filter(Boolean))] as string[]

  const subtitle = stats
    ? `${stats.openCount} open · Avg response ${fmtDuration(stats.avgResponseMs)}`
    : "Loading support data..."

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
              Support
            </h1>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 6 }}>
              {subtitle}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setShowTicketModal(true)}
              className="btn-primary"
              style={{ padding: "7px 16px", fontSize: 11 }}
            >
              + New Ticket
            </button>
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
          <OverviewTab stats={stats} daily={daily} />
        )}
        {activeTab === "tickets" && (
          <TicketsTab
            tickets={tickets}
            agents={agents}
            onSelect={handleSelectTicket}
            onAdd={() => setShowTicketModal(true)}
          />
        )}
        {activeTab === "reports" && (
          <ReportsTab tickets={tickets} />
        )}
      </div>

      {/* Modals */}
      {showTicketModal && (
        <TicketModal
          employees={employees}
          onClose={() => setShowTicketModal(false)}
          onSave={handleTicketSaved}
        />
      )}
    </div>
  )
}
