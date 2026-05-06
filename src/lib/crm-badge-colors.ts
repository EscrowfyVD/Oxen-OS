/**
 * Shared color maps for PRD-001 Clay enrichment badges.
 *
 * Single source of truth for `Group`, `Pain Tier`, `Persona` badge
 * colors across the CRM UI. Used by:
 *   - src/components/crm/InlineEditableTable.tsx (Contacts list)
 *   - src/app/crm/contacts/[id]/page.tsx (Contact detail)
 *   - src/app/crm/companies/page.tsx (Companies list — Sprint S0.5 batch 4)
 *   - any future component rendering a Clay-enrichment badge
 *
 * Keep this module client-safe (no Prisma, no env-var-dependent logic)
 * so it can be imported from "use client" components.
 *
 * Sprint S0.5 batch 3 — extracted from InlineEditableTable inline maps.
 */

/**
 * 8 distinct hex colors, intuitively ordered from G1 (highest priority,
 * structural architects of offshore) through G7B (mobility/relocation).
 * Each color was chosen to be distinguishable from its neighbors and
 * to read well at small badge sizes against the dark glass background.
 */
export const GROUP_COLORS: Record<string, string> = {
  G1: "#DC2626", // red — Structural Architects (CSPs, fiduciaries)
  G2: "#2563EB", // blue — Legal Deal-Flow
  G3: "#7C3AED", // violet — Investment Gatekeepers
  G4: "#059669", // emerald — Wealth Intermediaries (MFOs)
  G5: "#F59E0B", // amber — Compliance & Accounting
  G6: "#0891B2", // cyan — High-Ticket Settlement (luxury brokers)
  G7A: "#DB2777", // pink — Lifestyle / Luxury Concierges
  G7B: "#4F46E5", // indigo — Mobility / Immigration / Relocation
}

/**
 * Pain tier colors form an intensity gradient: red (max pain) → amber
 * (constant friction) → gray (suboptimal). The ordering reinforces the
 * scoring intent — T1 should jump out, T3 should fade.
 */
export const PAIN_TIER_COLORS: Record<string, string> = {
  T1: "#DC2626", // red — Maximum Pain
  T2: "#F59E0B", // amber — Constant Friction
  T3: "#6B7280", // gray — Suboptimal Solution
}

/**
 * DM uses the brand rose-gold (#C08B88) so decision-makers visually
 * pop in lists — they are the primary outreach target for sequence
 * naming `{Group}-{Tier}-DM`. OP uses neutral gray.
 */
export const PERSONA_COLORS: Record<string, string> = {
  DM: "#C08B88", // rose-gold — Decision Maker
  OP: "#6B7280", // gray — Operational
}

/**
 * Resolve the canonical color for any Clay-enrichment badge value.
 * Returns null if the key is not in the corresponding map (e.g. an
 * unexpected legacy or future value), letting callers decide how to
 * fall back.
 */
export function getGroupColor(value: string | null | undefined): string | null {
  if (!value) return null
  return GROUP_COLORS[value] ?? null
}

export function getPainTierColor(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  return PAIN_TIER_COLORS[value] ?? null
}

export function getPersonaColor(
  value: string | null | undefined,
): string | null {
  if (!value) return null
  return PERSONA_COLORS[value] ?? null
}

/**
 * Default fallback color for any unknown / missing badge value. Mid-gray
 * so it reads as "no signal" rather than masquerading as a real category.
 */
export const FALLBACK_BADGE_COLOR = "#9CA3AF"
