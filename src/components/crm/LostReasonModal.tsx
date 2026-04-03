"use client"

import { useState } from "react"
import { LOST_REASONS, CRM_COLORS } from "@/lib/crm-config"

/* ── Types ── */

interface DealRef {
  id: string
  dealName?: string
  name?: string
}

interface LostReasonModalProps {
  deal: DealRef
  onConfirm: (lostReason: string, lostNotes: string) => void
  onCancel: () => void
}

/* ── Styles ── */

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center",
}

const modalStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #0D0F14 0%, #0A0B0F 100%)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderTop: `2px solid ${CRM_COLORS.red}`,
  borderRadius: 16, padding: 28, width: 480,
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
  padding: "8px 12px", color: CRM_COLORS.text_primary, fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, textTransform: "uppercase",
  letterSpacing: 1, color: CRM_COLORS.text_tertiary,
  fontFamily: "'DM Sans', sans-serif", marginBottom: 4,
}

/* ── Component ── */

export default function LostReasonModal({ deal, onConfirm, onCancel }: LostReasonModalProps) {
  const [lostReason, setLostReason] = useState("")
  const [lostNotes, setLostNotes] = useState("")

  const dealName = deal.dealName || deal.name || "this deal"
  const canConfirm = lostReason.trim() !== "" && lostNotes.trim() !== ""

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slideUp" style={modalStyle}>
        {/* Warning icon + header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(248,113,113,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L18 17H2L10 2Z" stroke={CRM_COLORS.red} strokeWidth="1.5" fill="none" />
              <path d="M10 8V12" stroke={CRM_COLORS.red} strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="10" cy="14.5" r="0.75" fill={CRM_COLORS.red} />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: CRM_COLORS.text_primary }}>
              Mark as Lost
            </div>
            <div style={{ fontSize: 11, color: CRM_COLORS.text_secondary, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
              {dealName}
            </div>
          </div>
        </div>

        {/* Explanation */}
        <div style={{
          padding: "10px 14px", borderRadius: 8,
          background: "rgba(248,113,113,0.06)",
          border: "1px solid rgba(248,113,113,0.15)",
          fontSize: 11, color: CRM_COLORS.text_secondary,
          fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5,
          marginBottom: 18,
        }}>
          Please provide a reason and notes for closing this deal as lost. This information helps improve our sales process and forecasting accuracy.
        </div>

        {/* Lost Reason dropdown */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Lost Reason *</label>
          <select
            style={{
              ...inputStyle,
              borderColor: !lostReason ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.06)",
            }}
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
          >
            <option value="">Select a reason...</option>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Lost Notes textarea */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Lost Notes *</label>
          <textarea
            style={{
              ...inputStyle, minHeight: 90, resize: "vertical",
              borderColor: !lostNotes.trim() ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.06)",
            }}
            value={lostNotes}
            onChange={(e) => setLostNotes(e.target.value)}
            placeholder="Describe what happened, any feedback from the prospect, and lessons learned..."
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.06)", background: "transparent",
              color: CRM_COLORS.text_secondary, fontSize: 11,
              fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            }}>
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(lostReason, lostNotes)}
            disabled={!canConfirm}
            style={{
              padding: "8px 20px", borderRadius: 8, fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              background: canConfirm ? "rgba(248,113,113,0.2)" : "rgba(248,113,113,0.06)",
              border: `1px solid ${canConfirm ? CRM_COLORS.red : "rgba(248,113,113,0.15)"}`,
              color: canConfirm ? CRM_COLORS.red : "rgba(248,113,113,0.4)",
              cursor: canConfirm ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
            }}>
            Confirm Loss
          </button>
        </div>
      </div>
    </div>
  )
}
