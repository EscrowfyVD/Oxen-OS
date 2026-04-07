"use client"

import { useState, useEffect, useCallback } from "react"
import { CRM_COLORS } from "@/lib/crm-config"

const CARD_BORDER = CRM_COLORS.card_border
const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold
const GREEN = CRM_COLORS.green
const RED = CRM_COLORS.red
const FONT = "'DM Sans', sans-serif"

interface Campaign {
  id: string
  name: string
  labels: string[]
  sendingAddress: string
}

interface PushContact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  doNotContact?: boolean
}

interface PushResult {
  pushed: number
  skipped: number
  failed: number
  details: { email: string; status: "pushed" | "skipped" | "failed"; reason?: string }[]
}

interface PushToLemlistModalProps {
  contacts: PushContact[]
  onClose: () => void
  onComplete: () => void
  mode: "selected" | "all"
  totalFilteredCount?: number
}

export default function PushToLemlistModal({
  contacts,
  onClose,
  onComplete,
  mode,
  totalFilteredCount,
}: PushToLemlistModalProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState("")
  const [skipEnrolled, setSkipEnrolled] = useState(true)
  const [pushing, setPushing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<PushResult | null>(null)

  const contactCount = contacts.length

  useEffect(() => {
    fetch("/api/lemlist/campaigns")
      .then((r) => r.json())
      .then((d) => {
        setCampaigns(d.campaigns || [])
        if (d.campaigns?.length === 1) setSelectedCampaign(d.campaigns[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingCampaigns(false))
  }, [])

  const handlePush = useCallback(async () => {
    if (!selectedCampaign) return
    setPushing(true)
    setProgress(0)

    const eligible = contacts.filter((c) => c.email && !c.doNotContact)
    const total = eligible.length
    let pushed = 0
    let skipped = 0
    let failed = 0
    const details: PushResult["details"] = []

    // Skip contacts without email or with doNotContact
    contacts.forEach((c) => {
      if (!c.email) {
        skipped++
        details.push({ email: "(no email)", status: "skipped", reason: "No email address" })
      } else if (c.doNotContact) {
        skipped++
        details.push({ email: c.email, status: "skipped", reason: "Do Not Contact" })
      }
    })

    for (let i = 0; i < eligible.length; i++) {
      const contact = eligible[i]
      setProgress(Math.round(((i + 1) / total) * 100))

      try {
        const res = await fetch("/api/lemlist/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: contact.id,
            campaignId: selectedCampaign,
          }),
        })

        if (res.ok) {
          pushed++
          details.push({ email: contact.email!, status: "pushed" })
        } else {
          const err = await res.json().catch(() => ({ error: "Unknown error" }))
          const reason = err.error || `HTTP ${res.status}`
          if (
            skipEnrolled &&
            (reason.includes("already") || reason.includes("409") || res.status === 409)
          ) {
            skipped++
            details.push({ email: contact.email!, status: "skipped", reason: "Already enrolled" })
          } else {
            failed++
            details.push({ email: contact.email!, status: "failed", reason })
          }
        }
      } catch {
        failed++
        details.push({ email: contact.email!, status: "failed", reason: "Network error" })
      }
    }

    setResult({ pushed, skipped, failed, details })
    setPushing(false)
  }, [contacts, selectedCampaign, skipEnrolled])

  /* ── Styles ── */
  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
  }

  const modalStyle: React.CSSProperties = {
    background: "var(--card-bg-solid)", border: `1px solid ${CARD_BORDER}`,
    borderRadius: 16, width: "min(94vw, 520px)", maxHeight: "85vh",
    display: "flex", flexDirection: "column", overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
  }

  const btnPrimary: React.CSSProperties = {
    padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    fontFamily: FONT, cursor: "pointer", border: "none",
    background: `linear-gradient(135deg, ${ROSE}, #A07070)`, color: "#fff",
    transition: "opacity 0.15s",
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontFamily: "'Bellfair', serif", fontSize: 20, fontWeight: 400, color: TEXT, margin: 0 }}>
              Push to Lemlist
            </h2>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: TEXT3, fontSize: 18, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}
            >
              {"\u2715"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto" }}>
          {result ? (
            /* ── Results ── */
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{result.failed === 0 ? "\u2705" : "\u26A0\uFE0F"}</div>
              <p style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT, margin: "0 0 16px" }}>
                Push Complete
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 20 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: GREEN, fontFamily: "'Bellfair', serif" }}>{result.pushed}</div>
                  <div style={{ fontSize: 11, color: TEXT3, fontFamily: FONT }}>Pushed</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: TEXT3, fontFamily: "'Bellfair', serif" }}>{result.skipped}</div>
                  <div style={{ fontSize: 11, color: TEXT3, fontFamily: FONT }}>Skipped</div>
                </div>
                {result.failed > 0 && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: RED, fontFamily: "'Bellfair', serif" }}>{result.failed}</div>
                    <div style={{ fontSize: 11, color: TEXT3, fontFamily: FONT }}>Failed</div>
                  </div>
                )}
              </div>

              {/* Detail list */}
              {result.details.filter((d) => d.status !== "pushed").length > 0 && (
                <div style={{ maxHeight: 200, overflowY: "auto", textAlign: "left", background: "var(--surface-subtle)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  {result.details
                    .filter((d) => d.status !== "pushed")
                    .map((d, i) => (
                      <div key={i} style={{ fontSize: 11, fontFamily: FONT, color: d.status === "failed" ? RED : TEXT3, padding: "3px 0" }}>
                        {d.email} — {d.reason}
                      </div>
                    ))}
                </div>
              )}

              <button
                onClick={() => { onComplete(); onClose() }}
                style={btnPrimary}
              >
                Done
              </button>
            </div>
          ) : pushing ? (
            /* ── Progress ── */
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ width: "100%", height: 8, background: "var(--surface-input)", borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ width: `${progress}%`, height: "100%", background: `linear-gradient(90deg, ${ROSE}, ${GREEN})`, borderRadius: 4, transition: "width 0.3s ease" }} />
              </div>
              <p style={{ fontSize: 13, fontFamily: FONT, color: TEXT2 }}>
                Pushing contacts to Lemlist... {progress}%
              </p>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <p style={{ fontFamily: FONT, fontSize: 13, color: TEXT2, margin: "0 0 20px" }}>
                {mode === "selected"
                  ? `Push ${contactCount} selected contact${contactCount !== 1 ? "s" : ""} to a Lemlist campaign.`
                  : `Push all ${totalFilteredCount ?? contactCount} filtered contacts to a Lemlist campaign.`}
              </p>

              {mode === "all" && (
                <div style={{ background: `${ROSE}12`, border: `1px solid ${ROSE}30`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontFamily: FONT, color: ROSE, margin: 0, fontWeight: 500 }}>
                    This will push {totalFilteredCount ?? contactCount} contacts to the selected Lemlist campaign.
                  </p>
                </div>
              )}

              {/* Campaign dropdown */}
              <label style={{ display: "block", fontSize: 11, fontFamily: FONT, color: TEXT3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, fontWeight: 500 }}>
                Campaign
              </label>
              {loadingCampaigns ? (
                <div style={{ fontSize: 12, color: TEXT3, fontFamily: FONT, padding: "8px 0" }}>Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div style={{ fontSize: 12, color: RED, fontFamily: FONT, padding: "8px 0" }}>No campaigns found. Check Lemlist API key.</div>
              ) : (
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", background: "var(--surface-input)",
                    border: `1px solid ${CARD_BORDER}`, borderRadius: 10, color: TEXT,
                    fontSize: 13, fontFamily: FONT, marginBottom: 16,
                  }}
                >
                  <option value="">Select a campaign...</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              {/* Skip enrolled checkbox */}
              <label
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 8, padding: "8px 0" }}
                onClick={() => setSkipEnrolled(!skipEnrolled)}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: `1.5px solid ${skipEnrolled ? ROSE : CARD_BORDER}`,
                  background: skipEnrolled ? `${ROSE}22` : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s", flexShrink: 0,
                }}>
                  {skipEnrolled && <span style={{ fontSize: 11, color: ROSE, fontWeight: 700, lineHeight: 1 }}>{"\u2713"}</span>}
                </div>
                <span style={{ fontSize: 13, fontFamily: FONT, color: TEXT2 }}>
                  Only push contacts not already in a Lemlist sequence
                </span>
              </label>
            </>
          )}
        </div>

        {/* Footer */}
        {!result && !pushing && (
          <div style={{ padding: "16px 24px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={onClose}
              style={{ padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: FONT, cursor: "pointer", border: `1px solid ${CARD_BORDER}`, background: "var(--surface-input)", color: TEXT2 }}
            >
              Cancel
            </button>
            <button
              onClick={handlePush}
              disabled={!selectedCampaign || loadingCampaigns}
              style={{
                ...btnPrimary,
                opacity: !selectedCampaign || loadingCampaigns ? 0.5 : 1,
                cursor: !selectedCampaign || loadingCampaigns ? "not-allowed" : "pointer",
              }}
            >
              Push {contactCount} Contact{contactCount !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
