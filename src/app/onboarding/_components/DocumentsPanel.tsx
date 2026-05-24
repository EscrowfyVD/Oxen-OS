"use client"

// Documents section — formatted rows (one per document) per
// SP16-002b §2. Pre-fix the detail view dumped the raw documents
// array via a generic SectionPanel; the array stringified into a
// `[object Object], [object Object]...` mess in the UI. Now we
// render a focused row per document with the operator-relevant
// fields: file name, doc type, processing/validation status, and the
// extraction-failed indicator (red dot when true).
//
// Shape verified live on OCA staging — see detail-types.ts
// `DocumentRow`. Every per-row field is optional and null-checked
// here so a partially-populated document still renders.

import { CRM_COLORS } from "@/lib/crm-config"
import {
  labelForDocType,
  labelForDocValidationStatus,
  humanizeToken,
} from "@/lib/onboarding/labels"
import { formatTimestamp } from "./format"
import type { DocumentRow } from "./detail-types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary

// Same colored-pill convention as the status filter — keeps the
// detail view visually consistent with the list view's badges.
const VALIDATION_COLOR: Record<string, string> = {
  validated: "#34D399",
  pending: "#FBBF24",
  rejected: "#F87171",
  failed: "#F87171",
}
const PROCESSING_COLOR: Record<string, string> = {
  done: "#34D399",
  processing: "#3B82F6",
  pending: "#FBBF24",
  failed: "#F87171",
}

function pillStyle(color: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 7px",
    fontSize: 10,
    fontWeight: 500,
    color,
    background: `${color}1A`, // 1A ≈ 10% alpha
    border: `1px solid ${color}33`, // 33 ≈ 20% alpha
    borderRadius: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  }
}

export default function DocumentsPanel({ documents }: { documents: DocumentRow[] | null }) {
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
        Documents
      </div>

      {!documents || documents.length === 0 ? (
        <div style={{ fontSize: 12, color: TEXT3, fontStyle: "italic" }}>
          No documents uploaded yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {documents.map((doc) => {
            const validation = doc.validation_status ?? null
            const processing = doc.processing_status ?? null
            const validationColor = validation
              ? VALIDATION_COLOR[validation] ?? "#9CA3AF"
              : null
            const processingColor = processing
              ? PROCESSING_COLOR[processing] ?? "#9CA3AF"
              : null
            return (
              <div
                key={doc.id}
                style={{
                  paddingLeft: 12,
                  borderLeft: `2px solid ${CRM_COLORS.card_border}`,
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: TEXT, fontWeight: 500 }}>{doc.file_name}</span>
                  {doc.doc_type && (
                    <span style={{ color: TEXT3, fontSize: 11 }}>· {labelForDocType(doc.doc_type)}</span>
                  )}
                  {doc.extraction_failed && (
                    <span style={pillStyle("#F87171")}>extraction failed</span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 4,
                    color: TEXT2,
                    fontSize: 11,
                  }}
                >
                  {validation && validationColor && (
                    <span style={pillStyle(validationColor)}>{labelForDocValidationStatus(validation)}</span>
                  )}
                  {processing && processingColor && (
                    <span style={pillStyle(processingColor)}>{humanizeToken(processing)}</span>
                  )}
                  {doc.created_at && (
                    <span style={{ color: TEXT3 }}>· {formatTimestamp(doc.created_at)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
