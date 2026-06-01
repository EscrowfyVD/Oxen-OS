// Compute the ICP sub-score (0-50) for one contact account.
//
// 5 factors per Andy doc §2, max points sum to 50:
//   1. Intermediary Type      (15) — group classification
//   2. Company Size           (10) — employees + revenue brackets
//   3. Decision-Maker Access  (10) — title seniority + email present
//   4. Geography              (10) — jurisdiction tier
//   5. Pattern Match           (5) — lookalike past closed_won deals
//
// Reaches into prisma to fetch the contact + company (single query
// with include) — same pattern as compute-intent-score for symmetry.

import { prisma } from "@/lib/prisma"
import { computePatternMatch } from "./pattern-match"
import { parseCompanySizeLabel } from "./parse-company-size"
import type {
  ScoringConfigBlob,
  IntermediaryTypeFactor,
  CompanySizeFactor,
  DecisionMakerAccessFactor,
  GeographyFactor,
} from "./config-types"

const ICP_SCORE_CAP = 50 // matches Andy doc §2

export interface ICPScoreResult {
  score: number
  breakdown: {
    intermediaryType: { points: number; tier: string }
    companySize: { points: number; bracket: string }
    decisionMakerAccess: { points: number; level: string }
    geography: { points: number; tier: string }
    patternMatch: { points: number; match: string }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Factor 1 — Intermediary Type
// ─────────────────────────────────────────────────────────────────────
//
// Andy's primary tier = "in CrmGroup whitelist". Under the active v2
// config the whitelist is G1-G6 — the full enum after closeout #4 dropped
// G7A/G7B — so any non-null group hits primary. secondary/peripheral are
// placeholders for future groups beyond the canonical set.

function computeIntermediaryType(
  group: string | null,
  factor: IntermediaryTypeFactor,
): { points: number; tier: string } {
  if (group === null) {
    return { points: factor.tiers.peripheral.points, tier: "peripheral" }
  }
  if (factor.tiers.primary.groups.includes(group)) {
    return { points: factor.tiers.primary.points, tier: "primary" }
  }
  return { points: factor.tiers.secondary.points, tier: "secondary" }
}

// ─────────────────────────────────────────────────────────────────────
// Factor 2 — Company Size
// ─────────────────────────────────────────────────────────────────────
//
// Primary signal = employeeCount (a numeric column). Clay never
// populated it for the current pool, so two fallbacks kick in, in order:
//   1. the `companySize` string label ("11-50 employees" → 30 via
//      parseCompanySizeLabel) run through the SAME bracket matcher, then
//   2. revenueRange ("1M-5M" → a USD min) as the soft fallback.
// When none of employeeCount / label / revenue yields a match, an account
// that HAS a company row still lands in the edge bucket (never 0) — only a
// missing company row or a real-but-out-of-range employeeCount reports 0.
// The bracket bounds live in config; the parser only produces a number
// (Finding 2).

const REVENUE_MIN_USD: Record<string, number> = {
  "<100K": 0,
  "100K-500K": 100_000,
  "500K-1M": 500_000,
  "1M-5M": 1_000_000,
  "5M-20M": 5_000_000,
  "20M+": 20_000_000,
}

function parseRevenueMin(range: string | null | undefined): number | null {
  if (!range) return null
  return REVENUE_MIN_USD[range] ?? null
}

function matchBracket(
  employees: number | null,
  revenueMin: number | null,
  bracket: CompanySizeFactor["brackets"]["ideal"],
): boolean {
  // Match on employees if available — bracket gates are inclusive on
  // employeesMin, exclusive on employeesMax (null = no cap).
  if (employees !== null) {
    const minOk = employees >= bracket.employeesMin
    const maxOk = bracket.employeesMax === null || employees < bracket.employeesMax
    if (minOk && maxOk) return true
    return false
  }
  // Employees missing — try revenue as the soft fallback. We treat a
  // bracket as matched when the contact's revenueMin ≥ bracket's
  // revenueMin (i.e. revenue "at least as much as required").
  if (revenueMin !== null) {
    return revenueMin >= bracket.revenueMin
  }
  return false
}

function computeCompanySize(
  company: {
    employeeCount: number | null
    revenueRange: string | null
    companySize?: string | null
  } | null,
  factor: CompanySizeFactor,
): { points: number; bracket: string } {
  if (!company) {
    return { points: 0, bracket: "unknown" }
  }

  // Primary: the numeric employeeCount. When it's absent (the entire
  // current prospect pool — Clay populated only the string label), derive
  // a representative count from the `companySize` label and run the SAME
  // matcher. The parser yields just a number; the bounds stay in config.
  const hasEmployeeCount =
    company.employeeCount !== null && company.employeeCount !== undefined
  const employees = hasEmployeeCount
    ? company.employeeCount
    : parseCompanySizeLabel(company.companySize)
  const revenueMin = parseRevenueMin(company.revenueRange)

  // Order matters: check ideal first (highest tier wins ties).
  if (matchBracket(employees, revenueMin, factor.brackets.ideal)) {
    return { points: factor.brackets.ideal.points, bracket: "ideal" }
  }
  if (matchBracket(employees, revenueMin, factor.brackets.viable)) {
    return { points: factor.brackets.viable.points, bracket: "viable" }
  }
  if (matchBracket(employees, revenueMin, factor.brackets.edgeCases)) {
    return { points: factor.brackets.edgeCases.points, bracket: "edgeCases" }
  }

  // Nothing matched. With a real employeeCount present, preserve the
  // historical "unknown → 0" behavior (e.g. a 0-employee row). But on the
  // label-derivation path an empty / unknown / unparsable label must never
  // score 0 — fall back to the edge bucket (Finding 2 robustness rule).
  if (!hasEmployeeCount) {
    return { points: factor.brackets.edgeCases.points, bracket: "edgeCases" }
  }
  return { points: 0, bracket: "unknown" }
}

// ─────────────────────────────────────────────────────────────────────
// Factor 3 — Decision-Maker Access
// ─────────────────────────────────────────────────────────────────────
//
// Heuristic on jobTitle + email presence (PRD V1 doesn't ship a
// proper email-verification field — `contact.email` non-empty is the
// proxy). Sprint 3c can swap in a real `emailVerified` boolean if
// the import pipeline starts capturing one.

// Acronyms + their expanded long forms paired together — Clay /
// LinkedIn / Apollo all emit either variant depending on the source
// row, and we want both to score identically. Discovered via Sprint
// 3b sample compute (Tony Zero21 carried "Chief Executive Officer"
// which the acronym-only regex missed entirely).
const DIRECT_DM_PATTERNS = [
  /\bCEO\b/i,
  /\bChief Executive Officer\b/i,
  /\bCFO\b/i,
  /\bChief Financial Officer\b/i,
  /\bCOO\b/i,
  /\bChief Operating Officer\b/i,
  /\bCTO\b/i,
  /\bChief Technology Officer\b/i,
  /\bChairman\b/i,
  /\bPresident\b/i,
  /\bFounder\b/i,
  /\bCo-?Founder\b/i,
  /\bOwner\b/i,
  /\bManaging Director\b/i,
  /\bManaging Partner\b/i,
]

const PARTIAL_DM_PATTERNS = [
  /\bDirector\b/i,
  /\bHead of\b/i,
  /\bVP\b/i,
  /\bVice President\b/i,
  /\bManager\b/i,
  /\bPartner\b/i,
  /\bLead\b/i,
]

function matchesAny(title: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(title))
}

function computeDecisionMakerAccess(
  contact: { email: string | null; jobTitle: string | null },
  factor: DecisionMakerAccessFactor,
): { points: number; level: string } {
  const hasEmail = !!contact.email && contact.email.trim().length > 0
  if (!hasEmail) {
    // No email → can't reach the DM regardless of title.
    return { points: factor.none, level: "none" }
  }
  if (!contact.jobTitle) {
    // Email present but no title — best we can say is "partial access"
    // (we can email someone, but don't know their role).
    return { points: factor.partial, level: "partial" }
  }
  if (matchesAny(contact.jobTitle, DIRECT_DM_PATTERNS)) {
    return { points: factor.direct, level: "direct" }
  }
  if (matchesAny(contact.jobTitle, PARTIAL_DM_PATTERNS)) {
    return { points: factor.partial, level: "partial" }
  }
  return { points: factor.none, level: "none" }
}

// ─────────────────────────────────────────────────────────────────────
// Factor 4 — Geography
// ─────────────────────────────────────────────────────────────────────

function computeGeography(
  country: string | null | undefined,
  factor: GeographyFactor,
): { points: number; tier: string } {
  if (!country) {
    return { points: factor.outOfScope.points, tier: "outOfScope" }
  }
  if (factor.primary.jurisdictions.includes(country)) {
    return { points: factor.primary.points, tier: "primary" }
  }
  if (factor.secondary.jurisdictions.includes(country)) {
    return { points: factor.secondary.points, tier: "secondary" }
  }
  return { points: factor.outOfScope.points, tier: "outOfScope" }
}

// ─────────────────────────────────────────────────────────────────────
// Top-level compute
// ─────────────────────────────────────────────────────────────────────

export async function computeICPScore(
  accountId: string,
  config: ScoringConfigBlob,
): Promise<ICPScoreResult> {
  const contact = await prisma.crmContact.findUnique({
    where: { id: accountId },
    select: {
      group: true,
      email: true,
      jobTitle: true,
      company: {
        select: {
          employeeCount: true,
          revenueRange: true,
          country: true,
          companySize: true,
        },
      },
    },
  })

  if (!contact) {
    throw new Error(`computeICPScore: contact ${accountId} not found`)
  }

  const intermediary = computeIntermediaryType(contact.group, config.icpFactors.intermediaryType)
  const size = computeCompanySize(contact.company, config.icpFactors.companySize)
  const dm = computeDecisionMakerAccess(
    { email: contact.email, jobTitle: contact.jobTitle },
    config.icpFactors.decisionMakerAccess,
  )
  const geo = computeGeography(contact.company?.country, config.icpFactors.geography)
  const pattern = await computePatternMatch(
    {
      group: contact.group,
      companySize: contact.company?.companySize ?? null,
      jurisdiction: contact.company?.country ?? null,
    },
    config,
  )

  const total = intermediary.points + size.points + dm.points + geo.points + pattern.points

  return {
    score: Math.min(total, ICP_SCORE_CAP),
    breakdown: {
      intermediaryType: intermediary,
      companySize: { points: size.points, bracket: size.bracket },
      decisionMakerAccess: { points: dm.points, level: dm.level },
      geography: { points: geo.points, tier: geo.tier },
      patternMatch: { points: pattern.points, match: pattern.match },
    },
  }
}
