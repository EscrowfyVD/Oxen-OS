"use client"

import { useEffect, useState } from "react"
import PageHeader from "@/components/layout/PageHeader"
import { ROLE_COLORS, ROLE_LABELS, ROLE_LEVELS, type RoleLevel } from "@/lib/permissions"
import { canAccess } from "@/lib/permissions"
import { getAvatarGradient } from "@/lib/avatar"

const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"

interface Employee {
  id: string
  name: string
  email: string | null
  role: string
  department: string
  roleLevel: RoleLevel
  isAdmin: boolean
  avatarColor: string
  initials: string
}

interface MeData {
  roleLevel: RoleLevel
  id: string
}

export default function SettingsPage() {
  const [myRole, setMyRole] = useState<RoleLevel>("member")
  const [myId, setMyId] = useState<string>("")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"roles" | "general">("roles")
  const [confirmModal, setConfirmModal] = useState<{
    employee: Employee
    newRole: RoleLevel
  } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([meData, empData]) => {
      const me = meData.employee as MeData | null
      if (me) {
        setMyRole((me.roleLevel ?? "member") as RoleLevel)
        setMyId(me.id)
      }
      if (empData.employees) {
        setEmployees(empData.employees)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const isSuperAdmin = canAccess(myRole, "super_admin")
  const isAdmin = canAccess(myRole, "admin")

  // Redirect if not admin
  if (!loading && !isAdmin) {
    return (
      <div style={{ padding: "80px 32px", textAlign: "center" }}>
        <h2 style={{ color: TEXT_PRIMARY, fontSize: 20, marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: TEXT_SECONDARY, fontSize: 14 }}>You need admin access to view settings.</p>
      </div>
    )
  }

  const handleRoleChange = async () => {
    if (!confirmModal) return
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${confirmModal.employee.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleLevel: confirmModal.newRole }),
      })
      if (res.ok) {
        const data = await res.json()
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === confirmModal.employee.id
              ? { ...e, roleLevel: data.employee.roleLevel, isAdmin: data.employee.isAdmin }
              : e
          )
        )
      }
    } catch { /* silent */ }
    setSaving(false)
    setConfirmModal(null)
  }

  const tabs = [
    ...(isSuperAdmin ? [{ key: "roles" as const, label: "Roles" }] : []),
    { key: "general" as const, label: "General" },
  ]

  // If not super_admin, default to general tab
  const currentTab = !isSuperAdmin && activeTab === "roles" ? "general" : activeTab

  return (
    <>
      <PageHeader title="Settings" description="Manage roles, permissions and preferences" />

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: `1px solid ${CARD_BORDER}`,
          marginBottom: 24,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: currentTab === tab.key ? 600 : 400,
              color: currentTab === tab.key ? ROSE_GOLD : TEXT_SECONDARY,
              background: "none",
              border: "none",
              borderBottom: currentTab === tab.key ? `2px solid ${ROSE_GOLD}` : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Roles Tab */}
      {currentTab === "roles" && isSuperAdmin && (
        <div
          style={{
            background: CARD_BG,
            borderRadius: 12,
            border: `1px solid ${CARD_BORDER}`,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${CARD_BORDER}` }}>
            <h3 style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, margin: 0 }}>
              Role Management
            </h3>
            <p style={{ color: TEXT_TERTIARY, fontSize: 12, margin: "4px 0 0" }}>
              Assign roles to control access across the platform
            </p>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: TEXT_TERTIARY, fontSize: 13 }}>
              Loading...
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Employee", "Department", "Current Role", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 20px",
                        fontSize: 11,
                        fontWeight: 500,
                        color: TEXT_TERTIARY,
                        textAlign: "left",
                        borderBottom: `1px solid ${CARD_BORDER}`,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees
                  .sort((a, b) => {
                    const roleOrder = { super_admin: 0, admin: 1, manager: 2, member: 3 }
                    return (roleOrder[a.roleLevel as RoleLevel] ?? 3) - (roleOrder[b.roleLevel as RoleLevel] ?? 3)
                  })
                  .map((emp) => {
                  const empRole = (emp.roleLevel ?? "member") as RoleLevel
                  const roleColor = ROLE_COLORS[empRole]
                  const isSelf = emp.id === myId
                  return (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom: `1px solid ${CARD_BORDER}`,
                      }}
                    >
                      <td style={{ padding: "12px 20px" }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex items-center justify-center"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: getAvatarGradient(emp.avatarColor),
                              flexShrink: 0,
                            }}
                          >
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#fff" }}>
                              {emp.initials}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 500 }}>
                              {emp.name}
                              {isSelf && (
                                <span style={{ fontSize: 10, color: TEXT_TERTIARY, marginLeft: 6 }}>
                                  (you)
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: TEXT_TERTIARY }}>{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 20px", fontSize: 12, color: TEXT_SECONDARY }}>
                        {emp.department}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: roleColor.bg,
                            color: roleColor.text,
                          }}
                        >
                          {ROLE_LABELS[empRole]}
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        {isSelf ? (
                          <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>Cannot change own role</span>
                        ) : (
                          <select
                            value={empRole}
                            onChange={(e) => {
                              const newRole = e.target.value as RoleLevel
                              if (newRole !== empRole) {
                                setConfirmModal({ employee: emp, newRole })
                              }
                            }}
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: `1px solid ${CARD_BORDER}`,
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 11,
                              color: TEXT_PRIMARY,
                              cursor: "pointer",
                              outline: "none",
                            }}
                          >
                            {ROLE_LEVELS.map((rl) => (
                              <option key={rl} value={rl} style={{ background: "#1a1a2e" }}>
                                {ROLE_LABELS[rl]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* General Tab */}
      {currentTab === "general" && (
        <div
          style={{
            background: CARD_BG,
            borderRadius: 12,
            border: `1px solid ${CARD_BORDER}`,
            padding: 32,
          }}
        >
          <h3 style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            General Settings
          </h3>
          <p style={{ color: TEXT_TERTIARY, fontSize: 13 }}>
            Coming soon — timezone preferences, notification settings, and more.
          </p>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setConfirmModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12,
              padding: 24,
              width: 400,
              maxWidth: "90vw",
            }}
          >
            <h3 style={{ color: TEXT_PRIMARY, fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              Confirm Role Change
            </h3>
            <p style={{ color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Change <strong style={{ color: TEXT_PRIMARY }}>{confirmModal.employee.name}</strong> from{" "}
              <span style={{ color: ROLE_COLORS[(confirmModal.employee.roleLevel ?? "member") as RoleLevel].text }}>
                {ROLE_LABELS[(confirmModal.employee.roleLevel ?? "member") as RoleLevel]}
              </span>{" "}
              to{" "}
              <span style={{ color: ROLE_COLORS[confirmModal.newRole].text }}>
                {ROLE_LABELS[confirmModal.newRole]}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: "none",
                  color: TEXT_SECONDARY,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: ROSE_GOLD,
                  color: "#060709",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
