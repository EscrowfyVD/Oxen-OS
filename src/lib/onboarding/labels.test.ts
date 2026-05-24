/**
 * Tests for the SP16-004 label humanization module.
 *
 * Two layers:
 *   1. humanizeToken — generic fallback. Boundary cases (null,
 *      undefined, empty, already-humanized, snake/SCREAMING/kebab,
 *      single word).
 *   2. labelForX — one assertion per Vernon-specified wording (the
 *      decisions that the generic can't reach: "Awaiting client reply",
 *      "ID document", "PoA collection", "Legal representative") plus a
 *      sanity assertion that unknown upstream values fall through to
 *      humanizeToken (never raw).
 */

import { describe, it, expect } from "vitest"
import {
  humanizeToken,
  labelForSessionStatus,
  labelForBlockerReason,
  labelForEntityType,
  labelForOnboardingStep,
  labelForRiskLevel,
  labelForDocType,
  labelForDocValidationStatus,
  labelForVerificationStatus,
  labelForScreeningResult,
  labelForPersonRole,
  labelForCaseSeverity,
} from "./labels"

// ─── humanizeToken ───────────────────────────────────────────────────

describe("humanizeToken", () => {
  it("snake_case → sentence case", () => {
    expect(humanizeToken("legal_entity")).toBe("Legal entity")
    expect(humanizeToken("proof_of_address")).toBe("Proof of address")
  })

  it("SCREAMING_SNAKE_CASE → sentence case", () => {
    expect(humanizeToken("TRIAGE")).toBe("Triage")
    expect(humanizeToken("AWAITING_USER_REPLY")).toBe("Awaiting user reply")
    expect(humanizeToken("PAUSED_MANUAL_APPROVAL")).toBe("Paused manual approval")
  })

  it("kebab-case → sentence case", () => {
    expect(humanizeToken("not-authorized")).toBe("Not authorized")
  })

  it("single lowercase word → capitalized", () => {
    expect(humanizeToken("paused")).toBe("Paused")
  })

  it("already-humanized input returned as-is (idempotent)", () => {
    expect(humanizeToken("ID document")).toBe("ID document")
    expect(humanizeToken("Legal entity")).toBe("Legal entity")
  })

  it("null / undefined / empty → empty string", () => {
    expect(humanizeToken(null)).toBe("")
    expect(humanizeToken(undefined)).toBe("")
    expect(humanizeToken("")).toBe("")
    expect(humanizeToken("   ")).toBe("")
  })

  it("non-string input coerced via String() (defensive)", () => {
    expect(humanizeToken(42)).toBe("42")
    expect(humanizeToken(true)).toBe("True")
  })
})

// ─── labelForSessionStatus ───────────────────────────────────────────

describe("labelForSessionStatus", () => {
  it("matches the OnboardingFilters chip vocabulary", () => {
    expect(labelForSessionStatus("active")).toBe("Active")
    expect(labelForSessionStatus("review")).toBe("In review") // critical: chip says the same
    expect(labelForSessionStatus("paused")).toBe("Paused")
    expect(labelForSessionStatus("rejected")).toBe("Rejected")
    expect(labelForSessionStatus("completed")).toBe("Completed")
    expect(labelForSessionStatus("approved")).toBe("Approved")
    expect(labelForSessionStatus("expired")).toBe("Expired")
  })

  it("unknown upstream value → humanizeToken fallback (never raw)", () => {
    expect(labelForSessionStatus("totally_new_status")).toBe("Totally new status")
  })

  it("null/undefined → empty string", () => {
    expect(labelForSessionStatus(null)).toBe("")
    expect(labelForSessionStatus(undefined)).toBe("")
  })
})

// ─── labelForBlockerReason ───────────────────────────────────────────

describe("labelForBlockerReason", () => {
  it("awaiting_user_reply → 'Awaiting client reply' (Vernon wording)", () => {
    // NOT "Awaiting user reply" — operators talk about CLIENTS.
    expect(labelForBlockerReason("awaiting_user_reply")).toBe("Awaiting client reply")
  })

  it("covers all 8 SP15-003 codes", () => {
    expect(labelForBlockerReason("agent_error")).toBe("Agent error")
    expect(labelForBlockerReason("compliance_escalation")).toBe("Compliance escalation")
    expect(labelForBlockerReason("extraction_failed")).toBe("Extraction failed")
    expect(labelForBlockerReason("awaiting_identity")).toBe("Awaiting identity verification")
    expect(labelForBlockerReason("awaiting_doc_upload")).toBe("Awaiting document upload")
    expect(labelForBlockerReason("doc_processing")).toBe("Document processing")
    expect(labelForBlockerReason("awaiting_user_reply")).toBe("Awaiting client reply")
    expect(labelForBlockerReason("idle_no_specific_cause")).toBe("Idle (no specific cause)")
  })

  it("unknown code → humanizeToken fallback", () => {
    expect(labelForBlockerReason("some_new_blocker")).toBe("Some new blocker")
  })
})

// ─── labelForEntityType ──────────────────────────────────────────────

describe("labelForEntityType", () => {
  it("legal_entity → 'Legal entity'", () => {
    expect(labelForEntityType("legal_entity")).toBe("Legal entity")
  })
  it("natural_person → 'Natural person'", () => {
    expect(labelForEntityType("natural_person")).toBe("Natural person")
  })
})

// ─── labelForOnboardingStep ──────────────────────────────────────────

describe("labelForOnboardingStep", () => {
  it("TRIAGE → 'Triage'", () => {
    expect(labelForOnboardingStep("TRIAGE")).toBe("Triage")
  })
  it("PoA / Form K-or-A / KYC acronyms preserved", () => {
    expect(labelForOnboardingStep("POA_COLLECTION")).toBe("PoA collection")
    expect(labelForOnboardingStep("FORM_K_OR_A")).toBe("Form K/A")
    expect(labelForOnboardingStep("KYC_PROFILE")).toBe("KYC profile")
  })
  it("PAUSED_MANUAL_APPROVAL gets a parenthetical clarification", () => {
    expect(labelForOnboardingStep("PAUSED_MANUAL_APPROVAL")).toBe("Paused (manual approval)")
  })
  it("unknown step → humanizeToken fallback", () => {
    expect(labelForOnboardingStep("NEW_STEP_42")).toBe("New step 42")
  })
})

// ─── labelForDocType — acronym preservation ──────────────────────────

describe("labelForDocType", () => {
  it("id_document → 'ID document' (acronym uppercase, not 'Id document')", () => {
    expect(labelForDocType("id_document")).toBe("ID document")
  })
  it("company_poa / individual_poa preserve PoA capitalization", () => {
    expect(labelForDocType("company_poa")).toBe("Company PoA")
    expect(labelForDocType("individual_poa")).toBe("Individual PoA")
  })
  it("form_k / form_a → 'Form K' / 'Form A' (single-letter caps)", () => {
    expect(labelForDocType("form_k")).toBe("Form K")
    expect(labelForDocType("form_a")).toBe("Form A")
  })
  it("unknown doc_type → humanizeToken fallback", () => {
    expect(labelForDocType("some_new_doc")).toBe("Some new doc")
  })
})

// ─── labelForPersonRole — acronym + full-form preservation ───────────

describe("labelForPersonRole", () => {
  it("ubo → 'UBO' (industry acronym)", () => {
    expect(labelForPersonRole("ubo")).toBe("UBO")
  })
  it("legal_rep → 'Legal representative' (full form preferred)", () => {
    expect(labelForPersonRole("legal_rep")).toBe("Legal representative")
  })
})

// ─── Sanity coverage on the remaining maps ───────────────────────────

describe("remaining maps — at least one known + fallback per", () => {
  it("labelForRiskLevel", () => {
    expect(labelForRiskLevel("standard")).toBe("Standard")
    expect(labelForRiskLevel("critical")).toBe("Critical") // unknown → fallback
  })
  it("labelForDocValidationStatus", () => {
    expect(labelForDocValidationStatus("deferred")).toBe("Deferred")
    expect(labelForDocValidationStatus("withdrawn")).toBe("Withdrawn") // unknown → fallback
  })
  it("labelForVerificationStatus", () => {
    expect(labelForVerificationStatus("in_progress")).toBe("In progress")
    expect(labelForVerificationStatus("hold")).toBe("Hold") // unknown → fallback
  })
  it("labelForScreeningResult", () => {
    expect(labelForScreeningResult("potential_match")).toBe("Potential match")
    expect(labelForScreeningResult("review_needed")).toBe("Review needed") // unknown → fallback
  })
  it("labelForCaseSeverity", () => {
    expect(labelForCaseSeverity("critical")).toBe("Critical")
    expect(labelForCaseSeverity("urgent")).toBe("Urgent") // unknown → fallback
  })
})
