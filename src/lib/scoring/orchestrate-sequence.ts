/**
 * Adapt a contact's Lemlist sequence in response to a fresh signal.
 *
 * Sprint 3d D1 — the recon confirmed that the Lemlist public API does
 * NOT support programmatic sequence acceleration (no `next_send_at`,
 * no `skip` for launched leads). V1 reframes the spec:
 *
 *   - `immediate` trigger → `accelerate` action = PATCH custom variables
 *     (adapt next email content) + caller-side Telegram BD alert
 *     recommending manual move to a fast campaign.
 *   - `rapid` trigger → `adapt` action = PATCH custom variables only.
 *   - `passive` trigger → `noop` (Activity log only, no Lemlist call).
 *
 * Cross-campaign programmatic move is deferred to V2 (atomicity of the
 * 2-call enrol+remove workaround is fragile under 429 / partial fail).
 *
 * Custom field slot contract — documented here so future signal types
 * compose predictably. The campaign templates must reference these
 * placeholders for variable injection to surface in the next email:
 *
 *     customField1 = signal type code (e.g. "trigify_profile_visit")
 *     customField2 = priorityLevel    (e.g. "P1")
 *     customField3 = context snippet  (short text — title, post excerpt, etc.)
 *
 * Per-contact serialization — a single contact may receive two
 * signals within milliseconds of each other. We serialize per
 * `contact.id` via a module-scoped Promise map; the second call awaits
 * the first. V1 in-process only — once we run multiple Next.js
 * instances, V2 should migrate to a DB advisory lock or job queue.
 *
 * Refs:
 *   - Sprint 3d recon Finding 6 (PARTIAL feasibility verdict)
 *   - Sprint 3d recon Finding 7 (orchestrate design + risks)
 *   - PRD-004 §8 (Andy doc paraphrase: never pause, always adapt)
 */

import { updateLeadVariables } from "@/lib/lemlist"
import type { TriggerType } from "./classify-trigger"

// ─── Slot contract ─────────────────────────────────────────────────

export const ORCHESTRATE_SLOTS = {
  signalType: "customField1",
  priorityLevel: "customField2",
  context: "customField3",
} as const

// ─── Types ─────────────────────────────────────────────────────────

export interface OrchestrateContact {
  id: string
  email: string
  lemlistStatus: string | null
  lemlistCampaignId: string | null
  priorityLevel: string | null
}

export interface OrchestrateSignalContext {
  signalCode: string
  contextSnippet?: string
}

export interface OrchestrateResult {
  action: "accelerate" | "adapt" | "noop"
  lemlistResult?: { ok: boolean; status?: number; error?: string }
  reason?: string
}

// Terminal Lemlist statuses — a lead in any of these states must NOT
// receive further variable updates. The webhook is the source of truth
// (`src/app/api/webhooks/lemlist/route.ts:170-181`); we re-check here
// in case the read happened between webhook arrival and orchestrate.
const TERMINAL_STATUSES = new Set([
  "replied",
  "unsubscribed",
  "bounced",
  "completed",
])

// ─── Per-contact mutex ────────────────────────────────────────────

const inflight = new Map<string, Promise<OrchestrateResult>>()

// Test hook — clear inflight map between tests.
export function __resetOrchestrateInflight__(): void {
  inflight.clear()
}

// ─── Public entry ─────────────────────────────────────────────────

export async function orchestrateSequence(
  contact: OrchestrateContact,
  trigger: TriggerType,
  signalContext: OrchestrateSignalContext,
): Promise<OrchestrateResult> {
  // Serialize per-contact. The second concurrent call awaits the first,
  // then executes — both signals get processed, never lost, never
  // racing on the same Lemlist variable slot.
  const existing = inflight.get(contact.id)
  const promise = (async () => {
    if (existing) {
      // Wait for the prior signal to settle (any outcome is fine —
      // we don't depend on it).
      await existing.catch(() => undefined)
    }
    return runOrchestrate(contact, trigger, signalContext)
  })()

  inflight.set(contact.id, promise)
  try {
    return await promise
  } finally {
    // Only clear if the current promise is still the latest. A third
    // concurrent call may have replaced it; in that case its `catch`
    // chain already awaits ours, so leaving the entry alone is fine.
    if (inflight.get(contact.id) === promise) {
      inflight.delete(contact.id)
    }
  }
}

// ─── Core dispatch ────────────────────────────────────────────────

async function runOrchestrate(
  contact: OrchestrateContact,
  trigger: TriggerType,
  signalContext: OrchestrateSignalContext,
): Promise<OrchestrateResult> {
  // 1. Not enrolled → graceful noop.
  if (!contact.lemlistCampaignId) {
    return { action: "noop", reason: "not_enrolled" }
  }

  // 2. Terminal status → noop (preserves "never pause" — we simply
  //    don't touch leads that are already done).
  if (
    contact.lemlistStatus !== null &&
    TERMINAL_STATUSES.has(contact.lemlistStatus)
  ) {
    return { action: "noop", reason: `terminal_status_${contact.lemlistStatus}` }
  }

  // 3. Passive → score-only (caller writes Activity row).
  if (trigger === "passive") {
    return { action: "noop", reason: "passive_trigger" }
  }

  // 4. Adapt content for both immediate + rapid. Distinguishes the
  //    `action` label so callers know whether to also fire the Telegram
  //    "manual move recommended" alert (immediate path).
  const variables: Record<string, string> = {
    [ORCHESTRATE_SLOTS.signalType]: signalContext.signalCode,
    [ORCHESTRATE_SLOTS.priorityLevel]: contact.priorityLevel ?? "Monitor",
    [ORCHESTRATE_SLOTS.context]: signalContext.contextSnippet ?? "",
  }
  const lemlistResult = await updateLeadVariables(contact.email, variables)

  return {
    action: trigger === "immediate" ? "accelerate" : "adapt",
    lemlistResult,
  }
}
