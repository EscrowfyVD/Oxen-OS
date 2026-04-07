"use client"

import Link from "next/link"

export interface WikiPage {
  id: string
  title: string
  slug: string
  icon: string | null
  category: string | null
  parentId: string | null
  pinned: boolean
  archived?: boolean
  order: number
  viewCount: number
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

interface WikiPageCardProps {
  page: WikiPage
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Process: { bg: "rgba(91,155,191,0.15)", text: "#5B9BBF" },
  Legal: { bg: "rgba(212,136,91,0.15)", text: "#D4885B" },
  Product: { bg: "rgba(155,127,212,0.15)", text: "#9B7FD4" },
  HR: { bg: "rgba(92,184,104,0.15)", text: "#5CB868" },
  Finance: { bg: "rgba(251,191,36,0.15)", text: "#FBBF24" },
  Compliance: { bg: "rgba(248,113,113,0.15)", text: "#F87171" },
  General: { bg: "rgba(229,196,83,0.15)", text: "#E5C453" },
}

export function getCategoryColor(cat: string | null) {
  if (!cat) return { bg: "rgba(192,139,136,0.1)", text: "#C08B88" }
  return CATEGORY_COLORS[cat] ?? { bg: "rgba(192,139,136,0.1)", text: "#C08B88" }
}

export default function WikiPageCard({ page }: WikiPageCardProps) {
  const catColors = getCategoryColor(page.category)

  const formattedDate = new Date(page.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })

  return (
    <Link
      href={`/wiki/${page.slug}`}
      style={{
        display: "block",
        textDecoration: "none",
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: 14,
        overflow: "hidden",
        transition: "all 0.25s ease",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(192,139,136,0.15)"
        e.currentTarget.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--card-border)"
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(192,139,136,0.15) 50%, transparent 100%)" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--surface-hover)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {page.pinned && <span style={{ fontSize: 10, color: "#FBBF24" }} title="Pinned">{"\uD83D\uDCCC"}</span>}
          {page.category && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: catColors.bg, color: catColors.text, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {page.category}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', sans-serif" }}>
          {formattedDate}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>{page.icon || "\uD83D\uDCDD"}</span>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
            {page.title}
          </h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', sans-serif" }}>
          <span>by {page.updatedBy}</span>
          {page.viewCount > 0 && <span>{page.viewCount} views</span>}
        </div>
      </div>
    </Link>
  )
}
