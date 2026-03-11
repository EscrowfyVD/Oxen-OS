"use client"

import { useState, useRef } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD, GREEN, RED, getCategoryLabel,
} from "./constants"

interface ImportModalProps {
  onClose: () => void
  onDone: () => void
}

interface CsvRow {
  date: string
  type: string
  category: string
  description: string
  amount: string
  currency: string
  entity: string
  [key: string]: string
}

export default function ImportModal({ onClose, onDone }: ImportModalProps) {
  const [rows, setRows] = useState<CsvRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; errors: Array<{ row: number; error: string }> } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
      if (lines.length < 2) return

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ""))
      const parsed: CsvRow[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        const row: Record<string, string> = {}
        headers.forEach((h, j) => { row[h] = values[j]?.trim() || "" })
        parsed.push(row as CsvRow)
      }

      setRows(parsed)
      setResult(null)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await fetch("/api/finance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      setResult({ created: data.created, errors: data.errors || [] })
      if (data.created > 0) {
        setTimeout(() => onDone(), 1500)
      }
    } catch {
      // ignore
    }
    setImporting(false)
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16,
          width: 720, maxHeight: "85vh", overflow: "auto",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
            Import from CSV
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", fontSize: 18 }}>
            {"\u2715"}
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Upload area */}
          {rows.length === 0 && (
            <div>
              <div style={{
                border: `2px dashed ${CARD_BORDER}`, borderRadius: 12, padding: "40px 20px",
                textAlign: "center", cursor: "pointer",
              }} onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{"\uD83D\uDCC4"}</div>
                <div style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
                  Click to upload CSV file
                </div>
                <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                  Columns: date, type, category, description, amount, currency, entity
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{ display: "none" }} />

              <div style={{ marginTop: 16, fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
                <strong style={{ color: TEXT_SECONDARY }}>Tip:</strong> Export from Google Sheets as CSV. Required columns: date, type, category, amount. Optional: description, currency (default EUR), entity (default oxen).
              </div>
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !result && (
            <div>
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
                Preview: {rows.length} rows found
              </div>
              <div style={{ overflow: "auto", maxHeight: 350, border: `1px solid ${CARD_BORDER}`, borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                  <thead>
                    <tr>
                      {["#", "Date", "Type", "Category", "Description", "Amount", "Currency", "Entity"].map((h) => (
                        <th key={h} style={{
                          textAlign: "left", padding: "8px 10px", fontSize: 9, fontWeight: 600,
                          color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 0.5,
                          borderBottom: `1px solid ${CARD_BORDER}`, fontFamily: "'DM Sans', sans-serif",
                          background: "rgba(255,255,255,0.02)", position: "sticky", top: 0,
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        <td style={previewTd}>{i + 1}</td>
                        <td style={previewTd}>{row.date}</td>
                        <td style={previewTd}>{row.type}</td>
                        <td style={previewTd}>{getCategoryLabel(row.category)}</td>
                        <td style={{ ...previewTd, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.description || "—"}
                        </td>
                        <td style={previewTd}>{row.amount}</td>
                        <td style={previewTd}>{row.currency || "EUR"}</td>
                        <td style={previewTd}>{row.entity || "oxen"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 20 && (
                <div style={{ marginTop: 8, fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                  Showing first 20 of {rows.length} rows
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div>
              <div style={{ fontSize: 14, color: result.created > 0 ? GREEN : RED, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
                {result.created > 0 ? `\u2713 ${result.created} entries imported successfully` : "No entries imported"}
              </div>
              {result.errors.length > 0 && (
                <div style={{ fontSize: 11, color: RED, fontFamily: "'DM Sans', sans-serif" }}>
                  {result.errors.length} errors:
                  <ul style={{ margin: "4px 0 0 16px" }}>
                    {result.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>Row {e.row}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && !result && (
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={() => { setRows([]); if (fileRef.current) fileRef.current.value = "" }}
              className="btn-secondary"
              style={{ padding: "8px 16px", fontSize: 11 }}
            >
              Clear
            </button>
            <button onClick={handleImport} disabled={importing} className="btn-primary" style={{ padding: "8px 20px", fontSize: 12 }}>
              {importing ? "Importing..." : `Import ${rows.length} Entries`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

const previewTd: React.CSSProperties = {
  padding: "6px 10px", fontSize: 11, color: TEXT_SECONDARY,
  fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)`,
}
