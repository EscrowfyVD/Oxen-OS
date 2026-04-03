"use client"

import { useState, useRef } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  GREEN, RED, ROSE_GOLD, getCategoryLabel, fmtFull,
} from "./constants"

interface ImportModalProps {
  onClose: () => void
  onImported: () => void
}

interface ParsedRow {
  type: string; category: string; description: string; amount: number
  currency: string; date: string; entity: string; paymentSource: string
  reference: string; notes: string
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8, padding: "8px 12px", color: TEXT_PRIMARY, fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}

export default function TransactionImportModal({ onClose, onImported }: ImportModalProps) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split("\n").filter((l) => l.trim())
      if (lines.length < 2) return

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
      const parsed: ParsedRow[] = []

      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map((v) => v.trim())
        const row: Record<string, string> = {}
        headers.forEach((h, j) => { row[h] = vals[j] || "" })

        parsed.push({
          type: row.type || "expense",
          category: row.category || "other_expense",
          description: row.description || "",
          amount: parseFloat(row.amount) || 0,
          currency: row.currency || "EUR",
          date: row.date || "",
          entity: row.entity || "oxen",
          paymentSource: row.payment_source || "",
          reference: row.reference || "",
          notes: row.notes || "",
        })
      }

      setRows(parsed.filter((r) => r.amount > 0 && r.date))
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await fetch("/api/finance/transactions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: rows }),
      })
      const data = await res.json()
      setResult(data.results)
      if (data.results?.success > 0) onImported()
    } catch {
      setResult({ success: 0, failed: rows.length, errors: ["Network error"] })
    }
    setImporting(false)
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slideUp"
        style={{ background: "#0A0B0F", border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 28, width: 640, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ fontFamily: "'Bellfair', serif", fontSize: 20, color: TEXT_PRIMARY, marginBottom: 6 }}>
          Import Transactions
        </div>
        <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginBottom: 20 }}>
          Upload a CSV with columns: date, type, category, description, amount, currency, entity, payment_source, reference, notes
        </div>

        {!result && (
          <>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile}
              style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ ...inputStyle, cursor: "pointer", textAlign: "center", padding: "16px 12px", borderStyle: "dashed", marginBottom: 16 }}>
              {rows.length > 0 ? `${rows.length} rows loaded — click to change file` : "Click to select CSV file"}
            </button>

            {rows.length > 0 && (
              <>
                <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16, border: `1px solid ${CARD_BORDER}`, borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                    <thead>
                      <tr>
                        {["Date", "Type", "Category", "Description", "Amount", "Entity"].map((h) => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: TEXT_TERTIARY, fontWeight: 600, borderBottom: `1px solid ${CARD_BORDER}`, fontFamily: "'DM Sans', sans-serif" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 20).map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: "4px 8px", color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{r.date}</td>
                          <td style={{ padding: "4px 8px", color: r.type === "revenue" ? GREEN : ROSE_GOLD, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{r.type}</td>
                          <td style={{ padding: "4px 8px", color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{getCategoryLabel(r.category)}</td>
                          <td style={{ padding: "4px 8px", color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)`, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
                          <td style={{ padding: "4px 8px", color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{fmtFull(r.amount)}</td>
                          <td style={{ padding: "4px 8px", color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{r.entity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 20 && <div style={{ padding: 8, textAlign: "center", color: TEXT_TERTIARY, fontSize: 10 }}>... and {rows.length - 20} more</div>}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button onClick={onClose}
                    style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`, background: "transparent", color: TEXT_SECONDARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleImport} disabled={importing} className="btn-primary"
                    style={{ padding: "8px 20px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                    {importing ? "Importing..." : `Import ${rows.length} Transactions`}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {result && (
          <div>
            <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: GREEN, fontFamily: "'DM Sans', sans-serif" }}>Imported: {result.success}</div>
              {result.failed > 0 && <div style={{ fontSize: 13, color: RED, fontFamily: "'DM Sans', sans-serif" }}>Failed: {result.failed}</div>}
            </div>
            {result.errors.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 16, padding: 12, background: "rgba(248,113,113,0.05)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.15)" }}>
                {result.errors.map((err, i) => (
                  <div key={i} style={{ fontSize: 10, color: RED, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{err}</div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={onClose} className="btn-primary" style={{ padding: "8px 20px", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
