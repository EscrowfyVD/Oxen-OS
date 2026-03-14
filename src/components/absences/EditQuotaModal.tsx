"use client"

import { useState } from "react"
import { CARD_BG, CARD_BORDER, TEXT_TERTIARY, FROST, GREEN, RED, INDIGO } from "./constants"
import type { LeaveBalance, Employee } from "./types"

interface EditQuotaModalProps {
  balance: LeaveBalance & { employee?: Employee }
  onClose: () => void
  onSave: (quotas: { vacationTotal: number; sickTotal: number; oooTotal: number }) => void
}

export default function EditQuotaModal({ balance, onClose, onSave }: EditQuotaModalProps) {
  const [quotaForm, setQuotaForm] = useState({
    vacationTotal: balance.vacationTotal,
    sickTotal: balance.sickTotal,
    oooTotal: balance.oooTotal,
  })

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slideUp"
        style={{ background: CARD_BG, borderRadius: 16, border: `1px solid ${CARD_BORDER}`, width: 360, padding: 24 }}
      >
        <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST, margin: "0 0 20px" }}>
          Edit Quotas - {balance.employee?.name}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Vacation Days", key: "vacationTotal" as const, color: GREEN },
            { label: "Sick Days", key: "sickTotal" as const, color: RED },
            { label: "OOO Days", key: "oooTotal" as const, color: INDIGO },
          ].map((item) => (
            <div key={item.key}>
              <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                {item.label}
              </label>
              <input
                className="oxen-input"
                type="number"
                value={quotaForm[item.key]}
                onChange={(e) => setQuotaForm({ ...quotaForm, [item.key]: parseInt(e.target.value) || 0 })}
                style={{ width: "100%", fontSize: 13 }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>Cancel</button>
          <button onClick={() => onSave(quotaForm)} className="btn-primary" style={{ padding: "8px 16px", fontSize: 11 }}>Save</button>
        </div>
      </div>
    </div>
  )
}
