"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import PageHeader from "@/components/layout/PageHeader"
import WikiEditor from "@/components/wiki/WikiEditor"
import type { JSONContent } from "@tiptap/react"

const CATEGORIES = ["Process", "Legal", "Product", "HR", "General"]

export default function WikiEditPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [title, setTitle] = useState("")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [content, setContent] = useState<JSONContent | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/wiki/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        const page = data.page ?? data
        setTitle(page.title ?? "")
        setCategory(page.category ?? CATEGORIES[0])
        setContent(page.content ?? null)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [slug])

  const autoSave = useCallback(
    (updatedTitle: string, updatedCategory: string, updatedContent: JSONContent | null) => {
      if (!slug) return

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      setSaveStatus("saving")

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/wiki/${slug}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: updatedTitle,
              category: updatedCategory,
              content: updatedContent,
            }),
          })
          setSaveStatus("saved")
          setTimeout(() => setSaveStatus("idle"), 2000)
        } catch {
          setSaveStatus("idle")
        }
      }, 2000)
    },
    [slug]
  )

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    autoSave(newTitle, category, content)
  }

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory)
    autoSave(title, newCategory, content)
  }

  const handleContentChange = (newContent: JSONContent) => {
    setContent(newContent)
    autoSave(title, category, newContent)
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center" style={{ padding: "80px 0" }}>
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <PageHeader
        title="Edit Wiki Page"
        description={`Editing: ${title || "Untitled"}`}
        actions={
          <div className="flex items-center gap-3">
            {saveStatus !== "idle" && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color:
                    saveStatus === "saving"
                      ? "var(--yellow)"
                      : "var(--green)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {saveStatus === "saving" ? "Saving..." : "\u2713 Saved"}
              </span>
            )}
            <button
              className="btn-secondary"
              onClick={() => router.push(`/wiki/${slug}`)}
            >
              Done Editing
            </button>
          </div>
        }
      />

      <div style={{ maxWidth: 800 }}>
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-mid)",
              marginBottom: 6,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Page title..."
            className="oxen-input"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-mid)",
              marginBottom: 6,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Category
          </label>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="oxen-input"
            style={{ cursor: "pointer", appearance: "none" as const }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-mid)",
              marginBottom: 6,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Content
          </label>
          <WikiEditor
            content={content ?? undefined}
            onChange={handleContentChange}
            placeholder="Start writing..."
          />
        </div>
      </div>
    </div>
  )
}
