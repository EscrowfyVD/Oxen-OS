// TypeScript interfaces for the Phase 3 ScoringConfig JSONB blob.
//
// Mirrors the Zod schema in `config-validation.ts` 1:1 — when you edit
// one, edit the other. Kept as a separate file so consumers (compute
// engine in Sprint 3b, future admin UI in V2) can import the types
// without paying the Zod runtime cost.
//
// Refs:
//   - PRD-004 §2.2 (reference/PRD_004_PHASE3_SCORING.md)
//   - Andy "Oxen OS Priority Scoring Engine v2" reference doc (May 2026)

// ─── §2.2.1 Entry rules ──────────────────────────────────────────────

export interface EntryRules {
  /** Minimum combined priorityScore (ICP+Intent) to enter a sequence. */
  minPriorityScore: number
  /** Minimum number of non-expired IntentSignals attached. */
  minSignalCount: number
}

// ─── §2.2.2 Priority levels ──────────────────────────────────────────

export interface PriorityLevelThresholds {
  /** Minimum combined priorityScore (0-100). */
  minScore: number
  /** Minimum signalCount on the account. */
  minSignals: number
  /**
   * Response SLA expressed in hours. `null` means "no urgency"
   * (P3 / Monitor — standard sequence cadence).
   */
  responseHours: number | null
}

export interface PriorityLevels {
  P1: PriorityLevelThresholds
  P2: PriorityLevelThresholds
  P3: PriorityLevelThresholds
  /** Default bucket — no thresholds, catches everything else. */
  Monitor: { minScore: 0; minSignals: 0; responseHours: null }
}

// ─── §2.2.3 ICP factors ──────────────────────────────────────────────

export interface IntermediaryTypeTier {
  points: number
  /** CrmGroup codes that hit this tier. */
  groups: string[]
}

export interface IntermediaryTypeFactor {
  maxPoints: number
  tiers: {
    primary: IntermediaryTypeTier
    secondary: { points: number }
    peripheral: { points: number }
  }
}

export interface CompanySizeBracket {
  points: number
  /** Lower bound on employee count (inclusive). */
  employeesMin: number
  /** Upper bound on employee count (exclusive). null = no upper limit. */
  employeesMax: number | null
  /**
   * Lower bound on annual revenue (USD, inclusive). Used as a soft
   * tiebreaker when employees count is in the "viable" range but
   * revenue argues for a different bracket.
   */
  revenueMin: number
}

export interface CompanySizeFactor {
  maxPoints: number
  brackets: {
    ideal: CompanySizeBracket
    viable: CompanySizeBracket
    edgeCases: CompanySizeBracket
  }
}

export interface DecisionMakerAccessFactor {
  maxPoints: number
  /** CEO / CFO / COO / Founder with verified email. */
  direct: number
  /** Department head, ops lead, etc. */
  partial: number
  /** No decision-maker contact identified. */
  none: number
}

export interface GeographyTier {
  points: number
  /**
   * Canonical jurisdiction names (matches CrmContact.country /
   * Company.country values, NOT geoZone enum).
   */
  jurisdictions: string[]
}

export interface GeographyFactor {
  maxPoints: number
  primary: GeographyTier
  secondary: GeographyTier
  outOfScope: { points: number }
}

export interface PatternMatchFactor {
  maxPoints: number
  /** Match on all 3 dimensions: type + size + jurisdiction. */
  strongMatch: number
  /** 2 of 3 dimensions match. */
  partialMatch: number
  /** 0-1 dimension match. */
  noMatch: number
}

export interface ICPFactors {
  intermediaryType: IntermediaryTypeFactor
  companySize: CompanySizeFactor
  decisionMakerAccess: DecisionMakerAccessFactor
  geography: GeographyFactor
  patternMatch: PatternMatchFactor
}

// ─── §2.2.4 Intent categories A-I ────────────────────────────────────

export interface IntentSignalDefinition {
  /** Default points awarded when this signal is ingested. */
  points: number
  /** SignalTypeRegistry.code that backs this signal. */
  code: string
}

export interface IntentCategoryConfig {
  /** Human-readable name (admin UI / explain). */
  name: string
  /** "contact" or "account" — applied to derived signals. */
  level: "contact" | "account"
  /** Signal-name → definition. Keys are arbitrary identifiers. */
  signals: Record<string, IntentSignalDefinition>
}

export type IntentCategoriesConfig = Record<string, IntentCategoryConfig>

// ─── §2.2.5 Time decay ───────────────────────────────────────────────

export interface DecayBracket {
  /**
   * Upper bound in days for this bracket. The final bracket uses
   * `null` to mean "older than the previous bound — fully decayed".
   */
  maxDays: number | null
  /** Multiplier applied to the signal's raw points. 0 = expired. */
  coefficient: number
}

export interface TimeDecayConfig {
  /**
   * Ordered low→high by maxDays. Lookup is "first matching bracket
   * whose maxDays is ≥ ageDays, else last bracket".
   */
  brackets: DecayBracket[]
}

// ─── §2.2.6 Negative signals ─────────────────────────────────────────

export interface NegativeSignalImpact {
  /**
   * Score impact at apply time. 0 = no score change (action-only,
   * e.g. immediate exclude). Negative number = scoreDelta applied
   * to priorityScore.
   */
  impact: number
  /** What the engine should do beyond score adjustment. */
  action:
    | "nurture"
    | "exclude"
    | "flag_invalid"
    | "reset_contact"
    | "nurture_6_months"
}

export type NegativeSignalsConfig = Record<string, NegativeSignalImpact>

// ─── §2.2.7 Follow-up triggers ───────────────────────────────────────

export interface TriggerWindowConfig {
  /** Time window in hours within which the action must execute. */
  windowHours: number
  /** SignalTypeRegistry.code values that activate this window. */
  signals: string[]
}

export interface PassiveTriggerConfig {
  /** Score-only — no sequence adjust. */
  signals: string[]
}

export interface FollowUpTriggersConfig {
  immediate: TriggerWindowConfig
  rapid: TriggerWindowConfig
  passive: PassiveTriggerConfig
}

// ─── §2.2.8 Pain tier inference ──────────────────────────────────────

export interface PainTierInferenceCondition {
  /**
   * One condition entry — kept as `Record<string, unknown>` because
   * the V1 inference rules are descriptive (will be refined in
   * Sprint 3c). Sprint 3c will introduce a typed condition AST.
   */
  [key: string]: unknown
}

export interface PainTierInferenceRules {
  T1: { conditions: PainTierInferenceCondition[] }
  T2: { conditions: PainTierInferenceCondition[] }
  T3: { conditions: PainTierInferenceCondition[] }
}

export interface PainTierConfig {
  inferenceRules: PainTierInferenceRules
  /** When true, BD can override the inferred tier via UI. */
  bdOverrideEnabled: boolean
}

// ─── Enrichment sweep (Apify PR3c-b) ─────────────────────────────────

export interface EnrichmentTitles {
  /** Decision-maker titles (CCO / Head of Compliance / MLRO …) — the
   *  senior contact of the 2-contact multi-thread. */
  decisionMaker: string[]
  /** Operational titles (Compliance Officer / AML Analyst …) — the
   *  hands-on contact of the 2-contact multi-thread. */
  operational: string[]
}

export interface EnrichmentConfig {
  /** Gate-1 spend threshold: enrich when the company intentScore ≥ this.
   *  Also the crossing-log threshold in recompute-company-score. */
  gate1Threshold: number
  /** Gate-1 distinct-signal floor. Seeded + read by the pass-3 sweep
   *  (slice 4); NO consumer in slice 2. */
  gate1MinSignals: number
  /** Monthly enrichment cap (companies/month) — a safety breaker, not a
   *  budget constraint. Seeded, wired in slice 4. */
  baseEnrichmentCap: number
  /** Monthly phone-reveal cap — RESERVED, not wired (phone = a later
   *  slice). Param only. */
  phoneRevealCap: number
  /** Title lists for the 2-contact multi-threading (Apollo people/search). */
  titles: EnrichmentTitles
}

// ─── Top-level blob ──────────────────────────────────────────────────

export interface ScoringConfigBlob {
  entryRules: EntryRules
  priorityLevels: PriorityLevels
  icpFactors: ICPFactors
  intentCategories: IntentCategoriesConfig
  timeDecay: TimeDecayConfig
  negativeSignals: NegativeSignalsConfig
  followUpTriggers: FollowUpTriggersConfig
  painTier: PainTierConfig
  /**
   * Apify PR3c-b enrichment-sweep params. OPTIONAL — pre-v3 configs
   * (e.g. the currently-active v2, and any row seeded before v3) lack
   * this key. Readers MUST fall back to code defaults so the live
   * scoring path never throws on the missing block. Present-and-typo'd
   * still fails Zod (.strict) loudly, same discipline as every other key.
   */
  enrichment?: EnrichmentConfig
}
