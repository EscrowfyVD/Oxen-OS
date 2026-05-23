"use client"

// Render one of the 6 OCA data blobs as a panel with provenance
// pills next to each field. The blob is opaque (Record<string, unknown>)
// — defensive rendering for V1 since OCA hasn't pinned per-blob schemas.

import { CRM_COLORS } from "@/lib/crm-config"
import { splitProvenance, type SectionPayload } from "./detail-types"

const TEXT = CRM_COLORS.text_primary
const TEXT3 = CRM_COLORS.text_tertiary

const PROVENANCE_COLOR: Record<string, string> = {
  user: "#818CF8",                // indigo — direct from the entity
  agent: "#C08B88",               // rose — derived by the AI agent
  "operator-provided": "#FBBF24", // amber — manually supplied by ops
  system: "#9CA3AF",              // gray — system-default
}

function provenanceColor(prov: string | null): string {
  if (!prov) return "#9CA3AF"
  return PROVENANCE_COLOR[prov] ?? "#9CA3AF"
}

function formatFieldName(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Defensive value renderer — handles primitives, arrays of primitives,
 * and nested objects. Renders nested objects as compact JSON so the
 * UI doesn't crash on unexpected upstream shapes.
 */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return "—"
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ")
  }
  // Object — render compact JSON. Truncate at 200 chars to avoid
  // ballooning a panel when a nested object is huge.
  try {
    const json = JSON.stringify(value)
    return json.length > 200 ? json.slice(0, 200) + "…" : json
  } catch {
    return "[unrenderable]"
  }
}

const provenancePillStyle = (color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 6px",
  borderRadius: 4,
  background: "transparent",
  border: `1px solid ${color}66`,
  color,
  fontSize: 9,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontFamily: "'DM Sans', sans-serif",
  marginLeft: 8,
  flexShrink: 0,
})

export default function SectionPanel({
  title,
  payload,
}: {
  title: string
  payload: SectionPayload | null | undefined
}) {
  // Defensive empty render — when OCA omits a section entirely or
  // sends an empty object, we still show the panel header so the
  // operator knows the section exists but has no data.
  const { fields, provenanceFor } = payload
    ? splitProvenance(payload)
    : { fields: [], provenanceFor: () => null }

  return (
    <div
      style={{
        marginBottom: 12,
        padding: "16px 18px",
        background: CRM_COLORS.card_bg,
        border: `1px solid ${CRM_COLORS.card_border}`,
        borderRadius: 10,
        fontFamily: "'DM Sans', sans-serif",
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
        {title}
      </div>

      {fields.length === 0 ? (
        <div style={{ fontSize: 12, color: TEXT3, fontStyle: "italic" }}>
          No data
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {fields.map(([key, value]) => {
            const prov = provenanceFor(key)
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <div
                  style={{
                    width: 160,
                    flexShrink: 0,
                    color: TEXT3,
                    fontSize: 11,
                    paddingTop: 1,
                  }}
                >
                  {formatFieldName(key)}
                </div>
                <div
                  style={{
                    flex: 1,
                    color: TEXT,
                    minWidth: 0,
                    wordBreak: "break-word",
                  }}
                >
                  {renderValue(value)}
                </div>
                {prov && (
                  <span style={provenancePillStyle(provenanceColor(prov))}>
                    {prov}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
