"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import WikiEditor from "@/components/wiki/WikiEditor"
import type { JSONContent } from "@tiptap/react"

const CATEGORIES = ["Process", "Legal", "Product", "HR", "Finance", "Compliance", "General"]

const FROST = "#F0F0F2"
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"

const EMOJIS = [
  "\uD83D\uDCDD", "\uD83D\uDCCB", "\uD83D\uDCDA", "\uD83D\uDCC4", "\uD83D\uDCD6",
  "\uD83D\uDE80", "\uD83D\uDCA1", "\uD83D\uDD12", "\uD83C\uDFDB", "\uD83D\uDCBB",
  "\uD83D\uDC65", "\u2699\uFE0F", "\uD83D\uDCE6", "\uD83D\uDD27", "\uD83C\uDF10",
  "\uD83D\uDCCA", "\uD83D\uDCB0", "\u2696\uFE0F", "\uD83C\uDFC6", "\uD83D\uDDE3\uFE0F",
  "\u2728", "\uD83D\uDD25", "\uD83D\uDCC8", "\uD83D\uDEE1\uFE0F", "\uD83D\uDCE7",
  "\uD83C\uDFA8", "\uD83E\uDDE9", "\uD83D\uDEA9", "\uD83C\uDF1F", "\uD83C\uDF89",
]

export default function WikiEditPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [title, setTitle] = useState("")
  const [icon, setIcon] = useState("\uD83D\uDCDD")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [content, setContent] = useState<JSONContent | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/wiki/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        const page = data.page ?? data
        setTitle(page.title ?? "")
        setIcon(page.icon ?? "\uD83D\uDCDD")
        setCategory(page.category ?? CATEGORIES[0])
        setContent(page.content ?? null)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [slug])

  const autoSave = useCallback(
    (updatedTitle: string, updatedIcon: string, updatedCategory: string, updatedContent: JSONContent | null) => {
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
              icon: updatedIcon,
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
    autoSave(newTitle, icon, category, content)
  }

  const handleIconChange = (newIcon: string) => {
    setIcon(newIcon)
    setShowEmojiPicker(false)
    autoSave(title, newIcon, category, content)
  }

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory)
    autoSave(title, icon, newCategory, content)
  }

  const handleContentChange = (newContent: JSONContent) => {
    setContent(newContent)
    autoSave(title, icon, category, newContent)
  }

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ fontSize: 13, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="page-content" style={{ padding: 0, background: "#060709", minHeight: "100vh" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: `1px solid ${CARD_BORDER}`,
          background: "rgba(15,17,24,0.8)",
          backdropFilter: "blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href={`/wiki/${slug}`}
            style={{ fontSize: 11, color: TEXT_TERTIARY, textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}
          >
            {"\u2190"} Back
          </Link>
          <span style={{ fontSize: 10, color: TEXT_TERTIARY }}>/</span>
          <span style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: "'DM Sans', sans-serif" }}>
            Editing: {title || "Untitled"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {saveStatus !== "idle" && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: saveStatus === "saving" ? AMBER : GREEN,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {saveStatus === "saving" ? "Saving..." : "\u2713 Saved"}
            </span>
          )}
          <button
            className="btn-secondary"
            onClick={() => router.push(`/wiki/${slug}`)}
            style={{ padding: "6px 16px", fontSize: 11 }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Editor area — centered */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
        {/* Icon + Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={{
                fontSize: 36,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 8,
                transition: "background 0.15s",
                lineHeight: 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)" }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
              title="Change icon"
            >
              {icon}
            </button>
            {showEmojiPicker && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  zIndex: 20,
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 10,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 4,
                  width: 240,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleIconChange(emoji)}
                    style={{
                      fontSize: 20,
                      padding: 6,
                      borderRadius: 6,
                      border: "none",
                      background: icon === emoji ? "rgba(192,139,136,0.15)" : "transparent",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = icon === emoji ? "rgba(192,139,136,0.15)" : "transparent" }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled"
            style={{
              flex: 1,
              fontFamily: "'Bellfair', serif",
              fontSize: 28,
              fontWeight: 400,
              color: FROST,
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "4px 0",
              lineHeight: 1.2,
            }}
          />
        </div>

        {/* Category */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                border: `1px solid ${category === cat ? "rgba(192,139,136,0.3)" : "transparent"}`,
                background: category === cat ? "rgba(192,139,136,0.08)" : "transparent",
                color: category === cat ? ROSE_GOLD : TEXT_TERTIARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Editor */}
        <WikiEditor
          content={content ?? undefined}
          onChange={handleContentChange}
          placeholder="Start writing..."
        />
      </div>
    </div>
  )
}
