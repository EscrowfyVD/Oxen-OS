import { z } from "zod"

/**
 * Schemas for POST /api/signals — universal signal ingestion endpoint
 * (Sprint S1 batch 2).
 *
 * The endpoint accepts three scopes via a discriminated union on
 * `scope`:
 *
 *   - "contact" : per-contact intent signal (writes to IntentSignal,
 *     contactId required, companyId auto-denormalized from
 *     CrmContact.companyId by the route handler)
 *
 *   - "company" : per-company intent signal with no specific contact
 *     yet (writes to IntentSignal, companyId required, contactId
 *     stays null)
 *
 *   - "market"  : country / vertical-scoped signal (writes to
 *     MarketSignal, country required, vertical optional)
 *
 * `signalTypeCode` MUST already exist in SignalTypeRegistry — the
 * route returns 400 if not. Codes are pre-registered via the seed
 * script (`scripts/db/seed-signal-types.ts`) or by the legacy
 * webhooks (which upsert their own placeholders).
 *
 * `customPoints` is an optional integer override on top of the
 * registry's `defaultPoints` — used when an integration knows the
 * signal is unusually strong/weak for its category.
 *
 * `occurredAt` is the timestamp the signal *happened in the real
 * world* (Lemlist reply, LinkedIn post, etc.). Defaults to "now" if
 * the caller doesn't provide one. The route uses this anchor to
 * compute `expiresAt = occurredAt + decayDays`.
 */

// ─────────────────────────────────────────────────────────────────────
// Common fields shared across all 3 scopes
// ─────────────────────────────────────────────────────────────────────
const commonFields = {
  signalTypeCode: z.string().min(1).max(100),
  customPoints: z.number().int().min(0).max(10000).optional(),
  metadata: z.unknown().optional(),
  sourceUrl: z.string().url().max(2000).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(5000).optional(),
}

// ─────────────────────────────────────────────────────────────────────
// Per-scope branches
// ─────────────────────────────────────────────────────────────────────
const contactScopeSchema = z.object({
  scope: z.literal("contact"),
  contactId: z.string().min(1).max(50),
  ...commonFields,
})

const companyScopeSchema = z.object({
  scope: z.literal("company"),
  companyId: z.string().min(1).max(50),
  ...commonFields,
})

const marketScopeSchema = z.object({
  scope: z.literal("market"),
  country: z.string().min(1).max(100),
  vertical: z.string().max(100).optional(),
  ...commonFields,
})

// ─────────────────────────────────────────────────────────────────────
// Discriminated union on `scope`
// ─────────────────────────────────────────────────────────────────────
export const signalIngestionSchema = z.discriminatedUnion("scope", [
  contactScopeSchema,
  companyScopeSchema,
  marketScopeSchema,
])

export type SignalIngestionPayload = z.infer<typeof signalIngestionSchema>
