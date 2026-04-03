"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import WikiPageCard, { WikiPage, getCategoryColor } from "@/components/wiki/WikiPageCard"

const CATEGORIES = ["All", "Process", "Legal", "Product", "HR", "Finance", "Compliance", "General"]

const FROST = "#F0F0F2"
const CARD_BG = "rgba(15,17,24,0.6)"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"

/* ── Drive types ── */
interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  iconLink: string
  modifiedTime: string
  starred: boolean
  owners?: Array<{ displayName: string }>
}

function getMimeIcon(mimeType: string): string {
  if (mimeType === "application/vnd.google-apps.folder") return "\uD83D\uDCC1"
  if (mimeType.includes("document") || mimeType.includes("word")) return "\uD83D\uDCC4"
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "\uD83D\uDCCA"
  if (mimeType.includes("presentation")) return "\uD83D\uDCCA"
  if (mimeType.includes("pdf")) return "\uD83D\uDCC4"
  if (mimeType.includes("image")) return "\uD83D\uDDBC\uFE0F"
  return "\uD83D\uDCC4"
}

function getMimeLabel(mimeType: string): string {
  if (mimeType === "application/vnd.google-apps.folder") return "Folder"
  if (mimeType === "application/vnd.google-apps.document") return "Doc"
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "Sheet"
  if (mimeType === "application/vnd.google-apps.presentation") return "Slides"
  if (mimeType.includes("pdf")) return "PDF"
  if (mimeType.includes("image")) return "Image"
  return "File"
}

/* ── Tree types ── */
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

/* ── Drive Browser Inline ── */
function DriveBrowser() {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [starredFiles, setStarredFiles] = useState<DriveFile[]>([])
  const [search, setSearch] = useState("")
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [error, setError] = useState<string | null>(null)

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : undefined

  const fetchFiles = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (currentFolderId) params.set("folderId", currentFolderId)
    if (search) params.set("q", search)

    const url = `/api/drive/files?${params}`
    console.log("[Drive Browser] Fetching:", url)

    fetch(url)
      .then((r) => {
        console.log("[Drive Browser] Response status:", r.status)
        return r.json()
      })
      .then((data) => {
        console.log("[Drive Browser] Response data:", data)
        if (data.error) {
          console.error("[Drive Browser] API error:", data.error)
          setError(data.error)
          setFiles([])
        } else {
          console.log("[Drive Browser] Files count:", data.files?.length ?? 0)
          setFiles(data.files ?? [])
        }
      })
      .catch((err) => {
        console.error("[Drive Browser] Fetch failed:", err)
        setFiles([])
      })
      .finally(() => setLoading(false))
  }, [currentFolderId, search])

  useEffect(() => {
    const timer = setTimeout(fetchFiles, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchFiles, search])

  useEffect(() => {
    console.log("[Drive Browser] Fetching starred files...")
    fetch("/api/drive/starred")
      .then((r) => {
        console.log("[Drive Browser] Starred response status:", r.status)
        return r.json()
      })
      .then((data) => {
        console.log("[Drive Browser] Starred data:", data)
        setStarredFiles(data.files ?? [])
      })
      .catch((err) => {
        console.error("[Drive Browser] Starred fetch failed:", err)
      })
  }, [])

  const navigateFolder = (file: DriveFile) => {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      setFolderStack([...folderStack, { id: file.id, name: file.name }])
      setSearch("")
    }
  }

  const navigateBreadcrumb = (index: number) => {
    setFolderStack(folderStack.slice(0, index + 1))
    setSearch("")
  }

  const goToRoot = () => {
    setFolderStack([])
    setSearch("")
  }

  const openFile = (file: DriveFile) => {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      navigateFolder(file)
    } else {
      window.open(file.webViewLink, "_blank")
    }
  }

  return (
    <div>
      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search Google Drive..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 8,
            border: `1px solid ${CARD_BORDER}`, background: "rgba(255,255,255,0.04)",
            color: FROST, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
            outline: "none", transition: "border-color 0.2s",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.25)" }}
          onBlur={(e) => { e.currentTarget.style.borderColor = CARD_BORDER }}
        />
      </div>

      {/* Breadcrumbs + view toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <span
          onClick={goToRoot}
          style={{ fontSize: 12, color: folderStack.length > 0 ? ROSE_GOLD : TEXT_SECONDARY, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
        >
          My Drive
        </span>
        {folderStack.map((f, i) => (
          <span key={f.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>/</span>
            <span
              onClick={() => navigateBreadcrumb(i)}
              style={{
                fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                color: i === folderStack.length - 1 ? TEXT_SECONDARY : ROSE_GOLD,
              }}
            >
              {f.name}
            </span>
          </span>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button
            onClick={() => setViewMode("list")}
            style={{
              padding: "4px 10px", borderRadius: 4, fontSize: 10, cursor: "pointer",
              border: `1px solid ${viewMode === "list" ? "rgba(192,139,136,0.3)" : CARD_BORDER}`,
              background: viewMode === "list" ? "rgba(192,139,136,0.1)" : "transparent",
              color: viewMode === "list" ? ROSE_GOLD : TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("grid")}
            style={{
              padding: "4px 10px", borderRadius: 4, fontSize: 10, cursor: "pointer",
              border: `1px solid ${viewMode === "grid" ? "rgba(192,139,136,0.3)" : CARD_BORDER}`,
              background: viewMode === "grid" ? "rgba(192,139,136,0.1)" : "transparent",
              color: viewMode === "grid" ? ROSE_GOLD : TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Starred files */}
      {!search && folderStack.length === 0 && starredFiles.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 10 }}>
            {"\u2B50"} Starred
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {starredFiles.slice(0, 6).map((file) => (
              <div
                key={file.id}
                onClick={() => openFile(file)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.15)" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = CARD_BORDER }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{getMimeIcon(file.mimeType)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: FROST, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
                    {getMimeLabel(file.mimeType)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
          Loading Drive files...
        </div>
      )}

      {!loading && error && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>{"\uD83D\uDD12"}</div>
          <div style={{ fontSize: 13, color: "#F87171", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
            {error}
          </div>
          <div style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
            Go to Settings, sign out, and sign back in to grant Google Drive access.
          </div>
        </div>
      )}

      {!loading && !error && files.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
          {search ? "No files match your search" : "This folder is empty"}
        </div>
      )}

      {/* Section label */}
      {!loading && files.length > 0 && (
        <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 10 }}>
          {search ? `Results for "${search}"` : folderStack.length > 0 ? folderStack[folderStack.length - 1].name : "Recent Files"}
        </div>
      )}

      {/* List view */}
      {!loading && viewMode === "list" && files.map((file) => {
        const isFolder = file.mimeType === "application/vnd.google-apps.folder"

        return (
          <div
            key={file.id}
            onClick={() => openFile(file)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              borderRadius: 6, cursor: "pointer",
              background: "transparent", transition: "all 0.15s", marginBottom: 2,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{getMimeIcon(file.mimeType)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, color: FROST, fontFamily: "'DM Sans', sans-serif",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {file.starred && <span style={{ marginRight: 4, color: "#FBBF24" }}>{"\u2605"}</span>}
                {file.name}
              </div>
            </div>
            <span style={{
              fontSize: 9, padding: "2px 6px", borderRadius: 4,
              background: "rgba(255,255,255,0.04)", color: TEXT_TERTIARY,
              fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
            }}>
              {getMimeLabel(file.mimeType)}
            </span>
            <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", flexShrink: 0, minWidth: 50, textAlign: "right" }}>
              {new Date(file.modifiedTime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
            {file.owners?.[0] && (
              <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", flexShrink: 0, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.owners[0].displayName}
              </span>
            )}
            {!isFolder && (
              <a
                href={file.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: "3px 8px", borderRadius: 4, fontSize: 9,
                  border: "1px solid rgba(192,139,136,0.2)", background: "transparent",
                  color: ROSE_GOLD, textDecoration: "none",
                  fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                }}
              >
                Open in Drive
              </a>
            )}
          </div>
        )
      })}

      {/* Grid view */}
      {!loading && viewMode === "grid" && files.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {files.map((file) => (
            <div
              key={file.id}
              onClick={() => openFile(file)}
              style={{
                padding: "16px 12px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.15)" }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = CARD_BORDER }}
            >
              <div style={{ fontSize: 30, marginBottom: 8 }}>{getMimeIcon(file.mimeType)}</div>
              <div style={{ fontSize: 11, color: FROST, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </div>
              <div style={{ fontSize: 9, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", marginTop: 4 }}>
                {getMimeLabel(file.mimeType)} &middot; {new Date(file.modifiedTime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main Wiki List Page ── */
export default function WikiListPage() {
  const router = useRouter()
  const [pages, setPages] = useState<WikiPage[]>([])
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<"pages" | "drive">("pages")

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
        <div className="fade-in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 32, color: FROST, fontWeight: 400, margin: 0, lineHeight: 1.2 }}>
              Wiki
            </h1>
            <p style={{ fontSize: 12, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif", margin: "4px 0 0" }}>
              {pages.length} page{pages.length !== 1 ? "s" : ""} in knowledge base
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Tab toggle */}
            <div className="toggle-group">
              <button
                onClick={() => setActiveTab("pages")}
                className={`toggle-btn ${activeTab === "pages" ? "active" : ""}`}
              >
                {"\uD83D\uDCDD"} Pages
              </button>
              <button
                onClick={() => setActiveTab("drive")}
                className={`toggle-btn ${activeTab === "drive" ? "active" : ""}`}
              >
                {"\uD83D\uDCC1"} Drive
              </button>
            </div>

            {activeTab === "pages" && (
              <button className="header-btn" onClick={handleNewPage}>
                + New Page
              </button>
            )}
          </div>
        </div>

        {/* ── Pages Tab ── */}
        {activeTab === "pages" && (
          <>
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
          </>
        )}

        {/* ── Drive Tab ── */}
        {activeTab === "drive" && (
          <div className="fade-in" style={{ animationDelay: "0.05s" }}>
            <DriveBrowser />
          </div>
        )}
      </div>
    </div>
  )
}
