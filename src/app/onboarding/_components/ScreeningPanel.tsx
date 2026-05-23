"use client"

// Screening section — SP16-002b §4. Pre-fix the detail view dumped
// `{total: 0, by_result: {}}` via a generic SectionPanel which
// printed the literal "By Result: {}" — useless and misleading.
// Now: explicit empty/"none" state when total === 0; per-result
// rows when there are hits.

import { CRM_COLORS } from "@/lib/crm-config"
import type { ScreeningSummary } from "./detail-types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary

// Color the per-result count by sanction-tier convention used
// elsewhere in the OS — hits is the operator-attention bucket.
const RESULT_COLOR: Record<string, string> = {
  clear: "#34D399",
  no_match: "#34D399",
  match: "#F87171",
  hit: "#F87171",
  pep: "#FBBF24",
  sanction: "#F87171",
}

function resultColor(key: string): string {
  return RESULT_COLOR[key.toLowerCase()] ?? "#9CA3AF"
}

export default function ScreeningPanel({ screening }: { screening: ScreeningSummary | null }) {
  const total = screening?.total ?? 0
  const byResult = screening?.by_result ?? {}
  const resultEntries = Object.entries(byResult)

  return (
    <div
      style={{
        padding: "16px 18px",
        background: CRM_COLORS.card_bg,
        border: `1px solid ${CRM_COLORS.card_border}`,
        borderRadius: 10,
        fontFamily: "'DM Sans', sans-serif",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: CRM_COLORS.rose_gold,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        Screening ({total} total)
      </div>

      {total === 0 || resultEntries.length === 0 ? (
        <div style={{ fontSize: 12, color: TEXT3, fontStyle: "italic" }}>
          No screening checks recorded yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {resultEntries.map(([result, count]) => (
            <div
              key={result}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                color: TEXT2,
              }}
            >
              <span style={{ color: TEXT }}>{result.replace(/_/g, " ")}</span>
              <span
                style={{
                  color: resultColor(result),
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
