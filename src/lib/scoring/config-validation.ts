// Zod schema for the Phase 3 ScoringConfig JSONB blob.
//
// Mirrors `config-types.ts` 1:1 at runtime. Used by:
//   - seed-scoring-config.ts before INSERT (catch typos in Andy doc transcription)
//   - config-loader.ts after SELECT (catch DB-edited rows that drifted)
//   - future admin UI POST handler (V2)
//
// `.strict()` rejects unknown keys at every level: if Andy ships a new
// factor in v2 of the spec, we want the validation to fail loudly
// until the schema is updated — silent passthrough hides drift.

import { z } from "zod"
import type { ScoringConfigBlob } from "./config-types"

// ─── Helpers ─────────────────────────────────────────────────────────

const points = z.number().int().min(0).max(100)
const pointsFloat = z.number().min(0).max(100)

const priorityLevelThresholds = z
  .object({
    minScore: points,
    minSignals: z.number().int().min(0),
    responseHours: z.number().int().min(1).nullable(),
  })
  .strict()

// ─── §2.2.3 ICP factors ──────────────────────────────────────────────

const intermediaryTypeFactor = z
  .object({
    maxPoints: pointsFloat,
    tiers: z
      .object({
        primary: z
          .object({
            points: pointsFloat,
            groups: z.array(z.string().min(1)).min(1),
          })
          .strict(),
        secondary: z.object({ points: pointsFloat }).strict(),
        peripheral: z.object({ points: pointsFloat }).strict(),
      })
      .strict(),
  })
  .strict()

const companySizeBracket = z
  .object({
    points: pointsFloat,
    employeesMin: z.number().int().min(0),
    employeesMax: z.number().int().nullable(),
    revenueMin: z.number().min(0),
  })
  .strict()

const companySizeFactor = z
  .object({
    maxPoints: pointsFloat,
    brackets: z
      .object({
        ideal: companySizeBracket,
        viable: companySizeBracket,
        edgeCases: companySizeBracket,
      })
      .strict(),
  })
  .strict()

const decisionMakerAccessFactor = z
  .object({
    maxPoints: pointsFloat,
    direct: pointsFloat,
    partial: pointsFloat,
    none: pointsFloat,
  })
  .strict()

const geographyTier = z
  .object({
    points: pointsFloat,
    jurisdictions: z.array(z.string().min(1)).min(1),
  })
  .strict()

const geographyFactor = z
  .object({
    maxPoints: pointsFloat,
    primary: geographyTier,
    secondary: geographyTier,
    outOfScope: z.object({ points: pointsFloat }).strict(),
  })
  .strict()

const patternMatchFactor = z
  .object({
    maxPoints: pointsFloat,
    strongMatch: pointsFloat,
    partialMatch: pointsFloat,
    noMatch: pointsFloat,
  })
  .strict()

const icpFactors = z
  .object({
    intermediaryType: intermediaryTypeFactor,
    companySize: companySizeFactor,
    decisionMakerAccess: decisionMakerAccessFactor,
    geography: geographyFactor,
    patternMatch: patternMatchFactor,
  })
  .strict()

// ─── §2.2.4 Intent categories ────────────────────────────────────────

const intentSignalDefinition = z
  .object({
    points: pointsFloat,
    code: z.string().min(1).max(100),
  })
  .strict()

const intentCategoryConfig = z
  .object({
    name: z.string().min(1),
    level: z.enum(["contact", "account"]),
    signals: z.record(z.string().min(1), intentSignalDefinition),
  })
  .strict()

// Intent categories keyed by A-I (no enum here — Andy may add Cat J,
// K, etc. without a schema change). Keys are short uppercase letters.
const intentCategoriesConfig = z
  .record(z.string().regex(/^[A-Z]$/), intentCategoryConfig)

// ─── §2.2.5 Time decay ───────────────────────────────────────────────

const decayBracket = z
  .object({
    maxDays: z.number().int().min(1).nullable(),
    coefficient: z.number().min(0).max(1),
  })
  .strict()

const timeDecayConfig = z
  .object({
    brackets: z.array(decayBracket).min(1),
  })
  .strict()

// ─── §2.2.6 Negative signals ─────────────────────────────────────────

const negativeSignalImpact = z
  .object({
    impact: z.number().int().min(-100).max(0),
    action: z.enum([
      "nurture",
      "exclude",
      "flag_invalid",
      "reset_contact",
      "nurture_6_months",
    ]),
  })
  .strict()

const negativeSignalsConfig = z.record(
  z.string().min(1),
  negativeSignalImpact,
)

// ─── §2.2.7 Follow-up triggers ───────────────────────────────────────

const triggerWindowConfig = z
  .object({
    windowHours: z.number().int().min(1).max(168), // 1h to 1 week
    signals: z.array(z.string().min(1)),
  })
  .strict()

const passiveTriggerConfig = z
  .object({
    signals: z.array(z.string().min(1)),
  })
  .strict()

const followUpTriggersConfig = z
  .object({
    immediate: triggerWindowConfig,
    rapid: triggerWindowConfig,
    passive: passiveTriggerConfig,
  })
  .strict()

// ─── §2.2.8 Pain tier ────────────────────────────────────────────────

// V1: conditions are descriptive blobs (Record<string, unknown>);
// Sprint 3c will introduce a typed condition AST. For now, validate
// only the wrapper shape — the engine reads conditions as opaque
// rules and applies them via hand-written logic.
const painTierConditions = z.array(z.record(z.string(), z.unknown()))

const painTierConfig = z
  .object({
    inferenceRules: z
      .object({
        T1: z.object({ conditions: painTierConditions }).strict(),
        T2: z.object({ conditions: painTierConditions }).strict(),
        T3: z.object({ conditions: painTierConditions }).strict(),
      })
      .strict(),
    bdOverrideEnabled: z.boolean(),
  })
  .strict()

// ─── Enrichment sweep (Apify PR3c-b) ─────────────────────────────────
// `.strict()` INTERNALLY (a mistyped sub-key by Andy fails loudly). The
// top-level field is `.optional()` (below): a pre-v3 active row has no
// `enrichment` key and MUST still validate, else the loader would throw
// and break ALL scoring during the deploy→seed window.

const enrichmentTitles = z
  .object({
    decisionMaker: z.array(z.string().min(1)).min(1),
    operational: z.array(z.string().min(1)).min(1),
  })
  .strict()

const enrichmentConfig = z
  .object({
    gate1Threshold: z.number().min(0),
    gate1MinSignals: z.number().int().min(0),
    baseEnrichmentCap: z.number().int().min(0),
    phoneRevealCap: z.number().int().min(0),
    titles: enrichmentTitles,
    // Optional delivery gate (slice 4): absent → reads TRUE (no-spend) at
    // runtime. Strict-validated when present; unknown keys still fail loudly.
    dryRun: z.boolean().optional(),
  })
  .strict()

// ─── Top-level ───────────────────────────────────────────────────────

export const scoringConfigSchema = z
  .object({
    entryRules: z
      .object({
        minPriorityScore: points,
        minSignalCount: z.number().int().min(0),
      })
      .strict(),
    priorityLevels: z
      .object({
        P1: priorityLevelThresholds,
        P2: priorityLevelThresholds,
        P3: priorityLevelThresholds,
        Monitor: z
          .object({
            minScore: z.literal(0),
            minSignals: z.literal(0),
            responseHours: z.null(),
          })
          .strict(),
      })
      .strict(),
    icpFactors,
    intentCategories: intentCategoriesConfig,
    timeDecay: timeDecayConfig,
    negativeSignals: negativeSignalsConfig,
    followUpTriggers: followUpTriggersConfig,
    painTier: painTierConfig,
    // OPTIONAL — see the enrichment section above. Absent on pre-v3 rows;
    // strict-validated when present.
    enrichment: enrichmentConfig.optional(),
  })
  .strict()

// `details` is the structured Zod error payload (return of
// `error.flatten()`). Typed via ReturnType to avoid pinning a specific
// Zod class — the v3 → v4 type names diverged (ZodFlattenedError vs
// typeToFlattenedError) and we don't care about the inner shape at
// the call site (debug-only, surfaced in logs).
type ZodFlattenedShape = ReturnType<z.ZodError["flatten"]>

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details: ZodFlattenedShape }

/**
 * Validate an arbitrary JSON value against the ScoringConfigBlob shape.
 *
 * Designed to be called at trust boundaries (DB read, admin POST,
 * seed insert). Returns a discriminated result so callers can decide
 * whether to throw, log, or surface the error to a user.
 */
export function validateScoringConfig(
  json: unknown,
): ValidationResult<ScoringConfigBlob> {
  const parsed = scoringConfigSchema.safeParse(json)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid ScoringConfig blob",
      details: parsed.error.flatten(),
    }
  }
  // Zod's inferred type doesn't 100% match our hand-written interface
  // (because of `z.record(...)` losing the exact key set). The cast is
  // safe because the schema is the single source of truth at runtime
  // and the type interface is the single source of truth at compile
  // time — they are intentionally kept in sync by convention.
  return { ok: true, data: parsed.data as ScoringConfigBlob }
}
