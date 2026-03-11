"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import WikiPageCard, { WikiPage, getCategoryColor } from "@/components/wiki/WikiPageCard"

const CATEGORIES = ["All", "Process", "Legal", "Product", "HR", "Finance", "Compliance", "General"]

const FROST = "#F0F0F2"
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"

interface TreeNode extends WikiPage {
  children: TreeNode[]
}

function buildTree(pages: WikiPage[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const p of pages) {
    map.set(p.id, { ...p, children: [] })
  }

  for (const p of pages) {
    const node = map.get(p.id)!
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function TreeItem({
  node,
  depth,
  expanded,
  toggleExpand,
  activePage,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  toggleExpand: (id: string) => void
  activePage: string | null
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const isActive = activePage === node.slug

  return (
    <>
      <Link
        href={`/wiki/${node.slug}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          paddingLeft: 12 + depth * 16,
          textDecoration: "none",
          borderRadius: 6,
          background: isActive ? "rgba(192,139,136,0.08)" : "transparent",
          transition: "background 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent"
        }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleExpand(node.id)
            }}
            style={{
              width: 16,
              height: 16,
              border: "none",
              background: "none",
              color: TEXT_TERTIARY,
              fontSize: 9,
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "transform 0.15s",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            {"\u25B6"}
          </button>
        )}
        {!hasChildren && <div style={{ width: 16, flexShrink: 0 }} />}

        {node.pinned && (
          <span style={{ fontSize: 9, flexShrink: 0 }}>{"\uD83D\uDCCC"}</span>
        )}

        <span style={{ fontSize: 13, flexShrink: 0 }}>{node.icon || "\uD83D\uDCDD"}</span>
        <span
          style={{
            fontSize: 12,
            color: isActive ? FROST : TEXT_SECONDARY,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: isActive ? 500 : 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {node.title}
        </span>
      </Link>

      {hasChildren && isExpanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggleExpand={toggleExpand}
            activePage={activePage}
          />
        ))}
    </>
  )
}

export default function WikiListPage() {
  const router = useRouter()
  const [pages, setPages] = useState<WikiPage[]>([])
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/wiki")
      .then((r) => r.json())
      .then((data) => setPages(data.pages ?? []))
      .catch(() => {})
  }, [])

  const tree = useMemo(() => buildTree(pages), [pages])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    return pages.filter((p) => {
      if (p.archived) return false
      const matchesSearch =
        search === "" ||
        p.title.toLowerCase().includes(search.toLowerCase())
      const matchesCategory =
        activeCategory === "All" || p.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [pages, search, activeCategory])

  const pinnedPages = useMemo(() => filtered.filter((p) => p.pinned), [filtered])
  const recentPages = useMemo(() => {
    return [...filtered]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 12)
  }, [filtered])

  const handleNewPage = async () => {
    try {
      const res = await fetch("/api/wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled",
          icon: "\uD83D\uDCDD",
          category: "General",
        }),
      })
      const data = await res.json()
      const slug = data.page?.slug || data.slug
      if (slug) {
        router.push(`/wiki/${slug}/edit`)
      }
    } catch {
      /* silent */
    }
  }

  return (
    <div className="page-content" style={{ padding: 0, display: "flex", height: "calc(100vh - 0px)" }}>
      {/* ── Sidebar Tree ── */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: `1px solid ${CARD_BORDER}`,
          display: "flex",
          flexDirection: "column",
          background: "rgba(6,7,9,0.5)",
          overflowY: "auto",
        }}
      >
        {/* Sidebar Header */}
        <div style={{ padding: "20px 16px 12px", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: "'Bellfair', serif", fontSize: 18, color: FROST }}>
              Wiki
            </span>
            <button
              onClick={handleNewPage}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: `1px solid ${CARD_BORDER}`,
                background: "rgba(255,255,255,0.04)",
                color: TEXT_SECONDARY,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(192,139,136,0.3)"
                e.currentTarget.style.color = ROSE_GOLD
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = CARD_BORDER
                e.currentTarget.style.color = TEXT_SECONDARY
              }}
              title="New Page"
            >
              +
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${CARD_BORDER}`,
              background: "rgba(255,255,255,0.04)",
              color: FROST,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.25)" }}
            onBlur={(e) => { e.currentTarget.style.borderColor = CARD_BORDER }}
          />
        </div>

        {/* Page Tree */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 4px" }}>
          {/* Pinned section */}
          {pages.some((p) => p.pinned) && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "4px 12px" }}>
                Pinned
              </div>
              {tree
                .filter((n) => n.pinned)
                .map((node) => (
                  <TreeItem key={node.id} node={node} depth={0} expanded={expanded} toggleExpand={toggleExpand} activePage={null} />
                ))}
            </div>
          )}

          {/* All pages */}
          <div style={{ fontSize: 9, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, padding: "4px 12px" }}>
            Pages
          </div>
          {tree
            .filter((n) => !n.pinned)
            .map((node) => (
              <TreeItem key={node.id} node={node} depth={0} expanded={expanded} toggleExpand={toggleExpand} activePage={null} />
            ))}

          {pages.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 12px", color: TEXT_TERTIARY, fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
              No pages yet
            </div>
          )}
        </div>
      </div>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {/* Header */}
        <div className="fade-in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 28, color: FROST, fontWeight: 400, margin: 0, lineHeight: 1.2 }}>
              Wiki
            </h1>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", margin: "4px 0 0" }}>
              {pages.length} page{pages.length !== 1 ? "s" : ""} in knowledge base
            </p>
          </div>
          <button className="header-btn" onClick={handleNewPage}>
            + New Page
          </button>
        </div>

        {/* Category pills */}
        <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 24, animationDelay: "0.05s" }}>
          {CATEGORIES.map((cat) => {
            const colors = getCategoryColor(cat === "All" ? null : cat)
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                  border: `1px solid ${isActive ? "rgba(192,139,136,0.4)" : CARD_BORDER}`,
                  background: isActive ? "rgba(192,139,136,0.1)" : "transparent",
                  color: isActive ? ROSE_GOLD : TEXT_SECONDARY,
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.15s ease",
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* Pinned Pages */}
        {pinnedPages.length > 0 && activeCategory === "All" && !search && (
          <div className="fade-in" style={{ marginBottom: 28, animationDelay: "0.1s" }}>
            <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 12 }}>
              {"\uD83D\uDCCC"} Pinned
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {pinnedPages.map((page) => (
                <WikiPageCard key={page.id} page={page} />
              ))}
            </div>
          </div>
        )}

        {/* Recent / Filtered Pages */}
        <div className="fade-in" style={{ animationDelay: "0.15s" }}>
          <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 12 }}>
            {search ? `Results for "${search}"` : activeCategory !== "All" ? activeCategory : "Recent Pages"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {recentPages
              .filter((p) => !p.pinned || search || activeCategory !== "All")
              .map((page) => (
                <WikiPageCard key={page.id} page={page} />
              ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0", color: TEXT_TERTIARY }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>{"\uD83D\uDCDD"}</div>
            <div style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              {pages.length === 0
                ? "No wiki pages yet. Create your first page to get started."
                : "No pages match your search."}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
