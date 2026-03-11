"use client"

import { useState, useEffect, useCallback } from "react"
import PipelineTab from "@/components/crm/PipelineTab"
import ClientsTab from "@/components/crm/ClientsTab"
import ReportsTab from "@/components/crm/ReportsTab"
import ContactModal from "@/components/crm/ContactModal"
import type { Contact, Employee, CrmStats } from "@/components/crm/types"

/* ── Design tokens ── */
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const FROST = "#FFFFFF"

type TabId = "pipeline" | "clients" | "reports"

const TABS: { id: TabId; label: string }[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "clients", label: "Clients" },
  { id: "reports", label: "Reports" },
]

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stats, setStats] = useState<CrmStats | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("pipeline")
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  /* ── Fetch contacts ── */
  const fetchContacts = useCallback(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => {})
  }, [])

  /* ── Fetch employees ── */
  const fetchEmployees = useCallback(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }, [])

  /* ── Fetch stats ── */
  const fetchStats = useCallback(() => {
    fetch("/api/contacts/stats")
      .then((r) => r.json())
      .then((data) => setStats(data.stats ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchContacts()
    fetchEmployees()
    fetchStats()
  }, [fetchContacts, fetchEmployees, fetchStats])

  /* ── Pipeline value ── */
  const pipelineValue = contacts
    .filter((c) => c.status !== "lost")
    .reduce((sum, c) => sum + (c.value ?? 0), 0)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)

  /* ── Handlers ── */
  const handleDrop = async (contactId: string, newStatus: string) => {
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchContacts()
      fetchStats()
    } catch {
      /* silent */
    }
  }

  const handleCardClick = (contact: Contact) => {
    setEditingContact(contact)
    setShowModal(true)
  }

  const openNewContact = () => {
    setEditingContact(null)
    setShowModal(true)
  }

  const handleSaved = () => {
    setShowModal(false)
    setEditingContact(null)
    fetchContacts()
    fetchStats()
  }

  const tabDescriptions: Record<TabId, string> = {
    pipeline: `Pipeline · ${formatCurrency(pipelineValue)} total value`,
    clients: `${contacts.length} contact${contacts.length !== 1 ? "s" : ""} in database`,
    reports: "Analytics & insights",
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
              CRM
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
                  padding: "6px 16px",
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

        <button className="header-btn" onClick={openNewContact}>
          + New Contact
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ padding: "28px 32px" }}>
        {activeTab === "pipeline" && (
          <PipelineTab
            contacts={contacts}
            onDrop={handleDrop}
            onCardClick={handleCardClick}
          />
        )}

        {activeTab === "clients" && (
          <ClientsTab
            contacts={contacts}
            employees={employees}
          />
        )}

        {activeTab === "reports" && (
          <ReportsTab stats={stats} />
        )}
      </div>

      {/* ── Contact Modal ── */}
      <ContactModal
        show={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingContact(null)
        }}
        contact={editingContact}
        employees={employees}
        onSaved={handleSaved}
      />
    </div>
  )
}
