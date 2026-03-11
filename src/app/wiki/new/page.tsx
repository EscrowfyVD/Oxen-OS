"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

const TEXT_TERTIARY = "rgba(240,240,242,0.3)"

export default function WikiNewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const parentId = searchParams.get("parentId")

  useEffect(() => {
    async function createAndRedirect() {
      try {
        const res = await fetch("/api/wiki", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Untitled",
            icon: "\uD83D\uDCDD",
            category: "General",
            parentId: parentId || null,
          }),
        })
        const data = await res.json()
        const slug = data.page?.slug || data.slug
        if (slug) {
          router.replace(`/wiki/${slug}/edit`)
        } else {
          router.replace("/wiki")
        }
      } catch {
        router.replace("/wiki")
      }
    }

    createAndRedirect()
  }, [parentId, router])

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
      <div style={{ fontSize: 13, color: TEXT_TERTIARY, fontFamily: "'DM Sans', sans-serif" }}>
        Creating page...
      </div>
    </div>
  )
}
