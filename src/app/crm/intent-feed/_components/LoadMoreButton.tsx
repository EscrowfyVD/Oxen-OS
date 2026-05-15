"use client"

import { CRM_COLORS } from "@/lib/crm-config"

interface LoadMoreButtonProps {
  hasMore: boolean
  loading: boolean
  onClick: () => void
}

export default function LoadMoreButton({ hasMore, loading, onClick }: LoadMoreButtonProps) {
  if (!hasMore) return null
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
      <button
        onClick={onClick}
        disabled={loading}
        style={{
          background: "transparent",
          border: `1px solid ${CRM_COLORS.card_border}`,
          borderRadius: 8,
          padding: "10px 20px",
          color: CRM_COLORS.text_primary,
          fontSize: 12,
          fontFamily: "'DM Sans', sans-serif",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Loading…" : "Load more"}
      </button>
    </div>
  )
}
