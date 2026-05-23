// Display formatters for the Onboarding console.
//
// Mirrors the patterns from src/lib/intent-feed/format-date.ts
// (Intl.DateTimeFormat en-GB, no date-fns dep). Pure functions, easy
// to unit-test, easy to swap implementations without touching UI.

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

/**
 * Format an ISO timestamp string as compact "D Mon HH:MM". Returns
 * empty string for null/invalid input so the cell renders cleanly.
 */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  // Intl en-GB injects a literal comma between date and time parts —
  // strip it to match the in-house formatter convention used elsewhere
  // (src/lib/intent-feed/format-date.ts).
  return DATE_FORMATTER.format(d).replace(",", "")
}

/**
 * Render `idle_minutes` as the "stuck?" indicator. The thresholds
 * follow operator intuition:
 *   - < 30 min  → normal (text-tertiary)
 *   - 30-120 min → amber (warm warning)
 *   - > 120 min → red (definitely stuck)
 * Returns the threshold bucket so the caller can pick the matching
 * color token, plus a display string ("12 min" / "1h 23m" / "—").
 */
export type IdleBucket = "fresh" | "warm" | "stuck"

export function classifyIdle(minutes: number | null | undefined): {
  bucket: IdleBucket
  label: string
} {
  if (minutes === null || minutes === undefined) {
    return { bucket: "fresh", label: "—" }
  }
  const m = Math.max(0, Math.floor(minutes))
  let label: string
  if (m < 60) label = `${m} min`
  else if (m < 60 * 24) label = `${Math.floor(m / 60)}h ${m % 60}m`
  else label = `${Math.floor(m / (60 * 24))}d ${Math.floor((m % (60 * 24)) / 60)}h`
  let bucket: IdleBucket = "fresh"
  if (m >= 120) bucket = "stuck"
  else if (m >= 30) bucket = "warm"
  return { bucket, label }
}

/**
 * Map a SessionStatus to a token color.
 *
 * V1 hardcodes the most common values. Unknown statuses fall back to
 * neutral gray — the row still renders correctly, the operator just
 * sees a colorless badge. Per-status colors can be tuned in §12 Q4
 * follow-up without touching the UI components.
 */
const STATUS_COLOR: Record<string, string> = {
  collecting: "#3B82F6",     // indigo — in progress
  blocked: "#FBBF24",        // amber — operator action needed
  closed_success: "#34D399", // green
  closed_failed: "#F87171",  // red
  closed_abandoned: "#9CA3AF", // gray
}

export function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? "#9CA3AF"
}

const RISK_COLOR: Record<string, string> = {
  low: "#34D399",
  medium: "#FBBF24",
  high: "#F87171",
  critical: "#F87171",
}

export function riskColor(level: string | null | undefined): string {
  if (!level) return "#9CA3AF"
  return RISK_COLOR[level] ?? "#9CA3AF"
}
