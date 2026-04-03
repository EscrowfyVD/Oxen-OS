"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CRM_COLORS, STAGE_LABELS } from "@/lib/crm-config"

/* ── Types ── */

interface SearchResult {
  id: string
  type: "contact" | "company" | "deal"
  name: string
  secondary: string | null
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

/* ── Icons ── */

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="5" y="4" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="9" y="4" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="5" y="8" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="9" y="8" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="6.5" y="11" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

function HandshakeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 9l3-4h2l2 2 2-2h2l3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 11l2 2 2-1 2 1 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/* ── Helpers ── */

const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string; route: string }> = {
  contact: { label: "Contacts", icon: <PersonIcon />, color: CRM_COLORS.rose_gold, route: "/crm/contacts" },
  company: { label: "Companies", icon: <BuildingIcon />, color: CRM_COLORS.indigo, route: "/crm/companies" },
  deal: { label: "Deals", icon: <HandshakeIcon />, color: CRM_COLORS.green, route: "/crm/deals" },
}

/* ── Component ── */

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  /* Global keyboard shortcut registration */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        /* Toggle is handled by parent, but if this component manages its own state
           the parent should call onClose to toggle. We just prevent default here. */
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  /* Focus input when opened */
  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  /* Debounced search */
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/crm/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data.results ?? [])
          setSelectedIndex(0)
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  /* Navigate to result */
  const navigateTo = useCallback((result: SearchResult) => {
    const cfg = typeConfig[result.type]
    if (cfg) {
      router.push(`${cfg.route}/${result.id}`)
    }
    onClose()
  }, [router, onClose])

  /* Keyboard navigation */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault()
      navigateTo(results[selectedIndex])
    }
  }

  /* Group results by type */
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    ;(acc[r.type] ??= []).push(r)
    return acc
  }, {})

  /* Track flat index for keyboard navigation */
  let flatIndex = -1

  if (!open) return null

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "18vh",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #0D0F14 0%, #0A0B0F 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, width: "100%", maxWidth: 600,
          boxShadow: CRM_COLORS.glass_shadow,
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <span style={{ color: CRM_COLORS.text_tertiary, display: "flex" }}>
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search contacts, companies, deals..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: CRM_COLORS.text_primary, fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <kbd style={{
            padding: "2px 6px", borderRadius: 4, fontSize: 10,
            background: "rgba(255,255,255,0.06)", color: CRM_COLORS.text_tertiary,
            fontFamily: "'DM Sans', sans-serif", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "8px 0" }}>
          {loading && (
            <div style={{
              padding: "20px 0", textAlign: "center",
              fontSize: 12, color: CRM_COLORS.text_tertiary,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Searching...
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div style={{
              padding: "24px 0", textAlign: "center",
              fontSize: 12, color: CRM_COLORS.text_tertiary,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              No results found for &quot;{query}&quot;
            </div>
          )}

          {!loading && Object.entries(grouped).map(([type, items]) => {
            const cfg = typeConfig[type]
            if (!cfg) return null
            return (
              <div key={type}>
                {/* Group header */}
                <div style={{
                  padding: "8px 20px 4px",
                  fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5,
                  color: CRM_COLORS.text_tertiary, fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                }}>
                  {cfg.label}
                </div>

                {items.map((result) => {
                  flatIndex++
                  const isSelected = flatIndex === selectedIndex
                  const currentFlatIndex = flatIndex

                  return (
                    <div
                      key={result.id}
                      onClick={() => navigateTo(result)}
                      onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 20px", cursor: "pointer",
                        background: isSelected ? "rgba(255,255,255,0.04)" : "transparent",
                        transition: "background 0.1s ease",
                      }}
                    >
                      <span style={{ color: cfg.color, display: "flex", flexShrink: 0 }}>
                        {cfg.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, color: CRM_COLORS.text_primary,
                          fontFamily: "'DM Sans', sans-serif",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {result.name}
                        </div>
                        {result.secondary && (
                          <div style={{
                            fontSize: 11, color: CRM_COLORS.text_tertiary,
                            fontFamily: "'DM Sans', sans-serif", marginTop: 1,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {type === "deal" && STAGE_LABELS[result.secondary]
                              ? STAGE_LABELS[result.secondary]
                              : result.secondary}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <span style={{
                          fontSize: 10, color: CRM_COLORS.text_tertiary,
                          fontFamily: "'DM Sans', sans-serif",
                        }}>
                          Enter
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        {!query.trim() && (
          <div style={{
            padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex", gap: 16, justifyContent: "center",
          }}>
            {[
              { icon: <PersonIcon />, label: "Contacts", color: CRM_COLORS.rose_gold },
              { icon: <BuildingIcon />, label: "Companies", color: CRM_COLORS.indigo },
              { icon: <HandshakeIcon />, label: "Deals", color: CRM_COLORS.green },
            ].map((h) => (
              <span key={h.label} style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 10, color: CRM_COLORS.text_tertiary,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                <span style={{ color: h.color, display: "flex" }}>{h.icon}</span>
                {h.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
