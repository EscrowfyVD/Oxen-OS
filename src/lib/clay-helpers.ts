// Client-safe pure helpers for Clay enrichment pipeline (Sprint S0).
//
// This module contains ONLY pure functions and constants — no Prisma,
// no DB, no env-var-dependent logic. It can be safely imported from
// "use client" components (e.g. ClayImportWizard.tsx).
//
// Server-only logic (assignRandomBD, upsertCompanyFromClay,
// upsertPersonFromClay) lives in `@/lib/clay-enrichment` and depends on
// Prisma — it must NOT be imported from client components.
//
// Sprint S0 batch 4 hotfix: extracted from @/lib/clay-enrichment.ts after
// "PrismaClient is unable to run in this browser environment" crash on
// /crm/contacts. Top-level prisma import was leaking into the client
// bundle via ClayImportWizard's transitive imports.
//
// Refs: CLAY_ENRICHMENT_PAYLOAD_DRAFT.md v1.1 sections 4.2, 5, 10 (D1).

/**
 * Decision-Maker keywords (D1, Vernon 2026-05-05).
 * Lowercase substrings — first match wins.
 */
const DM_KEYWORDS = [
  "ceo",
  "founder",
  "owner",
  "managing director",
  "chief",
  "president",
  "partner",
  "director",
] as const

/**
 * Classify a job title as DM (Decision Maker) or OP (Operations).
 *
 * Returns null if jobTitle is null/undefined/empty — caller should
 * decide whether to default to OP, leave null, or trigger a manual
 * review.
 */
export function classifyPersona(
  jobTitle?: string | null,
): "DM" | "OP" | null {
  if (!jobTitle || jobTitle.trim() === "") return null
  const lowered = jobTitle.toLowerCase()
  if (DM_KEYWORDS.some((kw) => lowered.includes(kw))) return "DM"
  return "OP"
}

/**
 * Extract the segment (filter description) from a Clay table source name.
 *
 * Convention: `vDC_{group}_Tier {tier}_{scope}_{filter}`
 * Example   : `vDC_G1_Tier 1_Company_Active Business Loss`
 *           → "Active Business Loss"
 *
 * Returns null if the table name doesn't match the expected pattern,
 * or if the segment portion is empty/whitespace-only.
 */
export function extractClayTableSegment(sourceTable: string): string | null {
  const match = sourceTable.match(/_(?:Company|People)_(.+)$/)
  if (!match) return null
  const segment = match[1].trim()
  return segment.length > 0 ? segment : null
}

// ──────────────────────────────────────────────────────────────────────
// Source-table parser (used by CSV import wizard auto-detection)
// ──────────────────────────────────────────────────────────────────────

const VALID_GROUPS = ["G1", "G2", "G3", "G4", "G5", "G6"] as const
const VALID_TIERS = ["T1", "T2", "T3"] as const

type Group = (typeof VALID_GROUPS)[number]
type Tier = (typeof VALID_TIERS)[number]

export interface ParsedClayTableName {
  scope: "company" | "people" | null
  group: Group | null
  painTier: Tier | null
  segment: string | null
}

/**
 * Parse a Clay source-table name into its constituent parts.
 *
 * Convention: `vDC_{group}_Tier {tierNum}_{scope}_{segment}`
 *   group   = G1..G6
 *   tierNum = 1..3 → T1..T3
 *   scope   = "Company" | "People"
 *   segment = free-text filter description
 *
 * Returns nullable fields independently — caller decides if a partial
 * parse is acceptable (e.g. "Custom (manual entry)" UI mode where user
 * provides scope/group/tier separately).
 */
export function parseClayTableName(sourceTable: string): ParsedClayTableName {
  const result: ParsedClayTableName = {
    scope: null,
    group: null,
    painTier: null,
    segment: null,
  }

  // Group : `_{Gx}_`
  const groupMatch = sourceTable.match(/_([Gg]\d[AaBb]?)_/)
  if (groupMatch) {
    const candidate = groupMatch[1].toUpperCase() as Group
    if ((VALID_GROUPS as readonly string[]).includes(candidate)) {
      result.group = candidate
    }
  }

  // Tier : `Tier {n}` → Tn
  const tierMatch = sourceTable.match(/Tier\s+([1-3])/i)
  if (tierMatch) {
    const candidate = `T${tierMatch[1]}` as Tier
    if ((VALID_TIERS as readonly string[]).includes(candidate)) {
      result.painTier = candidate
    }
  }

  // Scope : `_{Company|People}_`
  const scopeMatch = sourceTable.match(/_(Company|People)_/i)
  if (scopeMatch) {
    result.scope =
      scopeMatch[1].toLowerCase() === "company" ? "company" : "people"
  }

  // Segment : reuse extractClayTableSegment for consistency
  result.segment = extractClayTableSegment(sourceTable)

  return result
}

// ──────────────────────────────────────────────────────────────────────
// Country extraction from Apollo-style location strings
// (Sprint S0 batch 4 hotfix v3 — Apollo CSV exports "City, Country" as
// a single Location column. This helper parses the trailing country
// segment so /api/webhooks/clay-enrichment + /api/crm/contacts/import-clay
// can populate Company/Contact `country` even when the raw Clay payload
// only exposes `location`.)
// ──────────────────────────────────────────────────────────────────────

/**
 * Whitelist of countries that PRD-001 cares about (in-scope geographies +
 * adjacent jurisdictions where Oxen prospects are likely to be located).
 *
 * Anything outside the whitelist returns null — better to leave the
 * country empty than autofill an unverified value (would taint scoring
 * and downstream geo-routing rules).
 *
 * Aliases collapse to a canonical name:
 *   UAE → United Arab Emirates
 *   UK  → United Kingdom
 *   USA → United States
 */
const KNOWN_COUNTRIES = [
  "United Arab Emirates",
  "UAE",
  "Cyprus",
  "Malta",
  "Switzerland",
  "Luxembourg",
  "France",
  "United Kingdom",
  "UK",
  "Germany",
  "Italy",
  "Spain",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Singapore",
  "Hong Kong",
  "USA",
  "United States",
  "United States of America",
  "Canada",
] as const

/**
 * Extract a country from an Apollo-style location string.
 *
 * Examples:
 *   "Dubai, United Arab Emirates"   → "United Arab Emirates"
 *   "Larnaca, Cyprus"               → "Cyprus"
 *   "Sliema, Malta"                 → "Malta"
 *   "London"                        → null (no comma)
 *   "City, Region, Country"         → "Country" (last segment)
 *   "Dubai, UAE"                    → "United Arab Emirates" (normalized)
 *   "London, UK"                    → "United Kingdom" (normalized)
 *   "Some City, Unknown Country"    → null (not in whitelist)
 *   "" / null / undefined           → null
 *
 * Returns null when:
 *   - input is empty / null / undefined / not a string
 *   - location has no comma (single-token, e.g. "London")
 *   - the trailing token is not in the KNOWN_COUNTRIES whitelist
 *
 * The whitelist is conservative on purpose — wrong autofill is worse
 * than missing data because it silently corrupts scoring/geo rules.
 */
export function extractCountryFromLocation(
  location: string | null | undefined,
): string | null {
  if (!location || typeof location !== "string") return null
  const trimmed = location.trim()
  if (!trimmed) return null

  const parts = trimmed
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  if (parts.length < 2) return null

  const lastPart = parts[parts.length - 1]
  const lowered = lastPart.toLowerCase()

  for (const country of KNOWN_COUNTRIES) {
    if (lowered === country.toLowerCase()) {
      // Normalize aliases → canonical names.
      if (country === "UAE") return "United Arab Emirates"
      if (country === "UK") return "United Kingdom"
      if (country === "USA" || country === "United States of America") {
        return "United States"
      }
      return country
    }
  }

  return null
}
