// Signal-type mapping for the Trigify webhook (Sprint Trigify Phase 2A).
//
// Trigify workflows send a free-form `signal_type` string in their HTTP
// POST payload (set by the workflow author when configuring the action).
// This module maps those human-friendly strings to the canonical
// SignalTypeRegistry `code` values seeded by
// scripts/db/seed-signal-types.ts.
//
// Unknown signal_type values fall back to the legacy
// `trigify_intent_signal` placeholder (which is itself isActive=false
// post-Phase 2A — the webhook handles that downstream by treating a
// known-deprecated code as a soft failure rather than retrying).

/**
 * Map of Trigify workflow signal_type values → SignalTypeRegistry
 * canonical code. Keys are the strings Vernon configured in the
 * Trigify dashboard; values are the codes seeded by Sprint Trigify
 * Phase 2A.
 */
export const SIGNAL_TYPE_MAPPING: Record<string, string> = {
  oxen_engagement_comment: "trigify_oxen_engagement_comment",
  oxen_engagement_like: "trigify_oxen_engagement_like",
  profile_visit: "trigify_profile_visit",
  competitor_engagement: "trigify_competitor_engagement",
  page_follow: "trigify_follow_competitor",
  role_change: "trigify_role_change",
  bio_change: "trigify_bio_change",
}

/**
 * Sentinel code used when the inbound signal_type is missing or not in
 * SIGNAL_TYPE_MAPPING. Routes upstream of this resolver decide whether
 * to drop the signal, persist it under the deprecated placeholder, or
 * surface an alert.
 */
export const DEFAULT_SIGNAL_CODE = "trigify_intent_signal"

/**
 * Resolve an inbound signal_type to a canonical SignalTypeRegistry
 * code. Returns the deprecated `trigify_intent_signal` placeholder
 * code when no mapping is found (caller logs a warning).
 */
export function mapSignalTypeToCode(signal_type?: string | null): string {
  if (!signal_type) return DEFAULT_SIGNAL_CODE
  return SIGNAL_TYPE_MAPPING[signal_type] ?? DEFAULT_SIGNAL_CODE
}

/**
 * List of canonical codes whose ingestion should trigger an immediate
 * Telegram broadcast to the BD pool. Lives here (next to the mapping)
 * so a future code addition only requires updating one file.
 *
 * `trigify_profile_visit` — hot signal, 7-day decay (urgency).
 * `trigify_oxen_engagement_comment` — high-effort interaction.
 */
export const IMMEDIATE_ALERT_SIGNAL_CODES: ReadonlySet<string> = new Set([
  "trigify_profile_visit",
  "trigify_oxen_engagement_comment",
])

export function shouldAlertImmediately(signalCode: string): boolean {
  return IMMEDIATE_ALERT_SIGNAL_CODES.has(signalCode)
}
