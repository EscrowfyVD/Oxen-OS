"use client"

import { useState } from "react"
import { CARD_BG, CARD_BORDER, TEXT_SECONDARY, TEXT_TERTIARY, FROST, RED, AMBER, ROSE_GOLD, LEAVE_COLORS, LEAVE_LABELS } from "./constants"
import { calculateBusinessDays, formatShortDate } from "./helpers"
import type { LeaveBalance, LeaveRules, BlackoutPeriod } from "./types"

interface RequestLeaveModalProps {
  onClose: () => void
  onSaved: () => void
  balance: LeaveBalance | null
  rules: LeaveRules | null
}

export default function RequestLeaveModal({ onClose, onSaved, balance, rules }: RequestLeaveModalProps) {
  const [type, setType] = useState("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [halfDay, setHalfDay] = useState(false)
  const [halfDayPeriod, setHalfDayPeriod] = useState("morning")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const calculatedDays = startDate && endDate
    ? calculateBusinessDays(new Date(startDate), new Date(endDate), halfDay)
    : 0

  const remaining = balance
    ? type === "vacation" ? balance.vacationTotal - balance.vacationUsed - balance.vacationPending
    : type === "sick" ? balance.sickTotal - balance.sickUsed
    : balance.oooTotal - balance.oooUsed
    : 0

  const isOverLimit = calculatedDays > remaining

  // Rule-based warnings (non-blocking)
  const warnings: string[] = []

  if (rules && startDate) {
    const start = new Date(startDate)
    const today = new Date()
    const daysNotice = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Notice warning
    if (type === "vacation" && daysNotice < rules.vacationMinNotice) {
      warnings.push(`Less than ${rules.vacationMinNotice} days notice (policy requires ${rules.vacationMinNotice} days)`)
    }
    if (type === "ooo" && daysNotice < rules.oooMinNotice) {
      warnings.push(`Less than ${rules.oooMinNotice} days notice (policy requires ${rules.oooMinNotice} days)`)
    }

    // Max consecutive warning
    if (type === "vacation" && calculatedDays > rules.vacationMaxConsecutive) {
      warnings.push(`Exceeds max ${rules.vacationMaxConsecutive} consecutive vacation days`)
    }

    // Blackout period warning
    if (startDate && endDate && Array.isArray(rules.blackoutPeriods)) {
      const reqStart = new Date(startDate)
      const reqEnd = new Date(endDate)
      reqStart.setHours(0, 0, 0, 0)
      reqEnd.setHours(23, 59, 59, 999)

      for (const bp of rules.blackoutPeriods) {
        const bpStart = new Date(bp.startDate)
        const bpEnd = new Date(bp.endDate)
        bpStart.setHours(0, 0, 0, 0)
        bpEnd.setHours(23, 59, 59, 999)

        if (reqStart <= bpEnd && reqEnd >= bpStart) {
          warnings.push(`Falls within "${bp.reason}" blackout period (${formatShortDate(bp.startDate)} - ${formatShortDate(bp.endDate)})`)
        }
      }
    }
  }

  const handleSubmit = async () => {
    if (!startDate || !endDate) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, startDate, endDate, halfDay, halfDayPeriod: halfDay ? halfDayPeriod : null, reason: reason || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to submit request")
        setSubmitting(false)
        return
      }
      onSaved()
    } catch {
      setError("Failed to submit request")
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slideUp"
        style={{ background: CARD_BG, borderRadius: 16, border: `1px solid ${CARD_BORDER}`, width: 440, maxHeight: "80vh", overflow: "auto" }}
      >
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: FROST, margin: 0 }}>Request Leave</h3>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Type selector */}
          <div>
            <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
              Leave Type
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["vacation", "sick", "ooo"] as const).map((t) => {
                const lc = LEAVE_COLORS[t]
                const active = type === t
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 11, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                      background: active ? lc.bg : "rgba(255,255,255,0.02)",
                      border: active ? `1px solid ${lc.text}30` : `1px solid ${CARD_BORDER}`,
                      color: active ? lc.text : TEXT_TERTIARY,
                      transition: "all 0.15s",
                    }}
                  >
                    {LEAVE_LABELS[t]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date pickers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                Start Date
              </label>
              <input
                className="oxen-input"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
                style={{ width: "100%", fontSize: 12, colorScheme: "dark" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
                End Date
              </label>
              <input
                className="oxen-input"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%", fontSize: 12, colorScheme: "dark" }}
              />
            </div>
          </div>

          {/* Half day toggle */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} style={{ accentColor: ROSE_GOLD }} />
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>Half day</span>
            </label>
            {halfDay && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, marginLeft: 24 }}>
                {(["morning", "afternoon"] as const).map((p) => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input type="radio" checked={halfDayPeriod === p} onChange={() => setHalfDayPeriod(p)} style={{ accentColor: ROSE_GOLD }} />
                    <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>{p}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Duration display */}
          {calculatedDays > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>Duration</span>
              <span style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST }}>
                {calculatedDays} day{calculatedDays !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Balance warning (amber, non-blocking) */}
          {isOverLimit && (
            <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: AMBER, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, marginBottom: 4 }}>
                Exceeds balance by {calculatedDays - remaining} day{(calculatedDays - remaining) !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                Total: {balance ? (type === "vacation" ? balance.vacationTotal : type === "sick" ? balance.sickTotal : balance.oooTotal) : 0} | Used: {balance ? (type === "vacation" ? balance.vacationUsed : type === "sick" ? balance.sickUsed : balance.oooUsed) : 0} | {type === "vacation" ? `Pending: ${balance?.vacationPending ?? 0} | ` : ""}Available: {remaining} | Requesting: {calculatedDays}
              </div>
            </div>
          )}

          {/* Rule warnings (amber, non-blocking) */}
          {warnings.map((w, i) => (
            <div key={i} style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 8, padding: "8px 14px" }}>
              <span style={{ fontSize: 10, color: AMBER, fontFamily: "'DM Sans', sans-serif" }}>
                {w}
              </span>
            </div>
          ))}

          {/* Reason */}
          <div>
            <label style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>
              Reason (optional)
            </label>
            <textarea
              className="oxen-input"
              placeholder="Brief reason for your leave..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={{ width: "100%", fontSize: 12, resize: "vertical" }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 11, color: RED, fontFamily: "'DM Sans', sans-serif" }}>{error}</div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 18px", fontSize: 11 }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!startDate || !endDate || submitting}
            className="btn-primary"
            style={{ padding: "8px 18px", fontSize: 11, opacity: (!startDate || !endDate || submitting) ? 0.5 : 1 }}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  )
}
