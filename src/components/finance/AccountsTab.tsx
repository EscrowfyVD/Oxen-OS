"use client"

import { useState } from "react"
import {
  CARD_BG, CARD_BORDER, GLASS_BLUR, GLASS_HOVER_BORDER, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, ENTITIES, ACCOUNT_TYPES, fmtFull, labelStyle,
} from "./constants"
import type { BankAccount } from "./types"

interface AccountsTabProps {
  accounts: BankAccount[]
  onSave: (data: Partial<BankAccount> & { id?: string }) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}

const cardStyle: React.CSSProperties = {
  background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 24,
  backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR,
  boxShadow: GLASS_SHADOW,
}
const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8, padding: "8px 12px", color: TEXT_PRIMARY, fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}

const ACCOUNT_ICONS: Record<string, string> = {
  operating: "🏦", savings: "💰", escrow: "🔐", card: "💳",
}

export default function AccountsTab({ accounts, onSave, onDelete, onRefresh }: AccountsTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BankAccount | null>(null)
  const [form, setForm] = useState({
    name: "", bankName: "", currency: "EUR", iban: "", accountType: "operating",
    entity: "oxen", currentBalance: "", notes: "",
  })

  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0)
  const activeAccounts = accounts.filter((a) => a.isActive)

  const openEdit = (account: BankAccount) => {
    setEditing(account)
    setForm({
      name: account.name, bankName: account.bankName, currency: account.currency,
      iban: account.iban || "", accountType: account.accountType, entity: account.entity,
      currentBalance: String(account.currentBalance), notes: account.notes || "",
    })
    setShowForm(true)
  }

  const openNew = () => {
    setEditing(null)
    setForm({ name: "", bankName: "", currency: "EUR", iban: "", accountType: "operating", entity: "oxen", currentBalance: "", notes: "" })
    setShowForm(true)
  }

  const handleSave = () => {
    onSave({ ...form, currentBalance: form.currentBalance as unknown as number, id: editing?.id })
    setShowForm(false)
    setEditing(null)
  }

  // Group by entity
  const byEntity: Record<string, BankAccount[]> = {}
  for (const a of activeAccounts) {
    if (!byEntity[a.entity]) byEntity[a.entity] = []
    byEntity[a.entity].push(a)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
            {activeAccounts.length} active accounts
          </div>
          <div style={{ fontFamily: "'Bellfair', serif", fontSize: 28, color: TEXT_PRIMARY }}>
            {fmtFull(totalBalance)}
          </div>
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>Total balance across all accounts</div>
        </div>
        <button onClick={openNew} className="btn-primary" style={{ padding: "8px 16px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
          + Add Account
        </button>
      </div>

      {/* Account cards by entity */}
      {Object.entries(byEntity).map(([entityId, accts]) => {
        const entityLabel = ENTITIES.find((e) => e.id === entityId)?.label || entityId
        const entityTotal = accts.reduce((s, a) => s + a.currentBalance, 0)
        return (
          <div key={entityId} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontFamily: "'Bellfair', serif", color: TEXT_PRIMARY }}>{entityLabel}</div>
              <div style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", color: GREEN }}>{fmtFull(entityTotal)}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {accts.map((account) => (
                <div
                  key={account.id}
                  onClick={() => openEdit(account)}
                  className="account-card"
                  style={{ ...cardStyle, cursor: "pointer", transition: "all 0.2s ease", borderLeft: `3px solid rgba(192,139,136,0.2)` }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = GLASS_HOVER_BORDER; e.currentTarget.style.transform = "translateY(-2px)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = CARD_BORDER; e.currentTarget.style.borderLeftColor = "rgba(192,139,136,0.2)"; e.currentTarget.style.transform = "translateY(0)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{ACCOUNT_ICONS[account.accountType] || "🏦"}</span>
                      <div>
                        <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                          {account.name}
                        </div>
                        <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                          {account.bankName}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
                      background: "rgba(255,255,255,0.05)", color: TEXT_TERTIARY,
                    }}>
                      {account.accountType}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Bellfair', serif", fontSize: 24, color: TEXT_PRIMARY, marginBottom: 8 }}>
                    {account.currency === "EUR" ? "€" : account.currency + " "}{account.currentBalance.toLocaleString()}
                  </div>
                  {account.iban && (
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', monospace", letterSpacing: 0.5 }}>
                      {account.iban.replace(/(.{4})/g, "$1 ").trim()}
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: TEXT_TERTIARY, marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>
                    Updated {new Date(account.lastUpdated).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {activeAccounts.length === 0 && (
        <div className="empty-state" style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ width: 48, height: 48, margin: "0 auto 16px", borderRadius: 14, background: "linear-gradient(135deg, rgba(192,139,136,0.08), rgba(192,139,136,0.02))", border: "1px solid rgba(192,139,136,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, opacity: 0.6 }}>
            🏦
          </div>
          <div style={{ fontSize: 13, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
            No bank accounts yet — click <strong style={{ color: ROSE_GOLD }}>+ Add Account</strong> to get started
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setShowForm(false); setEditing(null) }}>
          <div onClick={(e) => e.stopPropagation()} className="modal-content animate-slideUp"
            style={{ background: "linear-gradient(180deg, #0D0F14 0%, #0A0B0F 100%)", border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 28, width: 460, maxHeight: "80vh", overflowY: "auto", borderTop: "1px solid rgba(192,139,136,0.15)", boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)" }}>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_PRIMARY, marginBottom: 20 }}>
              {editing ? "Edit Account" : "Add Bank Account"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Account Name *</label>
                <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Oxen Operating" />
              </div>
              <div>
                <label style={labelStyle}>Bank Name *</label>
                <input style={inputStyle} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Revolut Business" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Account Type</label>
                <select style={inputStyle} value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                  {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Entity</label>
                <select style={inputStyle} value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })}>
                  {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Currency</label>
                <select style={inputStyle} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="AED">AED</option>
                  <option value="CHF">CHF</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Current Balance</label>
                <input style={inputStyle} type="number" value={form.currentBalance} onChange={(e) => setForm({ ...form, currentBalance: e.target.value })} placeholder="0" />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>IBAN</label>
              <input style={inputStyle} value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="e.g. MT00 XXXX 0000 0000 0000 0000 0000 000" />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {editing && (
                  <button onClick={() => { onDelete(editing.id); setShowForm(false); setEditing(null) }}
                    style={{ background: "none", border: "none", color: "#F87171", cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                    Delete Account
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowForm(false); setEditing(null) }}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT_SECONDARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleSave} className="btn-primary"
                  disabled={!form.name || !form.bankName}
                  style={{ padding: "8px 20px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", opacity: !form.name || !form.bankName ? 0.5 : 1 }}>
                  {editing ? "Update" : "Add Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
