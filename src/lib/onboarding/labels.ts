// Display-only label humanization for the Onboarding console (SP16-004).
//
// PURE PRESENTATION LAYER — these helpers MUST NOT be used inside
// filter logic, equality checks, or proxy payloads. The raw enum
// values (`active`, `legal_entity`, `AWAITING_USER_REPLY`, …) stay
// the contract on the wire and the contract for state comparisons.
// We only swap them out at render time so operators see human text.
//
// Maps are pinned to the OCA source-of-truth enums (verified against
// /Users/vd/Code/oxen-compliance-agent on 2026-05-23 — Step 0):
//
//   SessionStatus       (Prisma)  — 7 values
//   OnboardingStep      (Prisma)  — 12 values
//   EntityType          (Prisma)  — 2 values
//   RiskLevel           (Prisma)  — 2 values
//   DocType             (Prisma)  — 14 values
//   DocValidationStatus (Prisma)  — 5 values
//   VerificationStatus  (Prisma)  — 6 values
//   ScreeningResult     (Prisma)  — 5 values
//   PersonRole          (Prisma)  — 6 values
//   BlockerReason       (SP15-003 TS union — src/services/blocker-reason.ts) — 8 values
//   CaseSeverity        (free string per InvestigationCase model) — 4 documented values
//
// Any value that lands here outside the maps falls back to
// humanizeToken() — never raw. Adding a new enum value upstream is
// safe by default (generic fallback) and improvable with a map entry.

/**
 * Convert a token (snake_case / SCREAMING_SNAKE_CASE / kebab-case /
 * a single lowercase / uppercase word) into a sentence-cased human
 * label.
 *
 * Already-humanized inputs (containing a space) are returned as-is so
 * the helper is idempotent — calling it twice doesn't downgrade
 * "ID document" to "Id document".
 *
 * Null / undefined / empty → empty string. Non-string input is
 * coerced via String(...) defensively (some OCA fields are typed
 * `string` upstream but a future enum-to-number switch shouldn't
 * crash the page).
 */
export function humanizeToken(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  const s = String(raw).trim()
  if (s.length === 0) return ""
  // Already-humanized (contains an internal space) — return as-is.
  if (/\s/.test(s)) return s
  // Replace common separators with spaces, lowercase the whole thing,
  // then capitalize the first character (sentence case — NOT Title Case
  // which would over-promote function words like "of"/"or").
  const spaced = s.replace(/[_-]+/g, " ").toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// ─────────────────────────────────────────────────────────────────────
// Explicit business-vocabulary maps
//
// Each map covers EVERY value of its upstream enum. Adding a value
// upstream → either add a map entry or accept the generic fallback
// (humanizeToken). Removing a map entry is fine — the generic fires.
// ─────────────────────────────────────────────────────────────────────

const SESSION_STATUS: Record<string, string> = {
  active: "Active",
  // "In review" matches the OnboardingFilters chip label so the row
  // badge + filter chip + this generic label all read the same.
  review: "In review",
  paused: "Paused",
  rejected: "Rejected",
  completed: "Completed",
  approved: "Approved",
  expired: "Expired",
}

const BLOCKER_REASON: Record<string, string> = {
  // Vernon-specified wording: "client" not "user" — the UI talks to
  // compliance operators about the applicants they're vetting.
  awaiting_user_reply: "Awaiting client reply",
  awaiting_identity: "Awaiting identity verification",
  awaiting_doc_upload: "Awaiting document upload",
  doc_processing: "Document processing",
  extraction_failed: "Extraction failed",
  compliance_escalation: "Compliance escalation",
  agent_error: "Agent error",
  idle_no_specific_cause: "Idle (no specific cause)",
}

const ENTITY_TYPE: Record<string, string> = {
  legal_entity: "Legal entity",
  natural_person: "Natural person",
}

const ONBOARDING_STEP: Record<string, string> = {
  TRIAGE: "Triage",
  ENTITY_CLASSIFICATION: "Entity classification",
  PROCESS_DOC: "Process documents",
  // "K/A" — the upstream OnboardingStep is FORM_K_OR_A; both Forms K
  // and Form A live under the same step. Use slash for compactness.
  FORM_K_OR_A: "Form K/A",
  KYC_PROFILE: "KYC profile",
  TRANSACTION: "Transaction",
  // "PoA" — proof-of-address acronym; matches the OCA naming
  // (`company_poa` / `individual_poa` in DocType).
  POA_COLLECTION: "PoA collection",
  COMPLETED: "Completed",
  REVIEW: "Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAUSED_MANUAL_APPROVAL: "Paused (manual approval)",
}

const RISK_LEVEL: Record<string, string> = {
  standard: "Standard",
  high: "High",
}

const DOC_TYPE: Record<string, string> = {
  certificate_of_incorporation: "Certificate of incorporation",
  articles_of_association: "Articles of association",
  register_of_directors: "Register of directors",
  register_of_shareholders: "Register of shareholders",
  company_poa: "Company PoA",
  individual_poa: "Individual PoA",
  // "ID document" with uppercase acronym — the generic fallback would
  // produce "Id document" which reads wrong to compliance operators.
  id_document: "ID document",
  proof_of_address: "Proof of address",
  individual_proof_of_address: "Individual proof of address",
  bank_statement: "Bank statement",
  source_of_funds: "Source of funds",
  form_k: "Form K",
  form_a: "Form A",
  other: "Other",
}

const DOC_VALIDATION_STATUS: Record<string, string> = {
  pending: "Pending",
  valid: "Valid",
  invalid: "Invalid",
  expired: "Expired",
  deferred: "Deferred",
}

const VERIFICATION_STATUS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  approved: "Approved",
  rejected: "Rejected",
  retry: "Retry",
  expired: "Expired",
}

const SCREENING_RESULT: Record<string, string> = {
  clear: "Clear",
  match: "Match",
  potential_match: "Potential match",
  findings: "Findings",
  error: "Error",
}

const PERSON_ROLE: Record<string, string> = {
  director: "Director",
  // "UBO" — Ultimate Beneficial Owner; industry-standard acronym.
  ubo: "UBO",
  controlling_person: "Controlling person",
  beneficial_owner: "Beneficial owner",
  // "Legal representative" — full form preferred over "Legal rep" for
  // the detail view (the abbrev is fine in dense table cells, but the
  // label module produces one canonical label).
  legal_rep: "Legal representative",
  signatory: "Signatory",
}

const CASE_SEVERITY: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

// ─────────────────────────────────────────────────────────────────────
// Public API — one labelForX per business enum, plus humanizeToken
// for free-string fields (case_type, processing_status, custom
// document tags, etc. — anything not enumerated upstream).
// ─────────────────────────────────────────────────────────────────────

/** Look up `raw` in `map`; if absent (or `raw` null), fall back to
 * humanizeToken so unknown upstream values still render cleanly. */
function lookup(map: Record<string, string>, raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  const key = String(raw)
  return map[key] ?? humanizeToken(key)
}

export function labelForSessionStatus(raw: unknown): string {
  return lookup(SESSION_STATUS, raw)
}

export function labelForBlockerReason(raw: unknown): string {
  return lookup(BLOCKER_REASON, raw)
}

export function labelForEntityType(raw: unknown): string {
  return lookup(ENTITY_TYPE, raw)
}

export function labelForOnboardingStep(raw: unknown): string {
  return lookup(ONBOARDING_STEP, raw)
}

export function labelForRiskLevel(raw: unknown): string {
  return lookup(RISK_LEVEL, raw)
}

export function labelForDocType(raw: unknown): string {
  return lookup(DOC_TYPE, raw)
}

export function labelForDocValidationStatus(raw: unknown): string {
  return lookup(DOC_VALIDATION_STATUS, raw)
}

export function labelForVerificationStatus(raw: unknown): string {
  return lookup(VERIFICATION_STATUS, raw)
}

export function labelForScreeningResult(raw: unknown): string {
  return lookup(SCREENING_RESULT, raw)
}

export function labelForPersonRole(raw: unknown): string {
  return lookup(PERSON_ROLE, raw)
}

export function labelForCaseSeverity(raw: unknown): string {
  return lookup(CASE_SEVERITY, raw)
}
