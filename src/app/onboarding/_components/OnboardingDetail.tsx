"use client"

// Read-only consolidated session view at /onboarding/[id]/.
// Mirrors Intent Feed's fetch loop + state machine + error-state UX.
//
// READ-ONLY V1 (per SP16-002 EXEC): displays agent_active, the chat
// transcript, and operator audit, but renders ZERO mutation controls.
// Operator actions (pause/resume, message, slot feed, reopen) ship
// in SP16-003 — do NOT add buttons because the data is there.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CRM_COLORS } from "@/lib/crm-config"
import StatusStrip from "./StatusStrip"
import SectionPanel from "./SectionPanel"
import ChatPanel from "./ChatPanel"
import AuditPanel from "./AuditPanel"
import type { ConsolidatedSession, SectionPayload } from "./detail-types"
import type { ProxyErrorBody } from "./types"

const TEXT = CRM_COLORS.text_primary
const TEXT2 = CRM_COLORS.text_secondary
const TEXT3 = CRM_COLORS.text_tertiary

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; payload: ConsolidatedSession }
  | { kind: "not_authorized"; message: string }
  | { kind: "not_found" }
  | { kind: "error"; message: string }

function renderSummaryAsSection(
  title: string,
  payload: Record<string, unknown> | null,
) {
  if (!payload || Object.keys(payload).length === 0) {
    return <SectionPanel title={title} payload={null} />
  }
  return <SectionPanel title={title} payload={payload as SectionPayload} />
}

export default function OnboardingDetail({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" })

  const fetchSession = useCallback(async () => {
    setState({ kind: "loading" })
    try {
      const res = await fetch(`/api/oca/sessions/${encodeURIComponent(id)}`, {
        cache: "no-store",
      })
      const body = await res.json().catch(() => null)
      if (res.status === 404) {
        setState({ kind: "not_found" })
        return
      }
      if (res.status === 403) {
        const err = body as ProxyErrorBody | null
        if (err && "error" in err && err.error === "not_authorized") {
          setState({
            kind: "not_authorized",
            message:
              err.message ??
              "Your account is not authorized for the OCA operator console.",
          })
          return
        }
      }
      if (!res.ok) {
        const err = body as ProxyErrorBody | null
        setState({
          kind: "error",
          message: err?.message ?? `Failed to load session (HTTP ${res.status})`,
        })
        return
      }
      setState({ kind: "ready", payload: body as ConsolidatedSession })
    } catch {
      setState({ kind: "error", message: "Network error loading session" })
    }
  }, [id])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

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
      {/* Breadcrumb back-arrow */}
      <Link
        href="/onboarding"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: TEXT3,
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        <span>Onboarding</span>
      </Link>

      {state.kind === "loading" && (
        <div
          style={{
            padding: "80px 0",
            textAlign: "center",
            color: TEXT3,
            fontSize: 13,
          }}
        >
          Loading session…
        </div>
      )}

      {state.kind === "not_found" && (
        <div
          style={{
            padding: "60px 0",
            textAlign: "center",
            color: TEXT3,
            fontSize: 13,
            border: `1px dashed ${CRM_COLORS.card_border}`,
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 14, color: TEXT, marginBottom: 6 }}>
            Session not found
          </div>
          <div>
            The OCA session id <code>{id}</code> does not exist (it may have
            been deleted).
          </div>
        </div>
      )}

      {state.kind === "not_authorized" && (
        <div
          style={{
            padding: "20px 24px",
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: 12,
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
            padding: "20px 24px",
            background: "rgba(248,113,113,0.06)",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 12,
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
            Could not load session
          </div>
          <div style={{ marginBottom: 12 }}>{state.message}</div>
          <button
            onClick={fetchSession}
            style={{
              background: "transparent",
              border: `1px solid ${CRM_COLORS.card_border}`,
              borderRadius: 8,
              padding: "8px 14px",
              color: TEXT2,
              fontSize: 11,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === "ready" && (
        <>
          {/* Header — name + company / entity */}
          <div style={{ marginBottom: 16 }}>
            <h1
              style={{
                fontFamily: "'Bellfair', serif",
                fontSize: 24,
                fontWeight: 400,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {state.payload.session.legal_rep_name ?? "(no legal rep name)"}
              {state.payload.session.company_name && (
                <>
                  <span style={{ color: TEXT3, fontWeight: 300 }}> · </span>
                  <span>{state.payload.session.company_name}</span>
                </>
              )}
            </h1>
            <div
              style={{ fontSize: 12, color: TEXT3, marginTop: 4 }}
            >
              {state.payload.session.legal_rep_email}
              {" · "}
              {state.payload.session.entity_type}
              {state.payload.session.current_step && (
                <>
                  {" · "}step{" "}
                  <span style={{ color: TEXT2 }}>
                    {state.payload.session.current_step}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Top status strip + blocker_reason */}
          <StatusStrip payload={state.payload} />

          {/* 2-column responsive layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
              gap: 16,
            }}
          >
            {/* LEFT — session data + summaries */}
            <div style={{ minWidth: 0 }}>
              {Object.entries(state.payload.data).map(([sectionName, payload]) => (
                <SectionPanel
                  key={sectionName}
                  title={sectionName.replace(/_/g, " ")}
                  payload={payload}
                />
              ))}
              {renderSummaryAsSection("Documents", state.payload.documents)}
              {state.payload.cases && (
                <SectionPanel
                  title={`Cases (${state.payload.cases.open_count} open)`}
                  payload={{
                    open_count: state.payload.cases.open_count,
                    items: state.payload.cases.items,
                  }}
                />
              )}
              {renderSummaryAsSection("Verifications", state.payload.verifications)}
              {renderSummaryAsSection("Screening", state.payload.screening)}
            </div>

            {/* RIGHT — chat + audit */}
            <div style={{ minWidth: 0 }}>
              <ChatPanel chat={state.payload.chat} />
              <AuditPanel events={state.payload.operator_audit ?? []} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
