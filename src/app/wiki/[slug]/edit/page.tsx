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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  )

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch existing page data
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

  // Auto-save with 2-second debounce
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: "var(--text-dim)" }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Edit Wiki Page"
        description={`Editing: ${title || "Untitled"}`}
        actions={
          <div className="flex items-center gap-3">
            <span
              className="text-xs"
              style={{
                color:
                  saveStatus === "saving"
                    ? "var(--yellow)"
                    : saveStatus === "saved"
                    ? "var(--green)"
                    : "var(--text-dim)",
              }}
            >
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                ? "Saved"
                : ""}
            </span>
            <button
              className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onClick={() => router.push(`/wiki/${slug}`)}
            >
              Done Editing
            </button>
          </div>
        }
      />

      <div className="space-y-4 max-w-4xl">
        <div>
          <label
            className="block text-xs font-semibold mb-1"
            style={{ color: "var(--text-mid)" }}
          >
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Page title..."
            style={inputStyle}
          />
        </div>

        <div>
          <label
            className="block text-xs font-semibold mb-1"
            style={{ color: "var(--text-mid)" }}
          >
            Category
          </label>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            style={{
              ...inputStyle,
              cursor: "pointer",
              appearance: "none" as const,
            }}
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
            className="block text-xs font-semibold mb-1"
            style={{ color: "var(--text-mid)" }}
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
