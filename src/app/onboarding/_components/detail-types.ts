// Type shapes for the OCA consolidated session GET response.
//
// The OCA detail endpoint returns a heterogeneous payload —
// `session` core + 6 named `data` blobs with `_source_<field>`
// provenance tags + chat + cases + verifications + screening +
// operator_audit. The exact field schema for each blob isn't pinned
// in the SP15/SP16-001 contract, so we type the open shapes loosely
// (Record<string, unknown>) and defensively-render in the UI.
//
// If a stricter schema lands later, narrowing here propagates into
// the panel components without re-plumbing.

import type { SessionRow } from "./types"

/**
 * One of the 6 data blobs returned under `data.<section_name>`. The
 * fields are arbitrary string-keyed values; provenance is stored
 * alongside as `_source_<field>` keys (e.g. `first_name: "John"` +
 * `_source_first_name: "operator-provided"`).
 *
 * The UI iterates payload keys, skips ones starting with `_source_`,
 * and resolves the matching `_source_<key>` for the provenance pill.
 */
export type SectionPayload = Record<string, unknown>

export type DataBlobs = Record<string, SectionPayload>

export interface BlockerReason {
  code: string
  message: string
}

export type ChatRole = "user" | "ai" | "operator" | "system" | string

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  // operator messages may carry the email of the operator who sent it
  operator_email?: string | null
}

export interface ChatSummary {
  messages: ChatMessage[]
  truncated: boolean
  total: number
}

// SP16-002b §2 — DocumentRow pinned against OCA staging on 2026-05-22.
// All fields except id+file_name optional so a partially-populated
// document still renders. Cases / screening / audit shapes are
// updated in the SP16-002b §3 + §4 commits, not here, so this commit
// can be atomic + build-green.

export interface DocumentRow {
  id: string
  file_name: string
  doc_type?: string | null
  validation_status?: string | null
  processing_status?: string | null
  extraction_failed?: boolean | null
  created_at?: string | null
}

// SP16-002b §3 — CaseItem pinned against OCA staging on 2026-05-22.
// All fields except id optional so a partially-populated case still
// renders. Pre-fix the type used invented field names (type/summary/
// createdAt) — replaced with the real OCA fields (case_type/title/
// created_at) and the new severity field.
export interface CaseItem {
  id: string
  case_type?: string | null
  severity?: string | null
  status?: string | null
  title?: string | null
  created_at?: string | null
}

export interface CasesSummary {
  open_count: number
  items: CaseItem[]
}

export interface AuditEvent {
  id: string
  operator_email: string | null
  action: string
  details?: string | Record<string, unknown> | null
  createdAt: string
}

/**
 * The consolidated GET payload. `data` / `verifications` /
 * `screening` stay loose to absorb upstream shape drift — the
 * SectionPanel null-checks every field it renders. `documents` is
 * pinned to the verified DocumentRow[] shape (SP16-002b §2).
 */
export interface ConsolidatedSession {
  // session core mirrors the list row plus possibly more timestamps.
  session: SessionRow & Record<string, unknown>
  data: DataBlobs
  blocker_reason: BlockerReason | null
  chat: ChatSummary
  documents: DocumentRow[] | null
  cases: CasesSummary | null
  verifications: Record<string, unknown> | null
  screening: Record<string, unknown> | null
  operator_audit: AuditEvent[]
}

/**
 * Strip the `_source_` provenance keys from a section payload so the
 * caller can iterate the "real" fields without filtering inline.
 * Returns the field entries plus a lookup function to resolve a
 * provenance tag for any field key.
 */
export function splitProvenance(
  payload: SectionPayload,
): {
  fields: Array<[string, unknown]>
  provenanceFor: (fieldKey: string) => string | null
} {
  const entries = Object.entries(payload)
  const fields = entries.filter(([k]) => !k.startsWith("_source_"))
  const sourceMap = new Map<string, string>()
  for (const [k, v] of entries) {
    if (k.startsWith("_source_") && typeof v === "string") {
      sourceMap.set(k.slice("_source_".length), v)
    }
  }
  return {
    fields,
    provenanceFor: (key: string) => sourceMap.get(key) ?? null,
  }
}
