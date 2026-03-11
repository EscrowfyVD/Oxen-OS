"use client"

import Link from "next/link"

export interface WikiPage {
  id: string
  title: string
  slug: string
  category: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface WikiPageCardProps {
  page: WikiPage
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Process: { bg: "rgba(91,155,191,0.15)", text: "var(--blue)" },
  Legal: { bg: "rgba(212,136,91,0.15)", text: "var(--orange)" },
  Product: { bg: "rgba(155,127,212,0.15)", text: "var(--purple)" },
  HR: { bg: "rgba(92,184,104,0.15)", text: "var(--green)" },
  General: { bg: "rgba(229,196,83,0.15)", text: "var(--yellow)" },
}

function getDefaultCategoryColor() {
  return { bg: "var(--rose-dim)", text: "var(--rose)" }
}

export default function WikiPageCard({ page }: WikiPageCardProps) {
  const catColors = CATEGORY_COLORS[page.category] ?? getDefaultCategoryColor()

  const formattedDate = new Date(page.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <Link
      href={`/wiki/${page.slug}`}
      className="card block no-underline interactive-card"
      style={{ overflow: "hidden" }}
    >
      {/* Card header with category */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
          background: "rgba(192,139,136,0.02)",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 999,
            background: catColors.bg,
            color: catColors.text,
          }}
        >
          {page.category}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {formattedDate}
        </span>
      </div>

      {/* Card body */}
      <div style={{ padding: "14px 16px" }}>
        <h3
          className="truncate"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text)",
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 6,
          }}
        >
          {page.title}
        </h3>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          by {page.createdBy}
        </div>
      </div>
    </Link>
  )
}
