"use client"

import { useState, useEffect, useCallback } from "react"
import { ShieldCheck, Plus, X, Loader2, ChevronDown, ChevronRight, Upload, FileText, ExternalLink } from "lucide-react"

/* ── Design tokens ── */
const VOID = "var(--void)"
const CARD_BG = "var(--card-bg)"
const CARD_BORDER = "var(--card-border)"
const TEXT_PRIMARY = "var(--text-primary)"
const TEXT_SECONDARY = "var(--text-secondary)"
const TEXT_TERTIARY = "var(--text-tertiary)"
const ROSE_GOLD = "#C08B88"

/* ── Types ── */
interface Finding {
  rule: string
  status: "pass" | "warning" | "fail"
  detail: string
  suggestion: string
}

interface ComplianceCheck {
  id: string
  contentIdeaId: string | null
  contentIdea?: { id: string; title: string } | null
  platform: string
  contentType: string
  contentText: string
  imageUrl: string | null
  targetAudience: string | null
  jurisdictions: string[]
  status: string
  overallRisk: string | null
  score: number | null
  findings: Finding[] | null
  summary: string | null
  checkedAt: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  sourceType: string | null
  sourceFileName: string | null
  createdBy: string
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  pending: { label: "Pending", color: "#9CA3AF", bg: "rgba(156,163,175,0.15)", emoji: "⏳" },
  checking: { label: "Checking...", color: "#60A5FA", bg: "rgba(96,165,250,0.15)", emoji: "🔄" },
  approved: { label: "Approved", color: "#34D399", bg: "rgba(52,211,153,0.15)", emoji: "✅" },
  needs_changes: { label: "Needs Changes", color: "#FBBF24", bg: "rgba(251,191,36,0.15)", emoji: "⚠️" },
  rejected: { label: "Rejected", color: "#EF4444", bg: "rgba(239,68,68,0.15)", emoji: "❌" },
}

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter / X" },
  { value: "telegram", label: "Telegram" },
  { value: "website", label: "Website" },
  { value: "email", label: "Email" },
]

const CONTENT_TYPES = [
  { value: "post", label: "Post" },
  { value: "story", label: "Story" },
  { value: "ad", label: "Ad" },
  { value: "email", label: "Email" },
  { value: "landing_page", label: "Landing Page" },
  { value: "video_script", label: "Video Script" },
]

const AUDIENCES = [
  { value: "B2B EU", label: "B2B EU" },
  { value: "B2B UAE", label: "B2B UAE" },
  { value: "B2B Global", label: "B2B Global" },
  { value: "Retail EU", label: "Retail EU" },
  { value: "Retail UAE", label: "Retail UAE" },
  { value: "Professional Investors", label: "Professional Investors" },
]

const JURISDICTIONS = [
  { value: "EU", label: "EU / MiCA" },
  { value: "UK", label: "UK / FCA FinProm" },
  { value: "UAE", label: "UAE / CBUAE" },
  { value: "Switzerland", label: "Switzerland / FINMA" },
  { value: "Malta", label: "Malta / MFSA" },
  { value: "Global", label: "Global" },
]

/* ── Shared styles ── */
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 6,
  padding: "8px 12px",
  color: TEXT_PRIMARY,
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  width: "100%",
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 28,
}

/* ── Score Ring ── */
function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 90 ? "#34D399" : score >= 70 ? "#FBBF24" : "#EF4444"

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontFamily: "'Bellfair', serif", fontSize: size * 0.35, color, fontWeight: 400, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1 }}>Score</span>
      </div>
    </div>
  )
}

/* ── Finding Card ── */
function FindingCard({ finding }: { finding: Finding }) {
  const isPass = finding.status === "pass"
  const [expanded, setExpanded] = useState(!isPass)

  const statusConfig = {
    pass: { color: "#34D399", bg: "rgba(52,211,153,0.1)", emoji: "✅", label: "Pass" },
    warning: { color: "#FBBF24", bg: "rgba(251,191,36,0.1)", emoji: "⚠️", label: "Warning" },
    fail: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", emoji: "❌", label: "Fail" },
  }[finding.status] || { color: TEXT_TERTIARY, bg: "transparent", emoji: "•", label: finding.status }

  return (
    <div style={{
      background: statusConfig.bg,
      border: `1px solid ${finding.status === "fail" ? "rgba(239,68,68,0.3)" : finding.status === "warning" ? "rgba(251,191,36,0.2)" : CARD_BORDER}`,
      borderRadius: 8, overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        {expanded ? <ChevronDown size={14} color={TEXT_TERTIARY} /> : <ChevronRight size={14} color={TEXT_TERTIARY} />}
        <span style={{ fontSize: 13, fontWeight: 600, color: statusConfig.color, minWidth: 60 }}>
          {statusConfig.emoji} {statusConfig.label}
        </span>
        <span style={{ fontSize: 13, color: TEXT_PRIMARY, flex: 1 }}>{finding.rule}</span>
      </button>
      {expanded && (
        <div style={{ padding: "0 14px 12px 38px", display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.5 }}>{finding.detail}</p>
          {finding.suggestion && finding.status !== "pass" && (
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "8px 10px",
              borderLeft: `3px solid ${statusConfig.color}`,
            }}>
              <span style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 3 }}>
                Suggestion
              </span>
              <p style={{ fontSize: 12, color: TEXT_PRIMARY, margin: 0, lineHeight: 1.5 }}>{finding.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   CHECK NEW CONTENT MODAL
   ══════════════════════════════════════════════════ */
function CheckModal({
  onClose,
  onSuccess,
  prefill,
}: {
  onClose: () => void
  onSuccess: () => void
  prefill?: { platform?: string; contentText?: string; contentIdeaId?: string }
}) {
  const [step, setStep] = useState<"input" | "results">("input")
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ComplianceCheck | null>(null)

  // Form state
  const [platform, setPlatform] = useState(prefill?.platform || "linkedin")
  const [contentType, setContentType] = useState("post")
  const [contentText, setContentText] = useState(prefill?.contentText || "")
  const [imageDesc, setImageDesc] = useState("")
  const [targetAudience, setTargetAudience] = useState("B2B EU")
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>(["EU", "Switzerland"])
  const [sourceType, setSourceType] = useState<string>(prefill?.contentIdeaId ? "content_idea" : "text")
  const [sourceFileName, setSourceFileName] = useState<string>("")

  const toggleJurisdiction = (val: string) => {
    setSelectedJurisdictions((prev) =>
      prev.includes(val) ? prev.filter((j) => j !== val) : [...prev, val]
    )
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSourceFileName(file.name)
    setSourceType("file_upload")

    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setContentText((ev.target?.result as string) || "")
      }
      reader.readAsText(file)
    } else {
      // For PDFs and images, prompt user to describe
      setContentText(`[Content loaded from: ${file.name}]\n\n`)
    }
  }

  const handleLoadFromDrive = async () => {
    // Open a simple prompt for Drive file ID for now
    const fileId = prompt("Paste the Google Drive file ID:")
    if (!fileId) return
    try {
      const res = await fetch(`/api/drive/read/${fileId}`)
      if (!res.ok) throw new Error("Failed to read")
      const data = await res.json()
      setContentText(data.content || "")
      setSourceType("google_drive")
      setSourceFileName(data.fileName || fileId)
    } catch {
      alert("Could not read from Google Drive. Check the file ID and permissions.")
    }
  }

  const runCheck = async () => {
    if (!contentText.trim()) return
    setChecking(true)
    try {
      const res = await fetch("/api/marketing/compliance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentIdeaId: prefill?.contentIdeaId || null,
          platform,
          contentType,
          contentText,
          imageUrl: imageDesc || null,
          targetAudience,
          jurisdictions: selectedJurisdictions,
          sourceType,
          sourceFileName: sourceFileName || null,
        }),
      })
      if (!res.ok) throw new Error("Check failed")
      const data = await res.json()
      setResult(data.check)
      setStep("results")
      onSuccess()
    } catch {
      alert("Compliance check failed. Please try again.")
    } finally {
      setChecking(false)
    }
  }

  const findings = (result?.findings || []) as Finding[]
  const failCount = findings.filter((f) => f.status === "fail").length
  const warnCount = findings.filter((f) => f.status === "warning").length
  const passCount = findings.filter((f) => f.status === "pass").length

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}`,
          background: "rgba(192,139,136,0.03)", position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck size={20} color={ROSE_GOLD} />
            <h3 style={{ fontFamily: "'Bellfair', serif", fontSize: 18, fontWeight: 400, color: TEXT_PRIMARY, margin: 0 }}>
              {step === "input" ? "Check New Content" : "Compliance Results"}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {step === "input" ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Platform + Content Type */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Platform *</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={selectStyle}>
                  {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Content Type *</label>
                <select value={contentType} onChange={(e) => setContentType(e.target.value)} style={selectStyle}>
                  {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Content Text */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.04em" }}>Content Text *</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <label style={{
                    fontSize: 11, color: ROSE_GOLD, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", borderRadius: 4, background: "rgba(192,139,136,0.1)",
                  }}>
                    <Upload size={12} /> Upload File
                    <input type="file" accept=".txt,.pdf,.docx,.png,.jpg" onChange={handleFileUpload} style={{ display: "none" }} />
                  </label>
                  <button
                    onClick={handleLoadFromDrive}
                    style={{
                      fontSize: 11, color: ROSE_GOLD, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 4, background: "rgba(192,139,136,0.1)",
                      border: "none", fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <FileText size={12} /> From Drive
                  </button>
                </div>
              </div>
              {sourceFileName && (
                <div style={{ fontSize: 11, color: TEXT_TERTIARY, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <ExternalLink size={10} /> Content loaded from: {sourceFileName}
                </div>
              )}
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="Paste your marketing content here — the full post, ad copy, or email text..."
                rows={8}
                style={{ ...inputStyle, minHeight: 140, resize: "vertical" as const }}
              />
            </div>

            {/* Image Description */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Image Description <span style={{ fontWeight: 400, color: TEXT_TERTIARY }}>(optional — describe text and claims visible in any images)</span>
              </label>
              <textarea
                value={imageDesc}
                onChange={(e) => setImageDesc(e.target.value)}
                placeholder="E.g. 'Banner shows: Send payments worldwide — 0% fees — Regulated by FINMA'"
                rows={2}
                style={{ ...inputStyle, minHeight: 50, resize: "vertical" as const }}
              />
            </div>

            {/* Target Audience */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Target Audience</label>
              <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} style={selectStyle}>
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>

            {/* Jurisdictions */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: TEXT_SECONDARY, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>Jurisdictions to Check *</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {JURISDICTIONS.map((j) => {
                  const active = selectedJurisdictions.includes(j.value)
                  return (
                    <button
                      key={j.value}
                      type="button"
                      onClick={() => toggleJurisdiction(j.value)}
                      style={{
                        padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                        background: active ? "rgba(192,139,136,0.2)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? ROSE_GOLD : CARD_BORDER}`,
                        color: active ? ROSE_GOLD : TEXT_SECONDARY,
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {j.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, paddingTop: 16, borderTop: `1px solid ${CARD_BORDER}` }}>
              <button onClick={onClose} style={{
                background: "rgba(255,255,255,0.04)", color: TEXT_SECONDARY, border: `1px solid ${CARD_BORDER}`,
                borderRadius: 6, padding: "8px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
              }}>Cancel</button>
              <button
                onClick={runCheck}
                disabled={!contentText.trim() || checking || selectedJurisdictions.length === 0}
                style={{
                  background: checking ? "rgba(192,139,136,0.5)" : `linear-gradient(135deg, ${ROSE_GOLD}, #D4A5A2)`,
                  color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif", cursor: checking ? "wait" : "pointer", fontWeight: 500,
                  opacity: (!contentText.trim() || selectedJurisdictions.length === 0) ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {checking ? (
                  <>
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    Sentinel is analyzing...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} /> Run Compliance Check
                  </>
                )}
              </button>
            </div>
          </div>
        ) : result ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Overall Status Banner */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: 20, borderRadius: 14,
              background: result.status === "approved" ? "rgba(52,211,153,0.08)" : result.status === "needs_changes" ? "rgba(251,191,36,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${result.status === "approved" ? "rgba(52,211,153,0.25)" : result.status === "needs_changes" ? "rgba(251,191,36,0.25)" : "rgba(239,68,68,0.25)"}`,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 22, fontWeight: 600, fontFamily: "'Bellfair', serif",
                  color: STATUS_CONFIG[result.status]?.color || TEXT_PRIMARY, marginBottom: 6,
                }}>
                  {STATUS_CONFIG[result.status]?.emoji} {STATUS_CONFIG[result.status]?.label.toUpperCase()}
                </div>
                <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.5 }}>
                  {result.summary}
                </p>
              </div>
              <div style={{ marginLeft: 24 }}>
                <ScoreRing score={result.score ?? 0} size={90} />
              </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { label: "Passed", count: passCount, color: "#34D399" },
                { label: "Warnings", count: warnCount, color: "#FBBF24" },
                { label: "Failed", count: failCount, color: "#EF4444" },
              ].map((s) => (
                <div key={s.label} style={{
                  flex: 1, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8,
                  padding: "12px 16px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, fontFamily: "'Bellfair', serif", color: s.color, fontWeight: 400 }}>{s.count}</div>
                  <div style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Findings */}
            <div>
              <h4 style={{ fontSize: 14, color: TEXT_PRIMARY, margin: "0 0 12px", fontWeight: 500 }}>Detailed Findings</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Fails first, then warnings, then passes */}
                {[...findings].sort((a, b) => {
                  const order = { fail: 0, warning: 1, pass: 2 }
                  return (order[a.status] ?? 3) - (order[b.status] ?? 3)
                }).map((f, i) => (
                  <FindingCard key={i} finding={f} />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 16, borderTop: `1px solid ${CARD_BORDER}` }}>
              <button onClick={() => { setStep("input"); setResult(null) }} style={{
                background: "rgba(255,255,255,0.04)", color: TEXT_SECONDARY, border: `1px solid ${CARD_BORDER}`,
                borderRadius: 6, padding: "8px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
              }}>Check Another</button>
              <button onClick={onClose} style={{
                background: ROSE_GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px",
                fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", fontWeight: 500,
              }}>Done</button>
            </div>
          </div>
        ) : null}

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   MAIN TAB COMPONENT
   ══════════════════════════════════════════════════ */
export default function ComplianceCheckTab() {
  const [checks, setChecks] = useState<ComplianceCheck[]>([])
  const [selected, setSelected] = useState<ComplianceCheck | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState("")
  const [reviewSaving, setReviewSaving] = useState(false)

  const fetchChecks = useCallback(() => {
    fetch("/api/marketing/compliance-checks")
      .then((r) => r.json())
      .then((data) => {
        setChecks(data.checks ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchChecks() }, [fetchChecks])

  const handleManualReview = async (checkId: string, newStatus: string) => {
    setReviewSaving(true)
    try {
      await fetch(`/api/marketing/compliance-checks/${checkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reviewNotes }),
      })
      fetchChecks()
      if (selected?.id === checkId) {
        setSelected((prev) => prev ? { ...prev, status: newStatus, reviewNotes } : null)
      }
    } catch { /* silent */ }
    setReviewSaving(false)
    setReviewNotes("")
  }

  const findings = (selected?.findings || []) as Finding[]
  const failCount = findings.filter((f) => f.status === "fail").length
  const warnCount = findings.filter((f) => f.status === "warning").length
  const passCount = findings.filter((f) => f.status === "pass").length

  return (
    <div style={{ display: "flex", gap: 20, minHeight: 500 }}>
      {/* ── Left Panel — Previous Checks ── */}
      <div style={{
        width: 320, minWidth: 320, background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "16px 18px", borderBottom: `1px solid ${CARD_BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>Previous Checks</span>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: `linear-gradient(135deg, ${ROSE_GOLD}, #D4A5A2)`, color: "#fff", border: "none",
              borderRadius: 6, padding: "5px 12px", fontSize: 11, fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <Plus size={12} /> New Check
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={20} color={ROSE_GOLD} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : checks.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <ShieldCheck size={32} color={TEXT_TERTIARY} style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: "0 0 4px" }}>No checks yet</p>
              <p style={{ fontSize: 11, color: TEXT_TERTIARY, margin: 0 }}>Submit your first content for a compliance review</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {checks.map((c) => {
                const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending
                const isActive = selected?.id === c.id
                const preview = c.contentText.length > 50 ? c.contentText.slice(0, 50) + "..." : c.contentText
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    style={{
                      display: "flex", flexDirection: "column", gap: 6,
                      padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                      background: isActive ? "rgba(192,139,136,0.08)" : "transparent",
                      border: isActive ? `1px solid rgba(192,139,136,0.2)` : `1px solid transparent`,
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 12, color: TEXT_PRIMARY, lineHeight: 1.4 }}>{preview}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 10,
                        background: "rgba(255,255,255,0.06)", color: TEXT_SECONDARY, textTransform: "capitalize",
                      }}>
                        {c.platform}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 10,
                        background: sc.bg, color: sc.color,
                      }}>
                        {sc.emoji} {sc.label}
                      </span>
                      {c.score !== null && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: c.score >= 90 ? "#34D399" : c.score >= 70 ? "#FBBF24" : "#EF4444",
                        }}>
                          {c.score}/100
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                      {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel — Selected Check Results ── */}
      <div style={{
        flex: 1, background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
        borderRadius: 14, overflow: "hidden",
      }}>
        {!selected ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "100%", minHeight: 400, padding: 40,
          }}>
            <ShieldCheck size={48} color={TEXT_TERTIARY} style={{ marginBottom: 16, opacity: 0.4 }} />
            <p style={{ fontSize: 15, color: TEXT_SECONDARY, margin: "0 0 6px", fontFamily: "'Bellfair', serif" }}>Content Compliance Check</p>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, margin: "0 0 20px", textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
              Submit marketing content to Sentinel for automatic regulatory compliance analysis across EU, UK, UAE, and Swiss jurisdictions.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: `linear-gradient(135deg, ${ROSE_GOLD}, #D4A5A2)`, color: "#fff", border: "none",
                borderRadius: 8, padding: "10px 24px", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <ShieldCheck size={16} /> Check New Content
            </button>
          </div>
        ) : (
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
            {/* Result Header */}
            <div style={{
              padding: "20px 24px", borderBottom: `1px solid ${CARD_BORDER}`,
              background: selected.status === "approved" ? "rgba(52,211,153,0.04)" : selected.status === "needs_changes" ? "rgba(251,191,36,0.04)" : "rgba(239,68,68,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 18, fontFamily: "'Bellfair', serif", fontWeight: 400,
                      color: STATUS_CONFIG[selected.status]?.color || TEXT_PRIMARY,
                    }}>
                      {STATUS_CONFIG[selected.status]?.emoji} {STATUS_CONFIG[selected.status]?.label.toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 10,
                      background: "rgba(255,255,255,0.06)", color: TEXT_SECONDARY, textTransform: "capitalize",
                    }}>
                      {selected.platform} · {selected.contentType}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.5 }}>
                    {selected.summary}
                  </p>
                  {selected.contentIdea && (
                    <p style={{ fontSize: 11, color: TEXT_TERTIARY, margin: "6px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                      <FileText size={10} /> Linked to: {selected.contentIdea.title}
                    </p>
                  )}
                </div>
                <ScoreRing score={selected.score ?? 0} size={80} />
              </div>
            </div>

            {/* Content Preview */}
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${CARD_BORDER}` }}>
              <div style={{ fontSize: 11, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Content Checked</div>
              <div style={{
                background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`, borderRadius: 8,
                padding: 12, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6,
                maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap",
              }}>
                {selected.contentText}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>Audience: {selected.targetAudience || "—"}</span>
                <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>·</span>
                <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>Jurisdictions: {(selected.jurisdictions || []).join(", ") || "—"}</span>
              </div>
            </div>

            {/* Stats */}
            <div style={{ padding: "16px 24px", display: "flex", gap: 10 }}>
              {[
                { label: "Passed", count: passCount, color: "#34D399" },
                { label: "Warnings", count: warnCount, color: "#FBBF24" },
                { label: "Failed", count: failCount, color: "#EF4444" },
              ].map((s) => (
                <div key={s.label} style={{
                  flex: 1, background: VOID, border: `1px solid ${CARD_BORDER}`, borderRadius: 8,
                  padding: "10px 14px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 20, fontFamily: "'Bellfair', serif", color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Findings */}
            <div style={{ padding: "0 24px 16px" }}>
              <h4 style={{ fontSize: 13, color: TEXT_PRIMARY, margin: "0 0 10px", fontWeight: 500 }}>Findings</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[...findings].sort((a, b) => {
                  const order = { fail: 0, warning: 1, pass: 2 }
                  return (order[a.status] ?? 3) - (order[b.status] ?? 3)
                }).map((f, i) => (
                  <FindingCard key={i} finding={f} />
                ))}
                {findings.length === 0 && (
                  <p style={{ fontSize: 12, color: TEXT_TERTIARY, padding: 12 }}>No findings available.</p>
                )}
              </div>
            </div>

            {/* Manual Review Section */}
            {(selected.status === "needs_changes" || selected.status === "rejected") && (
              <div style={{ padding: "16px 24px", borderTop: `1px solid ${CARD_BORDER}` }}>
                <h4 style={{ fontSize: 13, color: TEXT_PRIMARY, margin: "0 0 10px", fontWeight: 500 }}>
                  {selected.reviewedBy ? "Review" : "Manual Review"}
                </h4>
                {selected.reviewedBy ? (
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12 }}>
                    <p style={{ fontSize: 12, color: TEXT_PRIMARY, margin: "0 0 4px" }}>
                      Reviewed by <strong>{selected.reviewedBy}</strong> — Status overridden to <strong style={{ color: STATUS_CONFIG[selected.status]?.color }}>{selected.status}</strong>
                    </p>
                    {selected.reviewNotes && (
                      <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: "4px 0 0", lineHeight: 1.5 }}>{selected.reviewNotes}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add review notes (optional)..."
                      rows={2}
                      style={{ ...inputStyle, minHeight: 50, resize: "vertical" as const }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleManualReview(selected.id, "approved")}
                        disabled={reviewSaving}
                        style={{
                          background: "rgba(52,211,153,0.15)", color: "#34D399", border: "1px solid rgba(52,211,153,0.3)",
                          borderRadius: 6, padding: "6px 14px", fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                          cursor: "pointer", fontWeight: 500,
                        }}
                      >
                        ✅ Override → Approved
                      </button>
                      <button
                        onClick={() => handleManualReview(selected.id, "rejected")}
                        disabled={reviewSaving}
                        style={{
                          background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: 6, padding: "6px 14px", fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                          cursor: "pointer", fontWeight: 500,
                        }}
                      >
                        ❌ Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Checked timestamp */}
            <div style={{ padding: "12px 24px", borderTop: `1px solid ${CARD_BORDER}` }}>
              <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>
                Checked {selected.checkedAt ? new Date(selected.checkedAt).toLocaleString("en-GB") : "—"} · by {selected.createdBy}
                {selected.sourceType && selected.sourceType !== "text" && ` · Source: ${selected.sourceType.replace("_", " ")}`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <CheckModal
          onClose={() => setShowModal(false)}
          onSuccess={fetchChecks}
        />
      )}
    </div>
  )
}

/* ── Export CheckModal for use from Content Ideas ── */
export { CheckModal }
