"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface WikiItem {
  id: string
  title: string
  slug: string
  category?: string
  updatedAt: string
}

export default function RecentWiki() {
  const [pages, setPages] = useState<WikiItem[]>([])

  useEffect(() => {
    fetch("/api/wiki?limit=5")
      .then((r) => r.json())
      .then((data) => setPages(data.pages ?? []))
      .catch(() => {})
  }, [])

  const categoryColors: Record<string, string> = {
    Process: "var(--green)",
    Legal: "var(--orange)",
    Product: "var(--blue)",
    HR: "var(--purple)",
    General: "var(--text-mid)",
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
        📝 Recent Wiki Pages
      </h3>
      {pages.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          No wiki pages yet
        </p>
      ) : (
        <div className="space-y-3">
          {pages.map((p) => (
            <Link
              key={p.id}
              href={`/wiki/${p.slug}`}
              className="block no-underline"
            >
              <div className="text-sm" style={{ color: "var(--text)" }}>
                {p.title}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {p.category && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: `${categoryColors[p.category] ?? "var(--text-dim)"}20`,
                      color: categoryColors[p.category] ?? "var(--text-dim)",
                    }}
                  >
                    {p.category}
                  </span>
                )}
                <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                  {new Date(p.updatedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
