"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams, redirect } from "next/navigation"
import { WIKI_HIDDEN } from "@/lib/hidden-modules"

const TEXT_TERTIARY = "var(--text-tertiary)"

export default function WikiNewPage() {
  if (WIKI_HIDDEN) redirect("/") // wiki module hidden — reversible via @/lib/hidden-modules
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
