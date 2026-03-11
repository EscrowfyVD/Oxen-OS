"use client"

import { useState, useEffect } from "react"
import {
  CARD_BG, CARD_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
  ROSE_GOLD,
  INTEL_TYPES, CONTENT_TAGS,
} from "./constants"
import type { MarketingIntel } from "./types"

interface IntelModalProps {
  intel: MarketingIntel | null
  onClose: () => void
  onSave: () => void
}

interface IntelForm {
  type: string
  title: string
  source: string
  summary: string
  relevance: string
  tags: string[]
}

const emptyForm: IntelForm = {
  type: "trend", title: "", source: "", summary: "", relevance: "medium", tags: [],
}

export default function IntelModal({ intel, onClose, onSave }: IntelModalProps) {
  const [form, setForm] = useState<IntelForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (intel) {
      setForm({
        type: intel.type,
        title: intel.title,
        source: intel.source || "",
        summary: intel.summary,
        relevance: intel.relevance,
        tags: intel.tags || [],
      })
    } else {
      setForm(emptyForm)
    }
  }, [intel])

  const set = (key: keyof IntelForm, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim()) return
    setSaving(true)
    try {
      const url = intel ? `/api/marketing/intel/${intel.id}` : "/api/marketing/intel"
      const method = intel ? "PATCH" : "POST"
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          title: form.title.trim(),
          source: form.source || null,
          summary: form.summary.trim(),
          relevance: form.relevance,
          tags: form.tags,
        }),
      })
      onSave()
    } catch { /* silent */ }
    setSaving(false)
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
          width: 520, maxHeight: "85vh", overflow: "auto",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: CARD_BG, zIndex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
            {intel ? "Edit Intel" : "Add Marketing Intel"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_TERTIARY, cursor: "pointer", fontSize: 18 }}>{"\u2715"}</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Type */}
          <div>
            <label style={lblSt}>Type</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {INTEL_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => set("type", t.id)}
                  style={{
                    padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                    border: `1px solid ${form.type === t.id ? t.color : CARD_BORDER}`,
                    background: form.type === t.id ? t.bg : "transparent",
                    color: form.type === t.id ? t.color : TEXT_TERTIARY,
                    transition: "all 0.15s",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={lblSt}>Title *</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Intel title..." style={inpSt} />
          </div>

          {/* Source */}
          <div>
            <label style={lblSt}>Source</label>
            <input type="text" value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="URL or source name" style={inpSt} />
          </div>

          {/* Summary */}
          <div>
            <label style={lblSt}>Summary *</label>
            <textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="Key insights and relevance to Oxen..." rows={4} style={{ ...inpSt, resize: "vertical", minHeight: 80 }} />
          </div>

          {/* Relevance */}
          <div>
            <label style={lblSt}>Relevance</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["high", "medium", "low"] as const).map((r) => {
                const colors = { high: "#F87171", medium: "#FBBF24", low: TEXT_TERTIARY }
                return (
                  <button
                    key={r}
                    onClick={() => set("relevance", r)}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 11, fontWeight: 500,
                      fontFamily: "'DM Sans', sans-serif", cursor: "pointer", textTransform: "capitalize",
                      border: `1px solid ${form.relevance === r ? colors[r] : CARD_BORDER}`,
                      background: form.relevance === r ? `${colors[r]}15` : "transparent",
                      color: form.relevance === r ? colors[r] : TEXT_TERTIARY,
                      transition: "all 0.15s",
                    }}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={lblSt}>Tags</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[...CONTENT_TAGS, "igaming", "crypto", "fintech", "pricing", "technology"].map((tag) => {
                const active = form.tags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 10, cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      border: `1px solid ${active ? ROSE_GOLD : CARD_BORDER}`,
                      background: active ? "rgba(192,139,136,0.1)" : "transparent",
                      color: active ? ROSE_GOLD : TEXT_TERTIARY,
                      transition: "all 0.15s",
                    }}
                  >
                    {tag.replace(/_/g, " ")}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${CARD_BORDER}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "8px 16px", fontSize: 11 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.summary.trim()} className="btn-primary" style={{ padding: "8px 16px", fontSize: 11, opacity: (!form.title.trim() || !form.summary.trim()) ? 0.5 : 1 }}>
            {saving ? "Saving..." : intel ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

const lblSt: React.CSSProperties = {
  display: "block", fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase",
  letterSpacing: 1, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
}
const inpSt: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${CARD_BORDER}`,
  background: "rgba(255,255,255,0.02)", color: TEXT_PRIMARY, fontSize: 12,
  fontFamily: "'DM Sans', sans-serif", outline: "none",
}
