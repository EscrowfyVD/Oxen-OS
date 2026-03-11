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

const categoryColors: Record<string, { bg: string; text: string }> = {
  Process: { bg: "rgba(91,155,191,0.15)", text: "var(--blue)" },
  Legal: { bg: "rgba(212,136,91,0.15)", text: "var(--orange)" },
  Product: { bg: "rgba(155,127,212,0.15)", text: "var(--purple)" },
  HR: { bg: "rgba(92,184,104,0.15)", text: "var(--green)" },
  General: { bg: "rgba(229,196,83,0.15)", text: "var(--yellow)" },
}

export default function RecentWiki() {
  const [pages, setPages] = useState<WikiItem[]>([])

  useEffect(() => {
    fetch("/api/wiki?limit=5")
      .then((r) => r.json())
      .then((data) => setPages(data.pages ?? []))
      .catch(() => {})
  }, [])

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-header">
        <span style={{ fontSize: 14 }}>{"\uD83D\uDCDD"}</span>
        <span>Recent Wiki Pages</span>
      </div>
      <div className="card-body">
        {pages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center"
            style={{ padding: "24px 0", color: "var(--text-dim)" }}
          >
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>{"\uD83D\uDCDD"}</div>
            <div style={{ fontSize: 12 }}>No wiki pages yet</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pages.map((p) => {
              const colors = categoryColors[p.category ?? ""] ?? {
                bg: "var(--rose-dim)",
                text: "var(--rose)",
              }
              return (
                <Link
                  key={p.id}
                  href={`/wiki/${p.slug}`}
                  className="block no-underline"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(el) => {
                    el.currentTarget.style.background = "rgba(255,255,255,0.03)"
                  }}
                  onMouseLeave={(el) => {
                    el.currentTarget.style.background = "transparent"
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--text)",
                      fontFamily: "'DM Sans', sans-serif",
                      marginBottom: 4,
                    }}
                  >
                    {p.title}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.category && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: colors.bg,
                          color: colors.text,
                        }}
                      >
                        {p.category}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-dim)",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {new Date(p.updatedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
