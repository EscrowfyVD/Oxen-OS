// Reactive layer seam (Trigify PR1).
//
// Wires the two previously-dormant primitives — classifyTrigger +
// orchestrateSequence — into a single shared entry point so the Trigify
// webhook (and, later, the central ingestSignal / Apify path per PRD-005)
// react to a fresh signal IDENTICALLY, without duplicating the glue.
//
// Behaviour, locked to the Trigify brief §4 as reframed by the never-pause
// product decision:
//   - immediate (§4.1): the caller's hot alert (maybeAlertBDs) already fires;
//     here we ONLY set the Lemlist variables (no second alert).
//   - rapid (§4.2): content adaptation via Lemlist variable injection
//     (updateLeadVariables) — the Lemlist API has no programmatic step-advance,
//     so "advance" = the next scheduled email picks up the fresh customFields.
//   - passive (§4.3): no Lemlist call; record an Activity row "for future
//     personalization".
//   - unknown/unclassified code, contact gone, or any error → skipped.
//
// NEVER pauses a sequence: orchestrateSequence is structurally pause-free
// (terminal / not-enrolled / passive all → noop; the only Lemlist write it
// ever issues is updateLeadVariables). This helper adds no new Lemlist write.
//
// Failure policy: errors are SWALLOWED. The reactive layer is a side effect of
// ingestion and must never fail the webhook (Phase-2 import robustness >
// reactive completeness).

import { prisma } from "@/lib/prisma"
import { getActiveScoringConfig } from "./config-loader"
import { classifyTrigger, type TriggerType } from "./classify-trigger"
import {
  orchestrateSequence,
  type OrchestrateResult,
} from "./orchestrate-sequence"
import { logger, serializeError } from "@/lib/logger"

const log = logger.child({ component: "apply-reactive-layer" })

export interface ApplyReactiveLayerInput {
  /** CrmContact.id the signal landed on. */
  contactId: string
  /** Canonical SignalTypeRegistry code (drives classifyTrigger). */
  signalCode: string
  /** Short human context for the next-email variable / Activity (optional). */
  contextSnippet?: string | null
}

export interface ApplyReactiveLayerResult {
  trigger: TriggerType | null
  action: OrchestrateResult["action"] | "skipped"
  reason?: string
  activityLogged: boolean
  lemlistResult?: OrchestrateResult["lemlistResult"]
}

const SKIPPED = (
  reason: string,
  trigger: TriggerType | null = null,
): ApplyReactiveLayerResult => ({
  trigger,
  action: "skipped",
  reason,
  activityLogged: false,
})

/**
 * React to a freshly-ingested intent signal: classify it, then adapt the
 * contact's Lemlist sequence (rapid/immediate) or log a passive Activity.
 * Pure side effect — returns a structured summary, never throws.
 */
export async function applyReactiveLayer(
  input: ApplyReactiveLayerInput,
): Promise<ApplyReactiveLayerResult> {
  try {
    // 1. Classify against the active config's followUpTriggers (cached 60s).
    const config = await getActiveScoringConfig()
    const trigger = classifyTrigger(input.signalCode, config)
    if (trigger === null) return SKIPPED("unclassified_code")

    // 2. Load the fields orchestrateSequence needs (extended select).
    const contact = await prisma.crmContact.findUnique({
      where: { id: input.contactId },
      select: {
        id: true,
        email: true,
        lemlistStatus: true,
        lemlistCampaignId: true,
        priorityLevel: true,
      },
    })
    if (!contact) return SKIPPED("contact_not_found", trigger)

    // 3. Orchestrate. immediate/rapid → updateLeadVariables; passive/terminal/
    //    not-enrolled → noop. Never a pause.
    const result = await orchestrateSequence(
      {
        id: contact.id,
        email: contact.email,
        lemlistStatus: contact.lemlistStatus,
        lemlistCampaignId: contact.lemlistCampaignId,
        priorityLevel: contact.priorityLevel,
      },
      trigger,
      {
        signalCode: input.signalCode,
        contextSnippet: input.contextSnippet ?? undefined,
      },
    )

    // 4. §4.3 — passive signals never touch Lemlist; record them on the CRM
    //    timeline so the BD can personalize a future touch.
    let activityLogged = false
    if (trigger === "passive") {
      await prisma.activity.create({
        data: {
          contactId: contact.id,
          type: "intent_signal_passive",
          description: `Passive intent signal: ${input.signalCode}${
            input.contextSnippet ? ` — ${input.contextSnippet}` : ""
          }`,
          metadata: {
            signalCode: input.signalCode,
            contextSnippet: input.contextSnippet ?? null,
          },
          performedBy: "system",
        },
      })
      activityLogged = true
    }

    return {
      trigger,
      action: result.action,
      reason: result.reason,
      activityLogged,
      lemlistResult: result.lemlistResult,
    }
  } catch (err) {
    // Swallow — never fail the caller (webhook).
    log.error(
      {
        err: serializeError(err),
        contactId: input.contactId,
        signalCode: input.signalCode,
      },
      "applyReactiveLayer failed (swallowed)",
    )
    return SKIPPED("error")
  }
}
