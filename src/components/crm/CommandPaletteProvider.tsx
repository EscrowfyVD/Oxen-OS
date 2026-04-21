"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

const CARD_BG = "var(--card-bg-solid)"
const CARD_BORDER = "var(--card-border)"
const TEXT_PRIMARY = "var(--text-primary)"
const TEXT_SECONDARY = "var(--text-secondary)"
const TEXT_TERTIARY = "var(--text-tertiary)"
const ROSE_GOLD = "var(--rose-gold)"

interface SearchResult {
  id: string
  type: "page" | "contact" | "company" | "deal"
  label: string
  sublabel?: string
  href: string
}

const PAGES: SearchResult[] = [
  { id: "dashboard", type: "page", label: "Dashboard", href: "/" },
  { id: "crm", type: "page", label: "CRM Pipeline", href: "/crm" },
  { id: "contacts", type: "page", label: "CRM Contacts", href: "/crm/contacts" },
  { id: "companies", type: "page", label: "CRM Companies", href: "/crm/companies" },
  { id: "inbox", type: "page", label: "CRM Inbox", href: "/crm/inbox" },
  { id: "reports", type: "page", label: "CRM Reports", href: "/crm/reports" },
  { id: "tasks", type: "page", label: "Tasks", href: "/tasks" },
  { id: "calendar", type: "page", label: "Calendar", href: "/calendar" },
  { id: "wiki", type: "page", label: "Wiki", href: "/wiki" },
  { id: "finance", type: "page", label: "Finance", href: "/finance" },
  { id: "marketing", type: "page", label: "Marketing", href: "/marketing" },
  { id: "support", type: "page", label: "Support", href: "/support" },
  { id: "intel", type: "page", label: "Intel", href: "/intel" },
  { id: "conferences", type: "page", label: "Conferences", href: "/conferences" },
  { id: "settings", type: "page", label: "Settings", href: "/settings" },
]

export default function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [apiResults, setApiResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search CRM API
  useEffect(() => {
    if (!query || query.length < 2) {
      setApiResults([])
      return
    }

    const timeout = setTimeout(() => {
      fetch(`/api/crm/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          const items: SearchResult[] = []
          if (data.contacts) {
            for (const c of data.contacts) {
              items.push({
                id: `contact-${c.id}`,
                type: "contact",
                label: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email || "Unknown",
                sublabel: c.company?.name ?? c.email ?? undefined,
                href: `/crm/${c.id}`,
              })
            }
          }
          if (data.companies) {
            for (const co of data.companies) {
              items.push({
                id: `company-${co.id}`,
                type: "company",
                label: co.name,
                sublabel: co.industry ?? co.geoZone ?? undefined,
                href: `/crm/companies/${co.id}`,
              })
            }
          }
          if (data.deals) {
            for (const d of data.deals) {
              items.push({
                id: `deal-${d.id}`,
                type: "deal",
                label: d.dealName,
                sublabel: d.dealOwner ?? undefined,
                href: `/crm/${d.contactId}`,
              })
            }
          }
          setApiResults(items)
        })
        .catch(() => setApiResults([]))
    }, 250)

    return () => clearTimeout(timeout)
  }, [query])

  // Merge results
  useEffect(() => {
    const lowerQ = query.toLowerCase()
    const pageMatches = query
      ? PAGES.filter((p) => p.label.toLowerCase().includes(lowerQ))
      : PAGES.slice(0, 6)
    setResults([...pageMatches, ...apiResults].slice(0, 12))
    setSelectedIndex(0)
  }, [query, apiResults])

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigate(results[selectedIndex].href)
    }
  }

  const typeBadge = (type: SearchResult["type"]) => {
    const colors: Record<string, string> = {
      page: TEXT_TERTIARY,
      contact: "var(--indigo)",
      company: "var(--green)",
      deal: "var(--amber)",
    }
    return (
      <span
        style={{
          fontSize: 9,
          fontWeight: 500,
          color: colors[type] ?? TEXT_TERTIARY,
          background: `${colors[type] ?? TEXT_TERTIARY}18`,
          padding: "1px 6px",
          borderRadius: 4,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {type}
      </span>
    )
  }

  return (
    <>
      {children}

      {/* Overlay */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "15vh",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 16,
              boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--surface-elevated)",
              overflow: "hidden",
              color: "var(--text-primary)",
            }}
          >
            {/* Search input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 18px",
                borderBottom: `1px solid ${CARD_BORDER}`,
              }}
            >
              <Search size={16} strokeWidth={1.8} style={{ color: TEXT_TERTIARY, flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search pages, contacts, companies..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontSize: 14,
                  color: TEXT_PRIMARY,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "var(--card-border)",
                  border: "none",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 10,
                  color: TEXT_TERTIARY,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ESC
              </button>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 380, overflowY: "auto", padding: "6px 0" }}>
              {results.length === 0 && query.length > 0 && (
                <div style={{ padding: "24px 18px", textAlign: "center", fontSize: 13, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                  No results found
                </div>
              )}
              {results.map((result, i) => (
                <button
                  key={result.id}
                  onClick={() => navigate(result.href)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 18px",
                    background: i === selectedIndex ? "var(--surface-elevated)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.1s",
                  }}
                >
                  {typeBadge(result.type)}
                  <span style={{ flex: 1, fontSize: 13, color: TEXT_PRIMARY, fontFamily: "'DM Sans', sans-serif" }}>
                    {result.label}
                  </span>
                  {result.sublabel && (
                    <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                      {result.sublabel}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div
              style={{
                padding: "8px 18px",
                borderTop: `1px solid ${CARD_BORDER}`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                Navigate with arrow keys, Enter to select
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
