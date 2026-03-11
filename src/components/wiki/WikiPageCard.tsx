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
      className="card block p-5 no-underline group"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3
          className="text-sm font-semibold truncate flex-1"
          style={{ color: "var(--text)" }}
        >
          {page.title}
        </h3>
        <span
          className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0"
          style={{
            background: catColors.bg,
            color: catColors.text,
          }}
        >
          {page.category}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
          Updated {formattedDate}
        </span>
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
          by {page.createdBy}
        </span>
      </div>
    </Link>
  )
}
