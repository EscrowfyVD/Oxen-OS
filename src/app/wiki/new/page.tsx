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

  return (
    <div>
      <PageHeader
        title="New Wiki Page"
        description="Create a new knowledge base article"
        actions={
          <button
            className="btn-primary text-sm"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            style={{
              opacity: saving || !title.trim() ? 0.5 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Page"}
          </button>
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
            onChange={(e) => setTitle(e.target.value)}
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
            onChange={(e) => setCategory(e.target.value)}
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
            onChange={(c) => setContent(c)}
            placeholder="Start writing your wiki page..."
          />
        </div>
      </div>
    </div>
  )
}
