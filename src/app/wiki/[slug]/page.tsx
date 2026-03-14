"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { generateHTML } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import LinkExtension from "@tiptap/extension-link"
import ImageExtension from "@tiptap/extension-image"
import CodeBlock from "@tiptap/extension-code-block"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import Highlight from "@tiptap/extension-highlight"
import Underline from "@tiptap/extension-underline"
import { getCategoryColor } from "@/components/wiki/WikiPageCard"
import DriveDocuments from "@/components/drive/DriveDocuments"

const FROST = "#F0F0F2"
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const RED = "#F87171"
const AMBER = "#FBBF24"

interface PageChild {
  id: string
  title: string
  slug: string
  icon: string | null
  category: string | null
  updatedAt: string
  updatedBy: string
}

interface PageParent {
  id: string
  title: string
  slug: string
  icon: string | null
  parent?: { id: string; title: string; slug: string; icon: string | null } | null
}

interface WikiVersion {
  id: string
  content: Record<string, unknown>
  editedBy: string
  createdAt: string
}

interface WikiPageData {
  id: string
  title: string
  slug: string
  icon: string | null
  category: string | null
  pinned: boolean
  viewCount: number
  content: Record<string, unknown>
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  children: PageChild[]
  parent: PageParent | null
  versions: WikiVersion[]
}

const EXTENSIONS = [
  StarterKit.configure({ codeBlock: false }),
  LinkExtension,
  ImageExtension,
  CodeBlock,
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  Highlight,
  Underline,
]

export default function WikiViewPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string
  const [page, setPage] = useState<WikiPageData | null>(null)
  const [html, setHtml] = useState("")
  const [showVersions, setShowVersions] = useState(false)
  const [previewVersion, setPreviewVersion] = useState<WikiVersion | null>(null)
  const [previewHtml, setPreviewHtml] = useState("")

  const fetchPage = () => {
    if (!slug) return
    fetch(`/api/wiki/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        const pageData = data.page ?? data
        setPage(pageData)
        if (pageData.content) {
          try {
            setHtml(generateHTML(pageData.content, EXTENSIONS))
          } catch {
            setHtml("<p>Unable to render content.</p>")
          }
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchPage()
  }, [slug])

  const handleTogglePin = async () => {
    if (!page) return
    await fetch(`/api/wiki/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !page.pinned }),
    })
    fetchPage()
  }

  const handleDelete = async () => {
    if (!page) return
    await fetch(`/api/wiki/${slug}`, { method: "DELETE" })
    router.push("/wiki")
  }

  const handleRestore = async (versionId: string) => {
    await fetch(`/api/wiki/${slug}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    })
    setShowVersions(false)
    setPreviewVersion(null)
    fetchPage()
  }

  const handlePreviewVersion = (v: WikiVersion) => {
    setPreviewVersion(v)
    try {
      setPreviewHtml(generateHTML(v.content as Parameters<typeof generateHTML>[0], EXTENSIONS))
    } catch {
      setPreviewHtml("<p>Unable to render version.</p>")
    }
  }

  const handleNewSubPage = async () => {
    if (!page) return
    try {
      const res = await fetch("/api/wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled",
          icon: "\uD83D\uDCDD",
          category: page.category,
          parentId: page.id,
        }),
      })
      const data = await res.json()
      const newSlug = data.page?.slug || data.slug
      if (newSlug) router.push(`/wiki/${newSlug}/edit`)
    } catch { /* silent */ }
  }

  if (!page) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ fontSize: 13, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>Loading...</div>
      </div>
    )
  }

  const catColors = getCategoryColor(page.category)

  return (
    <div className="page-content" style={{ padding: "0 32px 40px", maxWidth: 900, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 6, padding: "20px 0 16px", flexWrap: "wrap" }}>
        <Link href="/wiki" style={{ fontSize: 11, color: TEXT_TERTIARY, textDecoration: "none", fontFamily: "'DM Sans', sans-serif", transition: "color 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = ROSE_GOLD }}
          onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_TERTIARY }}>
          Wiki
        </Link>
        {page.parent?.parent && (
          <>
            <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>/</span>
            <Link href={`/wiki/${page.parent.parent.slug}`} style={{ fontSize: 11, color: TEXT_TERTIARY, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
              {page.parent.parent.icon} {page.parent.parent.title}
            </Link>
          </>
        )}
        {page.parent && (
          <>
            <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>/</span>
            <Link href={`/wiki/${page.parent.slug}`} style={{ fontSize: 11, color: TEXT_TERTIARY, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
              {page.parent.icon} {page.parent.title}
            </Link>
          </>
        )}
        <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>/</span>
        <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
          {page.title}
        </span>
      </div>

      {/* Page Header */}
      <div className="fade-in" style={{ marginBottom: 24, animationDelay: "0.05s" }}>
        {/* Icon + Title */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 36, lineHeight: 1 }}>{page.icon || "\uD83D\uDCDD"}</span>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "'Bellfair', serif", fontSize: 28, color: FROST, fontWeight: 400, margin: 0, lineHeight: 1.2 }}>
              {page.title}
            </h1>
          </div>
        </div>

        {/* Meta + Actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {page.category && (
              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: catColors.bg, color: catColors.text, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {page.category}
              </span>
            )}
            {page.pinned && <span style={{ fontSize: 10 }} title="Pinned">{"\uD83D\uDCCC"}</span>}
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
              by {page.updatedBy} &middot;{" "}
              {new Date(page.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
              {page.viewCount} view{page.viewCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link
              href={`/wiki/${slug}/edit`}
              className="btn-primary"
              style={{ textDecoration: "none", padding: "6px 16px", fontSize: 11 }}
            >
              Edit
            </Link>
            <button
              onClick={handleTogglePin}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${CARD_BORDER}`,
                background: "transparent",
                color: page.pinned ? AMBER : TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {page.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={() => setShowVersions(true)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${CARD_BORDER}`,
                background: "transparent",
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              History
            </button>
            <button
              onClick={handleDelete}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid rgba(248,113,113,0.2)",
                background: "rgba(248,113,113,0.06)",
                color: RED,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="fade-in"
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: "28px 32px",
          animationDelay: "0.1s",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(192,139,136,0.1) 50%, transparent 100%)" }} />
        <style>{`
          .wiki-content { font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.8; color: ${FROST}; }
          .wiki-content h1 { font-family: 'Bellfair', serif; font-size: 1.8em; font-weight: 400; margin: 1em 0 0.5em; color: ${FROST}; }
          .wiki-content h2 { font-family: 'Bellfair', serif; font-size: 1.4em; font-weight: 400; margin: 1em 0 0.5em; color: ${FROST}; }
          .wiki-content h3 { font-family: 'Bellfair', serif; font-size: 1.15em; font-weight: 400; margin: 1em 0 0.5em; color: ${FROST}; }
          .wiki-content p { margin: 0.5em 0; }
          .wiki-content a { color: ${ROSE_GOLD}; text-decoration: underline; }
          .wiki-content ul, .wiki-content ol { padding-left: 1.5em; }
          .wiki-content li { margin: 0.25em 0; }
          .wiki-content blockquote {
            border-left: 3px solid ${ROSE_GOLD};
            padding: 12px 16px;
            margin: 0.75em 0;
            color: ${TEXT_SECONDARY};
            background: linear-gradient(135deg, rgba(192,139,136,0.06), transparent);
            border-radius: 0 10px 10px 0;
          }
          .wiki-content pre {
            background: #060709;
            border: 1px solid ${CARD_BORDER};
            border-radius: 10px;
            padding: 16px;
            font-family: monospace;
            font-size: 13px;
            color: ${FROST};
            overflow-x: auto;
          }
          .wiki-content code { background: rgba(255,255,255,0.05); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.9em; }
          .wiki-content img { max-width: 100%; border-radius: 10px; margin: 8px 0; border: 1px solid ${CARD_BORDER}; }
          .wiki-content hr { border: none; border-top: 1px solid ${CARD_BORDER}; margin: 1.5em 0; }
          .wiki-content table { border-collapse: collapse; width: 100%; margin: 0.75em 0; }
          .wiki-content th, .wiki-content td { border: 1px solid ${CARD_BORDER}; padding: 8px 12px; text-align: left; font-size: 13px; }
          .wiki-content th { background: rgba(255,255,255,0.03); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: ${TEXT_SECONDARY}; }
          .wiki-content ul[data-type="taskList"] { list-style: none; padding-left: 0; }
          .wiki-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
          .wiki-content ul[data-type="taskList"] li label input[type="checkbox"] { appearance: none; width: 16px; height: 16px; border: 1.5px solid rgba(192,139,136,0.4); border-radius: 4px; background: transparent; margin-top: 3px; }
          .wiki-content ul[data-type="taskList"] li label input[type="checkbox"]:checked { background: ${ROSE_GOLD}; border-color: ${ROSE_GOLD}; }
          .wiki-content mark { background: rgba(192,139,136,0.2); border-radius: 2px; padding: 1px 3px; }
        `}</style>
        <div className="wiki-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      {/* Drive Documents */}
      <div className="fade-in" style={{ animationDelay: "0.12s" }}>
        <DriveDocuments linkType="wikiPageId" linkId={page.id} />
      </div>

      {/* Child Pages */}
      {page.children.length > 0 && (
        <div className="fade-in" style={{ marginTop: 24, animationDelay: "0.15s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
              Sub-pages
            </span>
            <button
              onClick={handleNewSubPage}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${CARD_BORDER}`,
                background: "transparent",
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              + Add sub-page
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {page.children.map((child) => (
              <Link
                key={child.id}
                href={`/wiki/${child.slug}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 10,
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(192,139,136,0.15)" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = CARD_BORDER }}
              >
                <span style={{ fontSize: 18 }}>{child.icon || "\uD83D\uDCDD"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: FROST, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {child.title}
                  </div>
                  <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                    {new Date(child.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Version History Slide-in Panel */}
      {showVersions && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowVersions(false)
              setPreviewVersion(null)
            }
          }}
        >
          <div
            className="animate-slideUp"
            style={{
              width: previewVersion ? 800 : 360,
              maxWidth: "90vw",
              height: "100vh",
              background: CARD_BG,
              borderLeft: `1px solid ${CARD_BORDER}`,
              display: "flex",
              flexDirection: "row",
              overflow: "hidden",
            }}
          >
            {/* Preview area */}
            {previewVersion && (
              <div style={{ flex: 1, overflowY: "auto", padding: 24, borderRight: `1px solid ${CARD_BORDER}` }}>
                <div style={{ fontSize: 10, color: TEXT_TERTIARY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 12 }}>
                  Preview — {new Date(previewVersion.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="wiki-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <button
                    className="btn-primary"
                    onClick={() => handleRestore(previewVersion.id)}
                    style={{ padding: "8px 18px", fontSize: 12 }}
                  >
                    Restore this version
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setPreviewVersion(null)}
                    style={{ padding: "8px 18px", fontSize: 12 }}
                  >
                    Close preview
                  </button>
                </div>
              </div>
            )}

            {/* Version list */}
            <div style={{ width: previewVersion ? 300 : "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${CARD_BORDER}` }}>
                <span style={{ fontFamily: "'Bellfair', serif", fontSize: 16, color: FROST }}>Version History</span>
                <button
                  onClick={() => { setShowVersions(false); setPreviewVersion(null) }}
                  style={{ background: "none", border: "none", color: TEXT_TERTIARY, fontSize: 16, cursor: "pointer", padding: 4, lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
                {page.versions.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: TEXT_TERTIARY, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                    No previous versions
                  </div>
                )}
                {page.versions.map((v, i) => (
                  <div
                    key={v.id}
                    onClick={() => handlePreviewVersion(v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: previewVersion?.id === v.id ? "rgba(192,139,136,0.08)" : "transparent",
                      transition: "background 0.15s",
                      borderBottom: `1px solid ${CARD_BORDER}`,
                    }}
                    onMouseEnter={(e) => {
                      if (previewVersion?.id !== v.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"
                    }}
                    onMouseLeave={(e) => {
                      if (previewVersion?.id !== v.id) e.currentTarget.style.background = "transparent"
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: i === 0 ? GREEN : TEXT_TERTIARY,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: FROST, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.editedBy}
                      </div>
                      <div style={{ fontSize: 10, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
                        {new Date(v.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
