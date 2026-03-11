"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import PageHeader from "@/components/layout/PageHeader"
import WikiEditor from "@/components/wiki/WikiEditor"
import type { JSONContent } from "@tiptap/react"

const CATEGORIES = ["Process", "Legal", "Product", "HR", "General"]

export default function WikiNewPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [content, setContent] = useState<JSONContent | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)

    try {
      const res = await fetch("/api/wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          content,
        }),
      })
      const data = await res.json()
      if (data.slug) {
        router.push(`/wiki/${data.slug}`)
      } else if (data.page?.slug) {
        router.push(`/wiki/${data.page.slug}`)
      } else {
        router.push("/wiki")
      }
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="page-content">
      <PageHeader
        title="New Wiki Page"
        description="Create a new knowledge base article"
        actions={
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? "Saving..." : "Save Page"}
          </button>
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
            onChange={(e) => setTitle(e.target.value)}
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
            onChange={(e) => setCategory(e.target.value)}
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
            onChange={(c) => setContent(c)}
            placeholder="Start writing your wiki page..."
          />
        </div>
      </div>
    </div>
  )
}
