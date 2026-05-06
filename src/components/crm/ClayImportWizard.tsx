"use client"

import { useState, useCallback, useMemo } from "react"
import Papa from "papaparse"
import { parseClayTableName } from "@/lib/clay-helpers"

/* ── Design tokens (CSS-variable-backed for light/dark) ── */
const CARD_BG = "var(--card-bg)"
const CARD_BORDER = "var(--card-border)"
const TEXT = "var(--text-primary)"
const TEXT2 = "var(--text-secondary)"
const TEXT3 = "var(--text-tertiary)"
const ROSE = "var(--rose-gold)"
const GREEN = "var(--green)"
const RED = "var(--red)"

const GLASS: React.CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 14,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--surface-hover)",
}

/* ── Preset source tables (extend as new G+T tables come online) ── */
const PRESET_TABLES = [
  "vDC_G1_Tier 1_Company_Active Business Loss",
  "vDC_G1_Tier 1_People_Active Business Loss",
] as const

/* ── Field options per scope ── */
const COMPANY_FIELDS = [
  { value: "", label: "-- Skip --" },
  { value: "name", label: "Name (required)" },
  { value: "domain", label: "Domain (required, used for matching)" },
  { value: "description", label: "Description" },
  { value: "primaryIndustry", label: "Primary Industry" },
  { value: "size", label: "Size (Clay bucket, e.g. 11-50 employees)" },
  { value: "type", label: "Type (Privately Held, Public, etc.)" },
  { value: "country", label: "Country" },
  { value: "location", label: "Location (city, region)" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
] as const

const PEOPLE_FIELDS = [
  { value: "", label: "-- Skip --" },
  { value: "email", label: "Email (required, used for matching)" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "fullName", label: "Full Name" },
  { value: "jobTitle", label: "Job Title (drives DM/OP persona)" },
  { value: "emailValidationStatus", label: "Email Validation Status" },
  { value: "emailProvider", label: "Email Provider" },
  { value: "linkedinUrl", label: "LinkedIn URL (person)" },
  { value: "location", label: "Location (person)" },
  { value: "country", label: "Country (person)" },
  { value: "company.name", label: "Company Name" },
  { value: "company.domain", label: "Company Domain" },
  { value: "company.linkedinUrl", label: "Company LinkedIn URL" },
] as const

/* ── Auto-mapping: CSV header (lowercased) → schema field ── */
const COMPANY_AUTO_MAP: Record<string, string> = {
  name: "name",
  "company name": "name",
  "company_name": "name",
  domain: "domain",
  "company domain": "domain",
  description: "description",
  industry: "primaryIndustry",
  "primary industry": "primaryIndustry",
  size: "size",
  "company size": "size",
  type: "type",
  "company type": "type",
  country: "country",
  location: "location",
  "linkedin url": "linkedinUrl",
  linkedinurl: "linkedinUrl",
  "linkedin": "linkedinUrl",
}

const PEOPLE_AUTO_MAP: Record<string, string> = {
  email: "email",
  // Apollo CSV column aliases (Sprint S0 batch 4 hotfix v3 — observed
  // in vDC_G1_Tier 1_People_Active Business Loss export):
  "work email": "email",
  "email address": "email",
  "business email": "email",
  "primary email": "email",
  "work email status": "emailValidationStatus",
  "first name": "firstName",
  firstname: "firstName",
  "last name": "lastName",
  lastname: "lastName",
  "full name": "fullName",
  fullname: "fullName",
  name: "fullName",
  "job title": "jobTitle",
  jobtitle: "jobTitle",
  title: "jobTitle",
  "email validation": "emailValidationStatus",
  "email validation status": "emailValidationStatus",
  "email provider": "emailProvider",
  "linkedin url": "linkedinUrl",
  linkedin: "linkedinUrl",
  location: "location",
  country: "country",
  "company name": "company.name",
  company: "company.name",
  "company domain": "company.domain",
  "company website": "company.domain",
  "company linkedin": "company.linkedinUrl",
}

interface Props {
  onClose: () => void
  onComplete: () => void
}

type Step = "upload" | "source" | "mapping" | "preview" | "running" | "result"

interface ImportResult {
  success: boolean
  total?: number
  created?: number
  updated?: number
  errored?: number
  errors?: { index: number; error: string }[]
  error?: string
}

export default function ClayImportWizard({ onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload")

  // File state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])

  // Source table state
  const [sourceTableMode, setSourceTableMode] = useState<"preset" | "custom">(
    "preset",
  )
  const [presetSelection, setPresetSelection] = useState<string>(
    PRESET_TABLES[0],
  )
  const [customSourceTable, setCustomSourceTable] = useState("")

  const sourceTable =
    sourceTableMode === "preset" ? presetSelection : customSourceTable.trim()

  const detected = useMemo(() => parseClayTableName(sourceTable), [sourceTable])

  // Mapping state: csvHeader → schema field
  const [mapping, setMapping] = useState<Record<string, string>>({})

  // Result state
  const [result, setResult] = useState<ImportResult | null>(null)

  /* ── Handlers ── */

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (parsed) => {
          const headers = parsed.meta.fields ?? []
          setCsvHeaders(headers)
          setCsvRows(parsed.data)
          setStep("source")
        },
      })
    },
    [],
  )

  const proceedToMapping = useCallback(() => {
    if (!detected.scope || !detected.group || !detected.painTier) {
      // User must provide a parseable source_table. Block.
      return
    }
    // Auto-map CSV headers → fields based on scope
    const autoMap =
      detected.scope === "company" ? COMPANY_AUTO_MAP : PEOPLE_AUTO_MAP
    const initial: Record<string, string> = {}
    for (const header of csvHeaders) {
      const lower = header.toLowerCase().trim()
      initial[header] = autoMap[lower] ?? ""
    }
    setMapping(initial)
    setStep("mapping")
  }, [detected, csvHeaders])

  const proceedToPreview = useCallback(() => {
    setStep("preview")
  }, [])

  const submitImport = useCallback(async () => {
    if (!detected.scope || !detected.group || !detected.painTier) return
    setStep("running")

    // Transform CSV rows → schema rows using mapping
    const rows = csvRows.map((row) => {
      const out: Record<string, unknown> = {}
      for (const [csvCol, schemaField] of Object.entries(mapping)) {
        if (!schemaField) continue
        const raw = row[csvCol]?.trim()
        if (!raw) continue
        // Handle nested keys (company.name, company.domain, ...)
        if (schemaField.includes(".")) {
          const [parent, child] = schemaField.split(".")
          const sub = (out[parent] as Record<string, unknown>) ?? {}
          sub[child] = raw
          out[parent] = sub
        } else {
          out[schemaField] = raw
        }
      }
      return out
    })

    const payload = {
      source_table: sourceTable,
      scope: detected.scope,
      group: detected.group,
      pain_tier: detected.painTier,
      rows,
    }

    try {
      const res = await fetch("/api/crm/contacts/import-clay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body: ImportResult = await res.json()
      setResult(body)
      setStep("result")
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      })
      setStep("result")
    }
  }, [csvRows, mapping, sourceTable, detected])

  const handleClose = useCallback(() => {
    if (step === "result" && result?.success) onComplete()
    onClose()
  }, [step, result, onClose, onComplete])

  /* ── Render ── */

  const fields =
    detected.scope === "people" ? PEOPLE_FIELDS : COMPANY_FIELDS
  const detectedOk =
    detected.scope !== null &&
    detected.group !== null &&
    detected.painTier !== null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          ...GLASS,
          width: "min(900px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 22,
              color: TEXT,
              margin: 0,
            }}
          >
            Import contacts depuis Clay
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              color: TEXT3,
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* ── Step: Upload ── */}
        {step === "upload" && (
          <div>
            <p style={{ color: TEXT2, marginBottom: 16 }}>
              Upload a CSV exported from a Clay table. Each table holds rows
              of one scope (Company or People) tagged with a single G+T.
            </p>
            <label
              style={{
                display: "block",
                border: `2px dashed ${CARD_BORDER}`,
                borderRadius: 12,
                padding: 40,
                textAlign: "center",
                cursor: "pointer",
                color: TEXT3,
              }}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              📄 Drop CSV file here or click to browse
            </label>
          </div>
        )}

        {/* ── Step: Source table ── */}
        {step === "source" && (
          <div>
            <p style={{ color: TEXT2, marginBottom: 12 }}>
              CSV loaded: <strong style={{ color: TEXT }}>{csvRows.length}</strong> rows,{" "}
              <strong style={{ color: TEXT }}>{csvHeaders.length}</strong> columns
            </p>
            <h3 style={{ color: TEXT, fontSize: 14, marginBottom: 12 }}>
              Source table
            </h3>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  color: TEXT,
                }}
              >
                <input
                  type="radio"
                  checked={sourceTableMode === "preset"}
                  onChange={() => setSourceTableMode("preset")}
                />
                Preset
              </label>
              {sourceTableMode === "preset" && (
                <select
                  value={presetSelection}
                  onChange={(e) => setPresetSelection(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--surface-input)",
                    border: `1px solid ${CARD_BORDER}`,
                    color: TEXT,
                    padding: "10px 12px",
                    borderRadius: 8,
                    marginLeft: 24,
                  }}
                >
                  {PRESET_TABLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                  color: TEXT,
                }}
              >
                <input
                  type="radio"
                  checked={sourceTableMode === "custom"}
                  onChange={() => setSourceTableMode("custom")}
                />
                Custom (manual entry)
              </label>
              {sourceTableMode === "custom" && (
                <input
                  type="text"
                  value={customSourceTable}
                  onChange={(e) => setCustomSourceTable(e.target.value)}
                  placeholder="vDC_G2_Tier 1_Company_Some Filter"
                  style={{
                    width: "calc(100% - 24px)",
                    background: "var(--surface-input)",
                    border: `1px solid ${CARD_BORDER}`,
                    color: TEXT,
                    padding: "10px 12px",
                    borderRadius: 8,
                    marginLeft: 24,
                  }}
                />
              )}
            </div>

            <div
              style={{
                background: "var(--surface-input)",
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                fontSize: 13,
                color: detectedOk ? GREEN : RED,
              }}
            >
              {detectedOk ? (
                <>
                  ✓ Auto-detected:{" "}
                  <strong>scope={detected.scope}</strong>,{" "}
                  <strong>group={detected.group}</strong>,{" "}
                  <strong>tier={detected.painTier}</strong>
                  {detected.segment && (
                    <>
                      , <strong>segment={`"${detected.segment}"`}</strong>
                    </>
                  )}
                </>
              ) : (
                <>
                  ✗ Cannot parse table name. Expected:
                  <code> vDC_{`{group}`}_Tier {`{1-3}`}_Company|People_{`{filter}`}</code>
                </>
              )}
            </div>

            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              <button onClick={handleClose} style={btnSecondary}>
                Cancel
              </button>
              <button
                onClick={proceedToMapping}
                disabled={!detectedOk}
                style={{
                  ...btnPrimary,
                  opacity: detectedOk ? 1 : 0.4,
                  cursor: detectedOk ? "pointer" : "not-allowed",
                }}
              >
                Next: Map columns
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Mapping ── */}
        {step === "mapping" && (
          <div>
            <p style={{ color: TEXT2, marginBottom: 16 }}>
              Map your CSV columns to Clay schema fields. Auto-mapped fields
              are pre-filled — review and adjust.
            </p>
            <div style={{ marginBottom: 20 }}>
              {csvHeaders.map((header) => (
                <div
                  key={header}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 8,
                    alignItems: "center",
                  }}
                >
                  <div style={{ color: TEXT, fontSize: 13 }}>{header}</div>
                  <select
                    value={mapping[header] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [header]: e.target.value }))
                    }
                    style={{
                      background: "var(--surface-input)",
                      border: `1px solid ${CARD_BORDER}`,
                      color: TEXT,
                      padding: "8px 10px",
                      borderRadius: 8,
                    }}
                  >
                    {fields.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              <button onClick={() => setStep("source")} style={btnSecondary}>
                Back
              </button>
              <button onClick={proceedToPreview} style={btnPrimary}>
                Next: Preview
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Preview ── */}
        {step === "preview" && (
          <div>
            <p style={{ color: TEXT2, marginBottom: 16 }}>
              Ready to import <strong style={{ color: TEXT }}>{csvRows.length}</strong>{" "}
              rows ({detected.scope}) tagged as{" "}
              <strong style={{ color: TEXT }}>
                {detected.group}-{detected.painTier}
              </strong>
              .
            </p>
            <div
              style={{
                background: "var(--surface-input)",
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                color: TEXT2,
                fontSize: 13,
              }}
            >
              <p style={{ margin: 0 }}>
                Each row will be sent to{" "}
                <code>/api/crm/contacts/import-clay</code>, which calls the
                Clay enrichment upsert helpers (single source of truth shared
                with the HTTP webhook). Idempotent on{" "}
                {detected.scope === "company" ? "domain" : "email"}.
              </p>
            </div>
            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              <button onClick={() => setStep("mapping")} style={btnSecondary}>
                Back
              </button>
              <button onClick={submitImport} style={btnPrimary}>
                Confirm Import
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Running ── */}
        {step === "running" && (
          <div style={{ padding: 40, textAlign: "center", color: TEXT2 }}>
            ⏳ Importing {csvRows.length} rows… this may take a few seconds
            for large batches.
          </div>
        )}

        {/* ── Step: Result ── */}
        {step === "result" && result && (
          <div>
            {result.success ? (
              <div
                style={{
                  background: "var(--surface-input)",
                  border: `1px solid ${GREEN}`,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20,
                  color: TEXT,
                }}
              >
                ✅ Import complete:{" "}
                <strong>{result.created}</strong> created,{" "}
                <strong>{result.updated}</strong> updated,{" "}
                <strong>{result.errored}</strong> errors out of{" "}
                <strong>{result.total}</strong> rows.
              </div>
            ) : (
              <div
                style={{
                  background: "var(--surface-input)",
                  border: `1px solid ${RED}`,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20,
                  color: RED,
                }}
              >
                ✗ Import failed: {result.error}
              </div>
            )}
            {result.errors && result.errors.length > 0 && (
              <details style={{ marginBottom: 20 }}>
                <summary style={{ color: TEXT2, cursor: "pointer" }}>
                  Show first {result.errors.length} errors
                </summary>
                <pre
                  style={{
                    fontSize: 11,
                    color: TEXT3,
                    background: "var(--surface-input)",
                    padding: 12,
                    borderRadius: 8,
                    overflow: "auto",
                    maxHeight: 300,
                  }}
                >
                  {result.errors
                    .map((e) => `Row ${e.index}: ${e.error}`)
                    .join("\n")}
                </pre>
              </details>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={handleClose} style={btnPrimary}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  background: ROSE,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
}

const btnSecondary: React.CSSProperties = {
  background: "var(--surface-input)",
  color: TEXT,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8,
  padding: "10px 18px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
}
