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
    <div>
      <PageHeader
        title="Wiki"
        description="Knowledge base and documentation"
        actions={
          <Link href="/wiki/new" className="btn-primary text-sm no-underline">
            + New Page
          </Link>
        }
      />

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search wiki pages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
          style={{
            padding: "10px 14px",
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            color: "var(--text)",
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border-none transition-all duration-150"
            style={{
              background:
                activeCategory === cat
                  ? "var(--rose-dim)"
                  : "var(--bg-card)",
              color:
                activeCategory === cat ? "var(--rose)" : "var(--text-dim)",
              border:
                activeCategory === cat
                  ? "1px solid var(--border-active)"
                  : "1px solid var(--border)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Pages grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((page) => (
          <WikiPageCard key={page.id} page={page} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div
          className="text-center py-16"
          style={{ color: "var(--text-dim)" }}
        >
          <div className="text-4xl mb-3">{"\uD83D\uDCDD"}</div>
          <div className="text-sm">
            {pages.length === 0
              ? "No wiki pages yet. Create your first page to get started."
              : "No pages match your search."}
          </div>
        </div>
      )}
    </div>
  )
}
