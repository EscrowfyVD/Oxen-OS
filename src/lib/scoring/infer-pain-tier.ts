// Resolve a CrmContact's Pain Tier (T1 / T2 / T3).
//
// V1 — OVERRIDE-ONLY. Decisions actées (Recon Sprint 3c) :
//   D2/D10 — Andy's reference doc §10 acknowledges that the exact
//            inference rules for Pain Tier are NOT pinned. Vernon's
//            doc itself flags this as "Q1 — Pain Tier inference exact
//            rules" and recommends a manual draft + Andy validation
//            before shipping any algorithm. Sprint 3c ships the
//            override-only resolver so the scoring pipeline can
//            already SURFACE a tier when BDs set one manually via
//            CrmContact.painTierOverride. Full inference is DEFERRED
//            to V2 (a future sprint after Andy's algorithm is
//            ratified) — this avoids shipping a synthetic Pain Tier
//            that downstream consumers (sequence routing, alert
//            triage) would treat as authoritative.
//
// Pure function. No DB touch. Reads painTierOverride + excludedFrom
// off the contact ; returns the override mapped to the upstream
// CrmPainTier enum value (T1/T2/T3) or null when no override is set.

import type { CrmPainTier } from "@prisma/client"

export type PainTier = "T1" | "T2" | "T3"

export interface InferPainTierInput {
  /** BD manual override — free string on CrmContact (per Sprint 3a schema). */
  painTierOverride: string | null
  /**
   * `excludedFrom` array. If it contains "scoring", we short-circuit
   * to null — opted-out accounts don't carry a tier (consistent with
   * assignPriorityLevel returning "Excluded" for the same input).
   */
  excludedFrom: string[]
}

const ALLOWED: ReadonlySet<PainTier> = new Set<PainTier>(["T1", "T2", "T3"])

/**
 * Resolve a Pain Tier from a contact's override (V1).
 *
 * Returns null when :
 *   - the contact is excluded from scoring (D1 alignment)
 *   - the override is null / missing
 *   - the override carries an unknown value (defensive — a future
 *     enum addition shouldn't crash the page ; we just don't surface
 *     a tier until the rendering layer learns about it)
 *
 * V2 TODO : add inference branch reading Cat C/D/E signals + company
 * context, gated behind Andy-ratified rules.
 */
export function inferPainTier(input: InferPainTierInput): PainTier | null {
  if (input.excludedFrom.includes("scoring")) {
    return null
  }
  const ov = input.painTierOverride
  if (ov === null || ov === undefined) return null
  if (ALLOWED.has(ov as PainTier)) {
    return ov as PainTier
  }
  return null
}

/**
 * Cast helper for callers that need to write the result back to the
 * CrmContact.painTier column (typed against the CrmPainTier Prisma
 * enum). Centralized here so the (safe) cast lives next to the V1
 * caveat — when V2 lands, this helper is the single place that
 * needs the cast review.
 */
export function painTierForPrismaWrite(
  tier: PainTier | null,
): CrmPainTier | null {
  return tier as CrmPainTier | null
}
