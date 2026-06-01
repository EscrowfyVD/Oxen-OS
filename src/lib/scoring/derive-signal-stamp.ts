// Single source of truth for the IntentSignal "stamp" — closeout #3.
//
// Every writer that inserts an IntentSignal row must denormalize the SAME
// three fields off the SignalTypeRegistry entry, identically:
//
//   - intentCategory / signalLevel : copied verbatim from the registry entry.
//     computeIntentScore (src/lib/scoring/compute-intent-score.ts) filters
//     `intentCategory != null` ON THE ROW — NOT via a join to signalTypeRef.
//     So a signal written with a missing/wrong stamp stays NULL-category and
//     contributes 0 to the A-I Intent score forever. Drift between writers is
//     failure mode F6 (stamping drift): centralizing the derivation here makes
//     it structurally impossible for two writers to stamp differently.
//     Placeholders (registry.intentCategory === null) correctly pass through
//     as null and stay excluded — that is intentional, not a bug.
//
//   - points : `customPoints ?? entry.defaultPoints`. The nullish coalescing
//     (NEVER `||`) is load-bearing: an explicit customPoints of 0 must be
//     preserved, not silently replaced by defaultPoints.
//
// This helper is PURE: it does not create rows, route by scope, look up the
// registry, or touch expiresAt / source / signalType / title / detail. Those
// stay per-caller (each ingestion source legitimately diverges on them).

import type { SignalTypeRegistry } from "@prisma/client"

/**
 * The three denormalized fields stamped onto every IntentSignal row.
 * Types are pinned to the registry columns so the return is assignable to
 * `prisma.intentSignal.create({ data: ... })` without widening/narrowing.
 */
export interface SignalStamp {
  intentCategory: SignalTypeRegistry["intentCategory"] // string | null
  signalLevel: SignalTypeRegistry["signalLevel"] // string
  points: number
}

/**
 * Derive the stamp for an IntentSignal from its registry entry.
 *
 * @param entry        the resolved SignalTypeRegistry row (or any object
 *                     carrying its intentCategory / signalLevel / defaultPoints)
 * @param customPoints optional per-signal override; when null/undefined the
 *                     registry's defaultPoints is used (`??`, never `||`)
 */
export function deriveSignalStamp(
  entry: Pick<
    SignalTypeRegistry,
    "intentCategory" | "signalLevel" | "defaultPoints"
  >,
  customPoints?: number | null,
): SignalStamp {
  return {
    intentCategory: entry.intentCategory,
    signalLevel: entry.signalLevel,
    points: customPoints ?? entry.defaultPoints,
  }
}
