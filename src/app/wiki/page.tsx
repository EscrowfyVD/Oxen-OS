"use client"

import { useEffect, useState } from "react"
import PageHeader from "@/components/layout/PageHeader"
import WikiPageCard, { WikiPage } from "@/components/wiki/WikiPageCard"
import Link from "next/link"

const CATEGORIES = ["All", "Process", "Legal", "Product", "HR", "General"]

export default function WikiListPage() {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")

  useEffect(() => {
    fetch("/api/wiki")
      .then((r) => r.json())
      .then((data) => setPages(data.pages ?? []))
      .catch(() => {})
  }, [])

  const filtered = pages.filter((p) => {
    const matchesSearch =
      search === "" ||
      p.title.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      activeCategory === "All" || p.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="page-content">
      <PageHeader
        title="Wiki"
        description="Knowledge base and documentation"
        actions={
          <Link href="/wiki/new" className="btn-primary no-underline">
            + New Page
          </Link>
        }
      />

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search wiki pages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="oxen-input"
        />
      </div>

      {/* Category pills */}
      <div
        className="flex items-center gap-2 flex-wrap"
        style={{ marginBottom: 24 }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "7px 16px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border:
                activeCategory === cat
                  ? "1px solid var(--border-active)"
                  : "1px solid var(--border)",
              background:
                activeCategory === cat
                  ? "var(--rose-dim)"
                  : "var(--bg-card)",
              color:
                activeCategory === cat ? "var(--rose)" : "var(--text-dim)",
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s ease",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Pages grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {filtered.map((page) => (
          <WikiPageCard key={page.id} page={page} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div
          className="flex flex-col items-center justify-center"
          style={{ padding: "64px 0", color: "var(--text-dim)" }}
        >
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>{"\uD83D\uDCDD"}</div>
          <div style={{ fontSize: 13 }}>
            {pages.length === 0
              ? "No wiki pages yet. Create your first page to get started."
              : "No pages match your search."}
          </div>
        </div>
      )}
    </div>
  )
}
