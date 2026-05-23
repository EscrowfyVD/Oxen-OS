"use client"

// Filter bar for the Onboarding session list — three filters drive
// URL-sync, mirroring the IntentFeedFilters pattern. status is
// multi-value: the URL stores it as a comma-separated list and the
// proxy forwards it verbatim to OCA (which accepts the same shape).

import { useRouter, useSearchParams } from "next/navigation"
import { CRM_COLORS } from "@/lib/crm-config"

const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold

const selectStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: `1px solid ${CRM_COLORS.card_border}`,
  borderRadius: 8,
  padding: "8px 12px",
  color: CRM_COLORS.text_primary,
  fontSize: 12,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  minWidth: 140,
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: TEXT3,
  fontFamily: "'DM Sans', sans-serif",
  marginBottom: 4,
}

// V1 hardcoded option sets. Unknown values from OCA still render in
// the table (the row component renders any status), they just don't
// appear in the dropdown. Per RECON Q4, this can be replaced by a
// dynamic options fetch later — not V1.
const PLATFORM_OPTIONS = ["all", "escrowfy", "oxen"]
// SP16-002b — verified against OCA staging on 2026-05-22. The original
// SP16-002 list ("collecting"/"blocked"/"closed_*") was a guess and
// did not match any real OCA status value, which made e.g. `review`
// sessions un-filterable. The 5-value set below mirrors the
// KybSession.status enum used by OCA (`active` + `review` confirmed
// live; `paused`, `rejected`, `completed` per the SP15 contract). The
// value strings on the wire are lowercase; the labels are
// human-readable. Both the chip and the row badge use these values
// via statusColor() in format.ts.
const STATUS_OPTIONS = [
  { v: "active", label: "Active" },
  { v: "review", label: "In review" },
  { v: "paused", label: "Paused" },
  { v: "rejected", label: "Rejected" },
  { v: "completed", label: "Completed" },
]
const ENTITY_TYPE_OPTIONS = ["all", "company", "individual"]

function parseStatusCsv(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export default function OnboardingFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const platform = searchParams.get("platform") ?? "all"
  const entityType = searchParams.get("entity_type") ?? "all"
  const selectedStatuses = parseStatusCsv(searchParams.get("status"))

  function updateScalar(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === "" || value === "all") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    params.delete("page")
    const qs = params.toString()
    router.push(qs ? `?${qs}` : "?", { scroll: false })
  }

  function toggleStatus(statusValue: string) {
    const params = new URLSearchParams(searchParams.toString())
    const current = parseStatusCsv(params.get("status"))
    const next = current.includes(statusValue)
      ? current.filter((s) => s !== statusValue)
      : [...current, statusValue]
    if (next.length === 0) params.delete("status")
    else params.set("status", next.join(","))
    params.delete("page")
    const qs = params.toString()
    router.push(qs ? `?${qs}` : "?", { scroll: false })
  }

  function clearAll() {
    router.push("?", { scroll: false })
  }

  const anyFilterSet =
    platform !== "all" || entityType !== "all" || selectedStatuses.length > 0

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        alignItems: "flex-end",
        padding: "16px 0",
        marginBottom: 16,
        borderBottom: `1px solid ${CRM_COLORS.card_border}`,
      }}
    >
      <div>
        <label style={labelStyle}>Platform</label>
        <select
          style={selectStyle}
          value={platform}
          onChange={(e) => updateScalar("platform", e.target.value)}
        >
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "All platforms" : p}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Entity type</label>
        <select
          style={selectStyle}
          value={entityType}
          onChange={(e) => updateScalar("entity_type", e.target.value)}
        >
          {ENTITY_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All types" : t}
            </option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, minWidth: 280 }}>
        <label style={labelStyle}>Status (multi)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {STATUS_OPTIONS.map((s) => {
            const active = selectedStatuses.includes(s.v)
            return (
              <button
                key={s.v}
                onClick={() => toggleStatus(s.v)}
                style={{
                  padding: "6px 10px",
                  fontSize: 11,
                  fontFamily: "'DM Sans', sans-serif",
                  borderRadius: 6,
                  border: `1px solid ${active ? ROSE : CRM_COLORS.card_border}`,
                  background: active ? "rgba(192,139,136,0.15)" : "transparent",
                  color: active ? CRM_COLORS.text_primary : CRM_COLORS.text_secondary,
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {anyFilterSet && (
        <button
          onClick={clearAll}
          style={{
            background: "transparent",
            border: `1px solid ${CRM_COLORS.card_border}`,
            borderRadius: 8,
            padding: "8px 14px",
            color: CRM_COLORS.text_secondary,
            fontSize: 11,
            fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer",
            height: 36,
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
