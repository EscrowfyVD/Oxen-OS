"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import PageHeader from "@/components/layout/PageHeader"
import { generateHTML } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import LinkExtension from "@tiptap/extension-link"
import ImageExtension from "@tiptap/extension-image"
import CodeBlock from "@tiptap/extension-code-block"

interface WikiPageData {
  id: string
  title: string
  slug: string
  category: string
  content: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
  versions?: {
    id: string
    createdAt: string
    createdBy: string
  }[]
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Process: { bg: "rgba(91,155,191,0.15)", text: "var(--blue)" },
  Legal: { bg: "rgba(212,136,91,0.15)", text: "var(--orange)" },
  Product: { bg: "rgba(155,127,212,0.15)", text: "var(--purple)" },
  HR: { bg: "rgba(92,184,104,0.15)", text: "var(--green)" },
  General: { bg: "rgba(229,196,83,0.15)", text: "var(--yellow)" },
}

export default function WikiViewPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [page, setPage] = useState<WikiPageData | null>(null)
  const [html, setHtml] = useState("")

  useEffect(() => {
    if (!slug) return
    fetch(`/api/wiki/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        const pageData = data.page ?? data
        setPage(pageData)
        if (pageData.content) {
          try {
            const generated = generateHTML(pageData.content, [
              StarterKit.configure({ codeBlock: false }),
              LinkExtension,
              ImageExtension,
              CodeBlock,
            ])
            setHtml(generated)
          } catch {
            setHtml("<p>Unable to render content.</p>")
          }
        }
      })
      .catch(() => {})
  }, [slug])

  if (!page) {
    return (
      <div className="flex items-center justify-center" style={{ padding: "80px 0" }}>
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
          Loading...
        </div>
      </div>
    )
  }

  const catColors = CATEGORY_COLORS[page.category] ?? {
    bg: "var(--rose-dim)",
    text: "var(--rose)",
  }

  return (
    <div className="page-content">
      <PageHeader
        title={page.title}
        description={`Created by ${page.createdBy}`}
        actions={
          <Link href={`/wiki/${slug}/edit`} className="btn-primary no-underline">
            Edit Page
          </Link>
        }
      />

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Meta bar */}
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
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
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              Last updated{" "}
              {new Date(page.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Content card */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-header">
              <span style={{ fontSize: 14 }}>{"\uD83D\uDCDD"}</span>
              <span>Content</span>
            </div>
            <div className="card-body">
              <style>{`
                .wiki-content h1 { font-size: 1.75em; font-weight: 700; margin: 0.75em 0 0.5em; color: var(--text); }
                .wiki-content h2 { font-size: 1.4em; font-weight: 600; margin: 0.75em 0 0.5em; color: var(--text); }
                .wiki-content h3 { font-size: 1.15em; font-weight: 600; margin: 0.75em 0 0.5em; color: var(--text); }
                .wiki-content p { margin: 0.5em 0; color: var(--text); line-height: 1.7; font-size: 14px; }
                .wiki-content a { color: var(--blue); text-decoration: underline; }
                .wiki-content ul, .wiki-content ol { padding-left: 1.5em; color: var(--text); }
                .wiki-content li { margin: 0.25em 0; line-height: 1.7; }
                .wiki-content blockquote {
                  border-left: 3px solid var(--rose);
                  padding: 12px 16px;
                  margin: 0.75em 0;
                  color: var(--text-mid);
                  background: linear-gradient(135deg, rgba(192,139,136,0.06), transparent);
                  border-radius: 0 10px 10px 0;
                }
                .wiki-content pre {
                  background: var(--bg-input);
                  border: 1px solid var(--border);
                  border-radius: 10px;
                  padding: 16px;
                  font-family: monospace;
                  font-size: 13px;
                  color: var(--text);
                  overflow-x: auto;
                }
                .wiki-content code {
                  background: var(--bg-input);
                  border-radius: 4px;
                  padding: 2px 6px;
                  font-family: monospace;
                  font-size: 0.9em;
                }
                .wiki-content img {
                  max-width: 100%;
                  border-radius: 10px;
                  margin: 8px 0;
                  border: 1px solid var(--border);
                }
                .wiki-content hr {
                  border: none;
                  border-top: 1px solid var(--border);
                  margin: 1.5em 0;
                }
              `}</style>
              <div
                className="wiki-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        </div>

        {/* Version history sidebar */}
        {page.versions && page.versions.length > 0 && (
          <div className="w-64 shrink-0 hidden lg:block">
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="card-header">
                <span style={{ fontSize: 14 }}>{"\uD83D\uDD52"}</span>
                <span>Version History</span>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {page.versions.map((version, i) => (
                    <div
                      key={version.id}
                      className="flex items-center gap-3"
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        borderBottom:
                          i < page.versions!.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: i === 0 ? "var(--green)" : "var(--text-dim)",
                          flexShrink: 0,
                        }}
                      />
                      <div className="min-w-0">
                        <div
                          className="truncate"
                          style={{ fontSize: 12, color: "var(--text)" }}
                        >
                          {version.createdBy}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                          {new Date(version.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
    </div>
  )
}
