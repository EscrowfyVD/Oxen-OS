// Shared types for the Onboarding console — mirror the OCA operator
// API response shapes verbatim so the proxy can remain a pure
// pass-through (no field renaming) and the UI components type-check
// against the upstream contract.
//
// Source: OCA operator API ("Oxen Compliance Agent") documented in
// docs/sprint-16/SP16_002_RECON.md Context anchors.

export type SessionStatus = string
export type SessionRiskLevel = "low" | "medium" | "high" | "critical" | string

export interface SessionRow {
  id: string
  platform: string
  entity_type: string
  current_step: string | null
  status: SessionStatus
  legal_rep_name: string | null
  legal_rep_email: string | null
  company_name: string | null
  risk_score: number | null
  risk_level: SessionRiskLevel | null
  agent_active: boolean
  idle_minutes: number | null
  createdAt: string
  updatedAt: string
  lastActivityAt: string | null
}

export interface SessionsListResponse {
  data: SessionRow[]
  total: number
  page: number
  limit: number
}

// Distinct error shape returned by /api/oca/proxy when OCA returns 401
// (operator email not on OCA's OPERATOR_ALLOWLIST_EMAILS). The UI
// renders this differently from a generic error so the user knows to
// ask Vernon rather than retry.
export interface NotAuthorizedError {
  error: "not_authorized"
  message: string
}

export interface OcaUnreachableError {
  error: "oca_unreachable"
  message: string
}

export interface OcaNotConfiguredError {
  error: "oca_not_configured"
  message: string
}

export type ProxyErrorBody =
  | NotAuthorizedError
  | OcaUnreachableError
  | OcaNotConfiguredError
  | { error: string; message?: string }
