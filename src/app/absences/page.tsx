"use client"

import { useState, useEffect, useCallback } from "react"
import CalendarTab from "@/components/absences/CalendarTab"
import MyLeavesTab from "@/components/absences/MyLeavesTab"
import AdminTab from "@/components/absences/AdminTab"
import RulesTab from "@/components/absences/RulesTab"
import RequestLeaveModal from "@/components/absences/RequestLeaveModal"
import EditQuotaModal from "@/components/absences/EditQuotaModal"
import { CARD_BORDER, TEXT_TERTIARY, FROST, ROSE_GOLD } from "@/components/absences/constants"
import type { Employee, LeaveRequest, LeaveBalance, WhoIsOut, LeaveRules } from "@/components/absences/types"

const TABS = [
  { id: "calendar", label: "Calendar View" },
  { id: "my-leaves", label: "My Leaves" },
  { id: "rules", label: "Rules" },
  { id: "admin", label: "Admin" },
] as const

type TabId = typeof TABS[number]["id"]

export default function AbsencesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("calendar")
  const [me, setMe] = useState<Employee & { isAdmin?: boolean } | null>(null)
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([])
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [whoIsOut, setWhoIsOut] = useState<{ today: WhoIsOut[]; thisWeek: WhoIsOut[]; thisMonth: WhoIsOut[] }>({ today: [], thisWeek: [], thisMonth: [] })
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarLeaves, setCalendarLeaves] = useState<LeaveRequest[]>([])
  const [yearLeaves, setYearLeaves] = useState<LeaveRequest[]>([])
  const [allBalances, setAllBalances] = useState<Array<LeaveBalance & { employee?: Employee }>>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [editingQuota, setEditingQuota] = useState<(LeaveBalance & { employee?: Employee }) | null>(null)
  const [rules, setRules] = useState<LeaveRules | null>(null)

  /* ── Fetch current user ── */
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.employee) {
          const rl = data.employee.roleLevel ?? "member"
          setMe({ ...data.employee, isAdmin: rl === "super_admin" || rl === "admin" })
        }
      })
      .catch(() => {})
  }, [])

  /* ── Fetchers ── */
  const fetchMyRequests = useCallback(() => {
    if (!me) return
    fetch(`/api/leaves?employeeId=${me.id}`)
      .then((r) => r.json())
      .then((data) => setMyRequests(data.requests ?? []))
      .catch(() => {})
  }, [me])

  const fetchBalance = useCallback(() => {
    if (!me) return
    fetch(`/api/leaves/balance/${me.id}`)
      .then((r) => r.json())
      .then((data) => setBalance(data.balance ?? null))
      .catch(() => {})
  }, [me])

  const fetchWhoIsOut = useCallback(() => {
    fetch("/api/leaves/who-is-out")
      .then((r) => r.json())
      .then((data) => setWhoIsOut({
        today: data.today ?? [],
        thisWeek: data.thisWeek ?? [],
        thisMonth: data.thisMonth ?? [],
      }))
      .catch(() => {})
  }, [])

  const fetchAllRequests = useCallback(() => {
    if (!me?.isAdmin) return
    fetch("/api/leaves?all=true")
      .then((r) => r.json())
      .then((data) => setAllRequests(data.requests ?? []))
      .catch(() => {})
  }, [me])

  const fetchCalendarLeaves = useCallback(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0).toISOString()
    fetch(`/api/leaves?all=true&status=approved&startDate=${start}&endDate=${end}`)
      .then((r) => r.json())
      .then((data) => setCalendarLeaves(data.requests ?? []))
      .catch(() => {})
  }, [currentMonth])

  const fetchYearLeaves = useCallback(() => {
    const year = new Date().getFullYear()
    const start = new Date(year, 0, 1).toISOString()
    const end = new Date(year, 11, 31).toISOString()
    fetch(`/api/leaves?all=true&status=approved&startDate=${start}&endDate=${end}`)
      .then((r) => r.json())
      .then((data) => setYearLeaves(data.requests ?? []))
      .catch(() => {})
  }, [])

  const fetchAllBalances = useCallback(() => {
    if (!me?.isAdmin) return
    fetch("/api/employees")
      .then((r) => r.json())
      .then(async (data) => {
        const emps = data.employees ?? []
        setEmployees(emps)
        const balances: Array<LeaveBalance & { employee?: Employee }> = []
        for (const emp of emps) {
          try {
            const res = await fetch(`/api/leaves/balance/${emp.id}`)
            const bData = await res.json()
            if (bData.balance) balances.push({ ...bData.balance, employee: emp })
          } catch { /* silent */ }
        }
        setAllBalances(balances)
      })
      .catch(() => {})
  }, [me])

  const fetchRules = useCallback(() => {
    fetch("/api/leaves/rules")
      .then((r) => r.json())
      .then((data) => setRules(data.rules ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchWhoIsOut() }, [fetchWhoIsOut])
  useEffect(() => { fetchCalendarLeaves() }, [fetchCalendarLeaves])
  useEffect(() => { fetchYearLeaves() }, [fetchYearLeaves])
  useEffect(() => { fetchRules() }, [fetchRules])

  useEffect(() => {
    if (!me) return
    fetchMyRequests()
    fetchBalance()
    if (me.isAdmin) {
      fetchAllRequests()
      fetchAllBalances()
    }
  }, [me, fetchMyRequests, fetchBalance, fetchAllRequests, fetchAllBalances])

  /* ── Actions ── */
  const handleApprove = async (id: string, note: string) => {
    await fetch(`/api/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved", reviewNote: note || null }),
    })
    fetchAllRequests()
    fetchWhoIsOut()
    fetchCalendarLeaves()
    fetchAllBalances()
  }

  const handleReject = async (id: string, note: string) => {
    await fetch(`/api/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", reviewNote: note || null }),
    })
    fetchAllRequests()
    fetchAllBalances()
  }

  const handleCancel = async (id: string) => {
    await fetch(`/api/leaves/${id}`, { method: "DELETE" })
    fetchMyRequests()
    fetchBalance()
  }

  const handleSaveQuota = async (quotas: { vacationTotal: number; sickTotal: number; oooTotal: number }) => {
    if (!editingQuota?.employee) return
    await fetch(`/api/leaves/balance/${editingQuota.employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quotas),
    })
    setEditingQuota(null)
    fetchAllBalances()
  }

  const handleRequestSaved = () => {
    setShowRequestModal(false)
    fetchMyRequests()
    fetchBalance()
    if (me?.isAdmin) fetchAllRequests()
  }

  const pendingRequests = allRequests.filter((r) => r.status === "pending")
  const tabsToShow = me?.isAdmin ? TABS : TABS.filter((t) => t.id !== "admin")

  return (
    <div className="page-content" style={{ padding: 0 }}>
      {/* Header */}
      <div
        className="sticky-header"
        style={{
          padding: "24px 32px 0",
          background: "rgba(6,7,9,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${CARD_BORDER}`,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 28, fontWeight: 400, color: FROST, margin: 0, lineHeight: 1.2 }}>
              Absences
            </h1>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>
              Manage time off requests and team availability
            </p>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="btn-primary"
            style={{ padding: "8px 20px", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
          >
            + Request Leave
          </button>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 0, margin: "0 -32px", padding: "0 32px" }}>
          {tabsToShow.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 18px", fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? ROSE_GOLD : TEXT_TERTIARY,
                  background: "none", border: "none",
                  borderBottom: isActive ? `2px solid ${ROSE_GOLD}` : "2px solid transparent",
                  cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ padding: "28px 32px" }}>
        {activeTab === "calendar" && (
          <CalendarTab
            currentMonth={currentMonth}
            calendarLeaves={calendarLeaves}
            yearLeaves={yearLeaves}
            whoIsOut={whoIsOut}
            pendingCount={pendingRequests.length}
            isAdmin={!!me?.isAdmin}
            onPrevMonth={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            onNextMonth={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            onToday={() => setCurrentMonth(new Date())}
            onSetMonth={(date) => setCurrentMonth(date)}
            onQuickApprove={(id) => handleApprove(id, "")}
            onGoToAdmin={() => setActiveTab("admin")}
            pendingRequests={pendingRequests}
          />
        )}

        {activeTab === "my-leaves" && (
          <MyLeavesTab
            balance={balance}
            myRequests={myRequests}
            onRequestLeave={() => setShowRequestModal(true)}
            onCancel={handleCancel}
          />
        )}

        {activeTab === "rules" && (
          <RulesTab
            rules={rules}
            isAdmin={!!me?.isAdmin}
            onRulesSaved={fetchRules}
          />
        )}

        {activeTab === "admin" && me?.isAdmin && (
          <AdminTab
            pendingRequests={pendingRequests}
            allRequests={allRequests}
            allBalances={allBalances}
            employees={employees}
            onApprove={handleApprove}
            onReject={handleReject}
            onEditQuota={setEditingQuota}
          />
        )}
      </div>

      {/* Modals */}
      {showRequestModal && (
        <RequestLeaveModal
          onClose={() => setShowRequestModal(false)}
          onSaved={handleRequestSaved}
          balance={balance}
          rules={rules}
        />
      )}

      {editingQuota && (
        <EditQuotaModal
          balance={editingQuota}
          onClose={() => setEditingQuota(null)}
          onSave={handleSaveQuota}
        />
      )}
    </div>
  )
}
