"use client"

// Full session list view — mirrors Intent Feed's URL-sync + fetch
// loop + local state + inline toast pattern.
//
// Architecture:
//   - URL is the source of truth for filters; fetch effect reruns on
//     searchParams change
//   - Local state holds the list so "Load more" can append without
//     losing scroll
//   - The not_authorized error (operator not on OCA's allowlist) is
//     surfaced as a dedicated panel, NOT a toast — it's a persistent
//     access state the user needs to act on (contact Vernon)

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CRM_COLORS } from "@/lib/crm-config"
import OnboardingFilters from "./OnboardingFilters"
import SessionRow from "./SessionRow"
import type { SessionRow as SessionRowData, SessionsListResponse, ProxyErrorBody } from "./types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary
const ROSE = CRM_COLORS.rose_gold

const PAGE_LIMIT = 20

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: SessionRowData[]; total: number; offset: number; hasMore: boolean }
  | { kind: "not_authorized"; message: string }
  | { kind: "error"; message: string }

export default function OnboardingList() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<LoadState>({ kind: "loading" })
  const [loadingMore, setLoadingMore] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const buildQuery = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("page", String(page))
      params.set("limit", String(PAGE_LIMIT))
      return params.toString()
    },
    [searchParams],
  )

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!append) setState({ kind: "loading" })
      else setLoadingMore(true)
      try {
        const res = await fetch(`/api/oca/sessions?${buildQuery(page)}`, {
          cache: "no-store",
        })
        const body = await res.json().catch(() => null)
        if (res.status === 403) {
          const err = body as ProxyErrorBody | null
          if (err && "error" in err && err.error === "not_authorized") {
            setState({
              kind: "not_authorized",
              message: err.message ?? "Your account is not authorized for the OCA operator console.",
            })
            return
          }
        }
        if (!res.ok) {
          const err = body as ProxyErrorBody | null
          const message = err?.message ?? `Failed to load sessions (HTTP ${res.status})`
          if (append) {
            setToast(`Load more failed: ${message}`)
          } else {
            setState({ kind: "error", message })
          }
          return
        }
        const payload = body as SessionsListResponse
        setState((prev) => {
          if (append && prev.kind === "ready") {
            return {
              kind: "ready",
              rows: [...prev.rows, ...payload.data],
              total: payload.total,
              offset: prev.offset + payload.data.length,
              hasMore: prev.offset + payload.data.length < payload.total,
            }
          }
          return {
            kind: "ready",
            rows: payload.data,
            total: payload.total,
            offset: payload.data.length,
            hasMore: payload.data.length < payload.total,
          }
        })
      } catch {
        if (append) setToast("Network error loading more sessions")
        else setState({ kind: "error", message: "Network error loading sessions" })
      } finally {
        setLoadingMore(false)
      }
    },
    [buildQuery],
  )

  // Refetch on filter change (URL change).
  useEffect(() => {
    fetchPage(1, false)
  }, [fetchPage])

  const handleLoadMore = useCallback(() => {
    if (state.kind !== "ready" || !state.hasMore) return
    // We use offset-based pagination here even though the URL stores
    // a page number — OCA pages are limit=20, so next page = current
    // count / limit + 1. Simpler than tracking the page in state.
    const nextPage = Math.floor(state.offset / PAGE_LIMIT) + 1
    fetchPage(nextPage, true)
  }, [state, fetchPage])

  return (
    <div
      style={{
        padding: "24px 32px 80px",
        maxWidth: 1280,
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
          Compliance · Onboarding
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
          Onboarding
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
          {state.kind === "ready"
            ? `${state.total} session${state.total === 1 ? "" : "s"} · sorted by last activity`
            : state.kind === "loading"
              ? "Loading…"
              : "KYB sessions feed from OCA"}
        </p>
      </div>

      <OnboardingFilters />

      {state.kind === "not_authorized" && (
        <div
          style={{
            marginTop: 20,
            padding: "20px 24px",
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: 12,
            color: TEXT,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 18,
              marginBottom: 8,
              color: "#FBBF24",
            }}
          >
            Not yet authorized
          </div>
          <div>{state.message}</div>
        </div>
      )}

      {state.kind === "error" && (
        <div
          style={{
            marginTop: 20,
            padding: "20px 24px",
            background: "rgba(248,113,113,0.06)",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 12,
            color: TEXT,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: 18,
              marginBottom: 8,
              color: "#F87171",
            }}
          >
            Could not load sessions
          </div>
          <div style={{ marginBottom: 12 }}>{state.message}</div>
          <button
            onClick={() => fetchPage(1, false)}
            style={{
              background: "transparent",
              border: `1px solid ${CRM_COLORS.card_border}`,
              borderRadius: 8,
              padding: "8px 14px",
              color: CRM_COLORS.text_secondary,
              fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === "loading" && (
        <div
          style={{
            padding: "60px 0",
            textAlign: "center",
            color: TEXT3,
            fontSize: 12,
          }}
        >
          Loading sessions…
        </div>
      )}

      {state.kind === "ready" && state.rows.length === 0 && (
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
            No onboarding sessions match your filters
          </div>
          <div>Clear filters above, or wait for the next OCA intake.</div>
        </div>
      )}

      {state.kind === "ready" && state.rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {state.rows.map((row) => (
            <SessionRow key={row.id} row={row} />
          ))}
        </div>
      )}

      {state.kind === "ready" && state.hasMore && (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              background: "transparent",
              border: `1px solid ${CRM_COLORS.card_border}`,
              borderRadius: 8,
              padding: "10px 20px",
              color: CRM_COLORS.text_primary,
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              cursor: loadingMore ? "default" : "pointer",
              opacity: loadingMore ? 0.6 : 1,
            }}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

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
