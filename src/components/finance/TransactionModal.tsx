"use client"

import { useState, useEffect } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN,
  REVENUE_CATEGORIES, EXPENSE_CATEGORIES, ENTITIES, PAYMENT_SOURCES, TX_STATUSES,
  labelStyle,
} from "./constants"
import type { FinanceTransaction } from "./types"

interface TransactionModalProps {
  transaction: FinanceTransaction | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8, padding: "8px 12px", color: TEXT_PRIMARY, fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}

export default function TransactionModal({ transaction, onClose, onSave }: TransactionModalProps) {
  const [form, setForm] = useState({
    type: "expense", category: "", description: "", amount: "", currency: "EUR",
    exchangeRate: "1", date: new Date().toISOString().split("T")[0], entity: "oxen",
    recurring: false, recurringPeriod: "", paymentSource: "", bankAccountName: "",
    reference: "", status: "confirmed", reimbursable: false, reimbursedTo: "",
    contactId: "", notes: "",
  })
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; company: string | null }>>([])

  useEffect(() => {
    if (transaction) {
      setForm({
        type: transaction.type,
        category: transaction.category,
        description: transaction.description || "",
        amount: String(transaction.amount),
        currency: transaction.currency,
        exchangeRate: String(transaction.exchangeRate || 1),
        date: new Date(transaction.date).toISOString().split("T")[0],
        entity: transaction.entity,
        recurring: transaction.recurring,
        recurringPeriod: transaction.recurringPeriod || "",
        paymentSource: transaction.paymentSource || "",
        bankAccountName: transaction.bankAccountName || "",
        reference: transaction.reference || "",
        status: transaction.status,
        reimbursable: transaction.reimbursable,
        reimbursedTo: transaction.reimbursedTo || "",
        contactId: transaction.contactId || "",
        notes: transaction.notes || "",
      })
    }
  }, [transaction])

  useEffect(() => {
    fetch("/api/contacts?limit=200")
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => {})
  }, [])

  const categories = form.type === "revenue" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES

  const handleSubmit = () => {
    if (!form.category || !form.amount || !form.date) return
    onSave(form)
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slideUp"
        style={{ background: "linear-gradient(180deg, #0D0F14 0%, #0A0B0F 100%)", border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 28, width: 540, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_PRIMARY, marginBottom: 20 }}>
          {transaction ? "Edit Transaction" : "Add Transaction"}
        </div>

        {/* Type + Category */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Type *</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["revenue", "expense"].map((t) => (
                <button key={t} onClick={() => setForm({ ...form, type: t, category: "" })}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${form.type === t ? (t === "revenue" ? GREEN : ROSE_GOLD) : CARD_BORDER}`,
                    background: form.type === t ? (t === "revenue" ? "rgba(52,211,153,0.1)" : "rgba(192,139,136,0.1)") : "transparent",
                    color: form.type === t ? (t === "revenue" ? GREEN : ROSE_GOLD) : TEXT_TERTIARY,
                    fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", textTransform: "capitalize",
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Category *</label>
            <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Select...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Description</label>
          <input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Monthly salary payment" />
        </div>

        {/* Amount + Currency + Rate */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Amount *</label>
            <input style={inputStyle} type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
          </div>
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
            <label style={labelStyle}>Exchange Rate</label>
            <input style={inputStyle} type="number" step="0.0001" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} />
          </div>
        </div>

        {/* Date + Entity + Status */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Date *</label>
            <input style={{ ...inputStyle, colorScheme: "dark" }} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Entity</label>
            <select style={inputStyle} value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })}>
              {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {TX_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Payment Source + Reference */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Payment Source</label>
            <select style={inputStyle} value={form.paymentSource} onChange={(e) => setForm({ ...form, paymentSource: e.target.value })}>
              <option value="">—</option>
              {PAYMENT_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Reference / Invoice #</label>
            <input style={inputStyle} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="INV-001" />
          </div>
        </div>

        {/* Contact */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Linked Contact (CRM)</label>
          <select style={inputStyle} value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
            <option value="">None</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
          </select>
        </div>

        {/* Toggles */}
        <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
            <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
            Recurring
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
            <input type="checkbox" checked={form.reimbursable} onChange={(e) => setForm({ ...form, reimbursable: e.target.checked })} />
            Reimbursable
          </label>
        </div>

        {form.recurring && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Recurring Period</label>
            <select style={inputStyle} value={form.recurringPeriod} onChange={(e) => setForm({ ...form, recurringPeriod: e.target.value })}>
              <option value="">Select...</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        )}

        {form.reimbursable && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Reimbursed To</label>
            <input style={inputStyle} value={form.reimbursedTo} onChange={(e) => setForm({ ...form, reimbursedTo: e.target.value })} placeholder="Employee name" />
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT_SECONDARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="btn-primary"
            disabled={!form.category || !form.amount || !form.date}
            style={{ padding: "8px 20px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", opacity: !form.category || !form.amount || !form.date ? 0.5 : 1 }}>
            {transaction ? "Update" : "Add Transaction"}
          </button>
        </div>
      </div>
    </div>
  )
}
