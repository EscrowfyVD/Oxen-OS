"use client"

import { useState, useEffect, useCallback } from "react"
const CARD_BORDER = "var(--border)"
const TEXT = "var(--text-primary)"
const TEXT2 = "var(--text-secondary)"
const TEXT3 = "var(--text-tertiary)"
const ROSE = "var(--rose-gold)"
const GREEN = "var(--green)"
const RED = "var(--red)"
const FONT = "'DM Sans', sans-serif"

// ── Sprint S0.6 hardening — chunking + retry tunables ───────────────
const CHUNK_SIZE = 25
const INTER_CHUNK_DELAY_MS = 1000
const MAX_RETRIES = 2
const RETRY_BACKOFF_MS = [2000, 5000] as const
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
  // Sprint S0.6 — when mode="all", these filters are forwarded to
  // /api/crm/contacts/list-for-push so the bulk push covers EVERY
  // filtered contact instead of just the page-50 currently rendered.
  // Pass the same Record<string,string> the parent uses for
  // /api/crm/contacts pagination calls.
  filters?: Record<string, string>
}

export default function PushToLemlistModal({
  contacts,
  onClose,
  onComplete,
  mode,
  totalFilteredCount,
  filters,
}: PushToLemlistModalProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState("")
  const [skipEnrolled, setSkipEnrolled] = useState(true)
  const [pushing, setPushing] = useState(false)
  const [progress, setProgress] = useState(0)
  // Sprint S0.6 — real-time counters surfaced in the progress UI.
  // Replaces the previous single % number which didn't tell the
  // operator how many had succeeded vs failed mid-flight.
  const [progressStats, setProgressStats] = useState<{
    processed: number
    succeeded: number
    failed: number
    total: number
    phase: "idle" | "fetching" | "pushing"
  }>({ processed: 0, succeeded: 0, failed: 0, total: 0, phase: "idle" })
  const [result, setResult] = useState<PushResult | null>(null)
  // Sprint S0.6 — surface fetch-phase errors (filter too broad, network)
  // in-modal so we don't silently abort.
  const [fetchError, setFetchError] = useState<string | null>(null)

  const contactCount = contacts.length
  // Sprint S0.6.1 — single source of truth for the count we display
  // anywhere in the modal (header copy, confirmation banner, action
  // button). Pre-S0.6.1 the button label drifted from the body copy
  // because three different render sites picked different sources;
  // unifying here prevents future drift.
  //
  // mode="all" : show the total filtered count from the parent (or
  //              fall back to the prop array length if the parent
  //              didn't pass it). The actual push fetches the full
  //              list from /api/crm/contacts/list-for-push at click
  //              time, so this is the count the operator should see.
  // mode="selected" : the prop array IS the selection — count it.
  const displayCount =
    mode === "all" ? (totalFilteredCount ?? contactCount) : contactCount

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

  // ── Sprint S0.6 — single attempt against /api/lemlist/enroll, with
  // retry-on-5xx handled by the outer chunk loop (not in here). Returns
  // a discriminated result so the loop can categorize. ──────────────
  const enrollOne = useCallback(
    async (
      contact: PushContact,
    ): Promise<
      | { kind: "pushed" }
      | { kind: "skipped"; reason: string }
      | { kind: "failed"; reason: string; transient: boolean }
    > => {
      try {
        const res = await fetch("/api/lemlist/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: contact.id,
            campaignId: selectedCampaign,
          }),
        })
        if (res.ok) return { kind: "pushed" }

        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        const reason = err.error || `HTTP ${res.status}`

        if (
          skipEnrolled &&
          (reason.includes("already") || reason.includes("409") || res.status === 409)
        ) {
          return { kind: "skipped", reason: "Already enrolled" }
        }
        // 5xx → transient (retry candidate). 4xx → permanent (no retry).
        return { kind: "failed", reason, transient: res.status >= 500 }
      } catch {
        // Network error / fetch threw — treat as transient (retry).
        return { kind: "failed", reason: "Network error", transient: true }
      }
    },
    [selectedCampaign, skipEnrolled],
  )

  const handlePush = useCallback(async () => {
    if (!selectedCampaign) return
    setPushing(true)
    setProgress(0)
    setFetchError(null)

    // ── Sprint S0.6 fix #1 — Pre-fetch the full filtered list when
    // mode="all" so we push EVERY matched contact, not just the
    // page-50 the parent rendered. mode="selected" keeps the
    // existing behavior (use the contacts prop directly). ───────────
    let workingList: PushContact[] = contacts
    if (mode === "all") {
      setProgressStats({
        processed: 0,
        succeeded: 0,
        failed: 0,
        total: 0,
        phase: "fetching",
      })
      try {
        const params = new URLSearchParams(filters ?? {})
        const url = `/api/crm/contacts/list-for-push?${params.toString()}`
        const res = await fetch(url)
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Fetch failed" }))
          const msg =
            body.error === "Filter too broad"
              ? `Filter too broad (${body.details?.total ?? "?"} contacts match, max ${body.details?.cap ?? 5000}). Please narrow the filter and try again.`
              : (body.error as string) || "Failed to load filtered contacts"
          setFetchError(msg)
          setPushing(false)
          setProgressStats((s) => ({ ...s, phase: "idle" }))
          return
        }
        const data: { contacts: PushContact[]; total: number } = await res.json()
        workingList = data.contacts
      } catch {
        setFetchError("Network error while loading contacts. Please retry.")
        setPushing(false)
        setProgressStats((s) => ({ ...s, phase: "idle" }))
        return
      }
    }

    // Pre-filter eligibility (email + doNotContact). Server already
    // filtered for mode="all", but mode="selected" passes raw selected
    // contacts which may include ineligible rows.
    const eligible = workingList.filter((c) => c.email && !c.doNotContact)
    const total = eligible.length
    let pushed = 0
    let skipped = 0
    let failed = 0
    const details: PushResult["details"] = []

    // Skip ineligible (only relevant for mode="selected" — server
    // already excludes these for mode="all").
    workingList.forEach((c) => {
      if (!c.email) {
        skipped++
        details.push({ email: "(no email)", status: "skipped", reason: "No email address" })
      } else if (c.doNotContact) {
        skipped++
        details.push({ email: c.email, status: "skipped", reason: "Do Not Contact" })
      }
    })

    setProgressStats({
      processed: 0,
      succeeded: 0,
      failed: 0,
      total,
      phase: "pushing",
    })

    // ── Sprint S0.6 fix #3 — chunked + retry-aware enroll loop. ───
    let processed = 0
    for (let chunkStart = 0; chunkStart < eligible.length; chunkStart += CHUNK_SIZE) {
      const chunk = eligible.slice(chunkStart, chunkStart + CHUNK_SIZE)
      for (const contact of chunk) {
        let attempt = 0
        let outcome = await enrollOne(contact)
        while (outcome.kind === "failed" && outcome.transient && attempt < MAX_RETRIES) {
          await sleep(RETRY_BACKOFF_MS[attempt])
          attempt++
          outcome = await enrollOne(contact)
        }

        if (outcome.kind === "pushed") {
          pushed++
          details.push({ email: contact.email!, status: "pushed" })
        } else if (outcome.kind === "skipped") {
          skipped++
          details.push({ email: contact.email!, status: "skipped", reason: outcome.reason })
        } else {
          failed++
          details.push({ email: contact.email!, status: "failed", reason: outcome.reason })
        }

        processed++
        setProgress(total > 0 ? Math.round((processed / total) * 100) : 100)
        setProgressStats({
          processed,
          succeeded: pushed,
          failed,
          total,
          phase: "pushing",
        })
      }
      // Inter-chunk breather to avoid hammering Lemlist API.
      if (chunkStart + CHUNK_SIZE < eligible.length) {
        await sleep(INTER_CHUNK_DELAY_MS)
      }
    }

    setResult({ pushed, skipped, failed, details })
    setProgressStats((s) => ({ ...s, phase: "idle" }))
    setPushing(false)
  }, [contacts, mode, filters, selectedCampaign, enrollOne])

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
    boxShadow: "0 24px 80px rgba(0,0,0,0.5)", color: "var(--text-primary)",
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
            /* ── Progress (Sprint S0.6 — real-time counters) ── */
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ width: "100%", height: 8, background: "var(--surface-input)", borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ width: `${progress}%`, height: "100%", background: `linear-gradient(90deg, ${ROSE}, ${GREEN})`, borderRadius: 4, transition: "width 0.3s ease" }} />
              </div>
              {progressStats.phase === "fetching" ? (
                <p style={{ fontSize: 13, fontFamily: FONT, color: TEXT2 }}>
                  Loading filtered contacts…
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 13, fontFamily: FONT, color: TEXT2, margin: 0 }}>
                    {progressStats.processed} / {progressStats.total} processed
                    {" — "}{progress}%
                  </p>
                  <p style={{ fontSize: 11, fontFamily: FONT, color: TEXT3, margin: "4px 0 0" }}>
                    <span style={{ color: GREEN }}>{progressStats.succeeded} succeeded</span>
                    {progressStats.failed > 0 && (
                      <>
                        {" · "}
                        <span style={{ color: RED }}>{progressStats.failed} failed</span>
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          ) : fetchError ? (
            /* ── Fetch-phase error (Sprint S0.6 — surfaces filter-too-broad / network) ── */
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{"⚠️"}</div>
              <p style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: TEXT, margin: "0 0 12px" }}>
                Cannot push
              </p>
              <p style={{ fontSize: 13, fontFamily: FONT, color: RED, margin: "0 0 20px", padding: "0 24px" }}>
                {fetchError}
              </p>
              <button
                onClick={() => { setFetchError(null) }}
                style={btnPrimary}
              >
                Back
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <p style={{ fontFamily: FONT, fontSize: 13, color: TEXT2, margin: "0 0 20px" }}>
                {mode === "selected"
                  ? `Push ${displayCount} selected contact${displayCount !== 1 ? "s" : ""} to a Lemlist campaign.`
                  : `Push all ${displayCount} filtered contacts to a Lemlist campaign.`}
              </p>

              {mode === "all" && (
                <div style={{ background: `${ROSE}12`, border: `1px solid ${ROSE}30`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontFamily: FONT, color: ROSE, margin: 0, fontWeight: 500 }}>
                    This will push {displayCount} contacts to the selected Lemlist campaign.
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
              Push {displayCount} Contact{displayCount !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
