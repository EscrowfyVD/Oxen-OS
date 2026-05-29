"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CRM_COLORS } from "@/lib/crm-config"
import type { SignalTypeOption } from "./types"

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

const SOURCE_OPTIONS = ["all", "trigify", "clay", "api/signals", "lemlist", "n8n"]
const GROUP_OPTIONS = ["all", "G1", "G2", "G3", "G4", "G5", "G6", "G7A", "G7B"]
// Sprint 3d Option C — Excluded omitted on purpose (operators don't
// want to surface excluded contacts in the feed). V2 may add a
// separate ?include_excluded toggle if requested.
const PRIORITY_LEVEL_OPTIONS = ["all", "P1", "P2", "P3", "Monitor"]
const STATUS_OPTIONS = [
  { v: "all", label: "All" },
  { v: "unactioned", label: "Unactioned" },
  { v: "actioned", label: "Actioned" },
]
// Date dropdown maps to date_from ISO. Computed at click time so
// "Last 24h" relative to *now* (not page-load time).
const DATE_OPTIONS = [
  { v: "all", label: "All time" },
  { v: "24h", label: "Last 24h" },
  { v: "7d", label: "Last 7d" },
  { v: "30d", label: "Last 30d" },
]

function isoFromDateOption(opt: string): string | null {
  if (opt === "all" || !opt) return null
  const now = Date.now()
  const map: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  }
  const ms = map[opt]
  if (!ms) return null
  return new Date(now - ms).toISOString()
}

function dateOptionFromIso(iso: string | null): string {
  if (!iso) return "all"
  const ageMs = Date.now() - new Date(iso).getTime()
  // Bucket to the closest preset — preserves the URL → UI cycle even
  // if the ISO is a few ms off due to round-trip timing.
  if (ageMs <= 25 * 60 * 60 * 1000) return "24h"
  if (ageMs <= 8 * 24 * 60 * 60 * 1000) return "7d"
  if (ageMs <= 31 * 24 * 60 * 60 * 1000) return "30d"
  return "all"
}

export default function IntentFeedFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read filters from URL on each render so back/forward nav reflects.
  const source = searchParams.get("source") ?? "all"
  const signalTypeCode = searchParams.get("signal_type_code") ?? "all"
  const group = searchParams.get("group") ?? "all"
  const priorityLevel = searchParams.get("priority_level") ?? "all"
  const status = searchParams.get("status") ?? "all"
  const hotOnly = searchParams.get("hot_only") === "1"
  const dateOption = dateOptionFromIso(searchParams.get("date_from"))

  const [signalTypes, setSignalTypes] = useState<SignalTypeOption[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/signal-types")
      .then((r) => (r.ok ? r.json() : { signal_types: [] }))
      .then((data: { signal_types: SignalTypeOption[] }) => {
        if (!cancelled) setSignalTypes(data.signal_types ?? [])
      })
      .catch(() => {
        if (!cancelled) setSignalTypes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTypes(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === "" || value === "all") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    // Filter change → reset pagination cursor to keep results coherent.
    params.delete("offset")
    const qs = params.toString()
    router.push(qs ? `?${qs}` : "?", { scroll: false })
  }

  function clearAll() {
    router.push("?", { scroll: false })
  }

  const anyFilterSet =
    source !== "all" ||
    signalTypeCode !== "all" ||
    group !== "all" ||
    priorityLevel !== "all" ||
    status !== "all" ||
    hotOnly ||
    dateOption !== "all"

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
        <label style={labelStyle}>Source</label>
        <select
          style={selectStyle}
          value={source}
          onChange={(e) => updateFilter("source", e.target.value)}
        >
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All sources" : s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Signal type</label>
        <select
          style={selectStyle}
          value={signalTypeCode}
          onChange={(e) => updateFilter("signal_type_code", e.target.value)}
          disabled={loadingTypes}
        >
          <option value="all">All types</option>
          {signalTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Date</label>
        <select
          style={selectStyle}
          value={dateOption}
          onChange={(e) => {
            const iso = isoFromDateOption(e.target.value)
            updateFilter("date_from", iso)
          }}
        >
          {DATE_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Group</label>
        <select
          style={selectStyle}
          value={group}
          onChange={(e) => updateFilter("group", e.target.value)}
        >
          {GROUP_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g === "all" ? "All groups" : g}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Priority</label>
        <select
          style={selectStyle}
          value={priorityLevel}
          onChange={(e) => updateFilter("priority_level", e.target.value)}
        >
          {PRIORITY_LEVEL_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "All priorities" : p}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Status</label>
        <select
          style={selectStyle}
          value={status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: CRM_COLORS.text_secondary,
          fontFamily: "'DM Sans', sans-serif",
          cursor: "pointer",
          height: 36,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={hotOnly}
            onChange={(e) => updateFilter("hot_only", e.target.checked ? "1" : null)}
            style={{ accentColor: ROSE }}
          />
          Hot only
        </label>
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
            marginLeft: "auto",
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
