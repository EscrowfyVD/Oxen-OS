"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CRM_COLORS } from "@/lib/crm-config"
import IntentFeedFilters from "./_components/IntentFeedFilters"
import LoadMoreButton from "./_components/LoadMoreButton"
import SignalCard from "./_components/SignalCard"
import type { IntentFeedSignalView } from "./_components/types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold

const PAGE_LIMIT = 50

interface PaginationView {
  limit: number
  offset: number
  total: number
  hasMore: boolean
}

/**
 * /crm/intent-feed — daily signal consumption dashboard for BDs.
 *
 * URL is the source of truth for filters; the displayed list is
 * client-state so "Load more" can append without nuking scroll
 * position. Filters change → reset offset + list. Load more →
 * increment offset, fetch, append.
 */
export default function IntentFeedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [signals, setSignals] = useState<IntentFeedSignalView[]>([])
  const [pagination, setPagination] = useState<PaginationView>({
    limit: PAGE_LIMIT,
    offset: 0,
    total: 0,
    hasMore: false,
  })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Auto-clear toast after 3.5s — long enough to read, short enough
  // to not block stacked notifications when user is rapid-firing.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = useCallback((message: string) => setToast(message), [])

  // Build the API querystring from the page's URL params, plus the
  // limit/offset we want for the current fetch.
  const buildQuery = useCallback(
    (offset: number, limit: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("limit", String(limit))
      params.set("offset", String(offset))
      return params.toString()
    },
    [searchParams],
  )

  const fetchSignals = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await fetch(`/api/intent-feed?${buildQuery(offset, PAGE_LIMIT)}`)
        const data = await res.json()
        if (!res.ok) {
          showToast(`Failed to load signals: ${data.error || "Unknown error"}`)
          return
        }
        const newSignals: IntentFeedSignalView[] = data.signals ?? []
        setSignals((prev) => (append ? [...prev, ...newSignals] : newSignals))
        setPagination(data.pagination)
      } catch {
        showToast("Network error loading signals")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [buildQuery, showToast],
  )

  // Refetch from scratch when filters change.
  useEffect(() => {
    fetchSignals(0, false)
  }, [fetchSignals])

  const handleLoadMore = useCallback(() => {
    const next = pagination.offset + pagination.limit
    fetchSignals(next, true)
  }, [pagination.offset, pagination.limit, fetchSignals])

  // Local mutation when SignalCard mark-actioned succeeds — avoids a
  // full refetch (preserves scroll) and gives an instant visual cue.
  const handleSignalActioned = useCallback(
    (signalId: string, actionedAt: string, actionedBy: string | null) => {
      setSignals((prev) =>
        prev.map((s) =>
          s.id === signalId ? { ...s, actionedAt, actionedBy } : s,
        ),
      )
    },
    [],
  )

  // Cosmetic refresh after Create Task / Send Telegram — those don't
  // change list state, but a toast confirms.
  const handleActionSuccess = useCallback(
    (msg: string) => {
      showToast(msg)
    },
    [showToast],
  )

  return (
    <div
      style={{
        padding: "24px 32px 80px",
        maxWidth: 1120,
        margin: "0 auto",
        color: TEXT,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            color: TEXT3,
            textTransform: "uppercase",
            letterSpacing: 1.2,
            marginBottom: 6,
          }}
        >
          <button
            onClick={() => router.push("/crm")}
            style={{
              background: "none",
              border: "none",
              color: TEXT3,
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
              fontSize: "inherit",
              letterSpacing: "inherit",
              textTransform: "inherit",
            }}
          >
            CRM
          </button>
          {" › Intent Feed"}
        </div>
        <h1
          style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 28,
            fontWeight: 400,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Intent Feed
        </h1>
        <p
          style={{
            fontSize: 12,
            color: TEXT2,
            marginTop: 4,
            marginBottom: 0,
            lineHeight: 1.4,
          }}
        >
          {loading
            ? "Loading…"
            : `${pagination.total} signal${pagination.total === 1 ? "" : "s"} · sorted by recency`}
        </p>
      </div>

      {/* Filters */}
      <IntentFeedFilters />

      {/* List */}
      {loading ? (
        <div
          style={{
            padding: "60px 0",
            textAlign: "center",
            color: TEXT3,
            fontSize: 12,
          }}
        >
          Loading signals…
        </div>
      ) : signals.length === 0 ? (
        <div
          style={{
            padding: "60px 0",
            textAlign: "center",
            color: TEXT3,
            fontSize: 13,
            border: `1px dashed ${CRM_COLORS.card_border}`,
            borderRadius: 12,
            marginTop: 20,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10, color: ROSE }}>·</div>
          <div style={{ fontSize: 14, color: TEXT, marginBottom: 6 }}>
            No signals match your filters
          </div>
          <div>Try widening the date range or clearing a filter.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {signals.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              onActioned={handleSignalActioned}
              onSuccess={handleActionSuccess}
            />
          ))}
        </div>
      )}

      <LoadMoreButton
        hasMore={pagination.hasMore}
        loading={loadingMore}
        onClick={handleLoadMore}
      />

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--surface-elevated)",
            border: `1px solid ${CRM_COLORS.card_border}`,
            borderLeft: `3px solid ${ROSE}`,
            borderRadius: 8,
            padding: "12px 16px",
            color: TEXT,
            fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            zIndex: 2000,
            maxWidth: 360,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
