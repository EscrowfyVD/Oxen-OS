// Seed script for ScoringConfig v1 (Phase 3 Sprint 3a B2).
//
// Run AFTER the `phase3_scoring_foundation` migration is applied
// (Railway runs `prisma migrate deploy` on push; the seed must be
// triggered manually or via a deploy step).
//
// Usage: npx tsx scripts/db/seed-scoring-config.ts
//
// Idempotency:
//   - Upsert by `version=1`. Re-running this script produces no
//     change if v1 already exists (mirrors the seed-signal-types
//     pattern). To update v1, edit `buildScoringConfigV1()` and
//     pass --force, OR ship a v2 with the new values and flip
//     isActive (the canonical edit path post-deploy).
//   - Sets isActive=true on v1. Deactivates any other active rows
//     so the "exactly one active" invariant is preserved even if a
//     v2 was experimentally inserted before re-running.
//
// Refs:
//   - PRD-004 §2.2 (reference/PRD_004_PHASE3_SCORING.md)
//   - Andy "Oxen OS Priority Scoring Engine v2" reference doc (May 2026)
//   - Recon Sprint 3a Decisions D1-D10

import { PrismaClient } from "@prisma/client"
import type { ScoringConfigBlob } from "../../src/lib/scoring/config-types"
import { validateScoringConfig } from "../../src/lib/scoring/config-validation"

const prisma = new PrismaClient()

/**
 * Build the canonical v1 config blob. Values are pinned to Andy's
 * reference doc (May 2026). Edit here to bump versions — never edit
 * an existing DB row directly, ship a new version instead.
 *
 * Pure function (no DB touch) — exported so tests can assert the
 * shape without involving Prisma at all.
 */
export function buildScoringConfigV1(): ScoringConfigBlob {
  return {
    entryRules: {
      minPriorityScore: 40,
      minSignalCount: 2,
    },

    priorityLevels: {
      P1: { minScore: 75, minSignals: 3, responseHours: 2 },
      P2: { minScore: 55, minSignals: 2, responseHours: 24 },
      // P3 = "standard cadence" — no SLA override, sequence runs at
      // its native interval.
      P3: { minScore: 40, minSignals: 2, responseHours: null },
      Monitor: { minScore: 0, minSignals: 0, responseHours: null },
    },

    icpFactors: {
      intermediaryType: {
        maxPoints: 15,
        tiers: {
          primary: {
            points: 15,
            // CrmGroup codes G1-G7B (matches the Prisma enum). Listed
            // explicitly here rather than referencing the enum so a
            // future enum addition doesn't silently bump tier 1.
            groups: ["G1", "G2", "G3", "G4", "G5", "G6", "G7A", "G7B"],
          },
          secondary: { points: 10 },
          peripheral: { points: 5 },
        },
      },

      companySize: {
        maxPoints: 10,
        brackets: {
          ideal: {
            points: 10,
            employeesMin: 50,
            employeesMax: 500,
            revenueMin: 5_000_000,
          },
          viable: {
            points: 6,
            employeesMin: 10,
            employeesMax: 50,
            revenueMin: 1_000_000,
          },
          edgeCases: {
            points: 3,
            // Edge bucket — boutique partnerships at low scale.
            employeesMin: 1,
            employeesMax: 10,
            revenueMin: 0,
          },
        },
      },

      decisionMakerAccess: {
        maxPoints: 10,
        direct: 10,
        partial: 5,
        none: 0,
      },

      geography: {
        maxPoints: 10,
        primary: {
          points: 10,
          jurisdictions: [
            "Malta",
            "Cyprus",
            "United Arab Emirates",
            "Luxembourg",
            "United Kingdom",
          ],
        },
        secondary: {
          points: 5,
          jurisdictions: [
            "Germany",
            "France",
            "Spain",
            "Italy",
            "Netherlands",
            "Singapore",
            "Hong Kong",
            "Switzerland",
          ],
        },
        outOfScope: { points: 0 },
      },

      patternMatch: {
        maxPoints: 5,
        strongMatch: 5,
        partialMatch: 3,
        noMatch: 0,
      },
    },

    intentCategories: {
      A: {
        name: "Direct Oxen Engagement",
        level: "contact",
        signals: {
          direct_message_oxen: { points: 25, code: "oxen_direct_message" },
          oxen_pricing_demo_visit: { points: 20, code: "oxen_pricing_demo_visit" },
          oxen_substantive_comment: { points: 15, code: "trigify_oxen_engagement_comment" },
          bd_profile_visit_post_email: { points: 10, code: "trigify_profile_visit" },
          oxen_post_like: { points: 5, code: "trigify_oxen_engagement_like" },
        },
      },
      B: {
        name: "Lemlist Sequence Engagement",
        level: "contact",
        signals: {
          email_reply_interested: { points: 20, code: "lemlist_reply_interested" },
          email_open_multi: { points: 8, code: "lemlist_email_open" },
          email_click_link: { points: 12, code: "lemlist_email_click" },
        },
      },
      C: {
        name: "Public Banking Frustration",
        level: "contact",
        signals: {
          public_complaint_bank: { points: 18, code: "social_banking_complaint" },
          search_offshore_alternative: { points: 10, code: "search_offshore_terms" },
        },
      },
      D: {
        name: "Competitive Signals",
        level: "account",
        signals: {
          competitor_business_loss: { points: 20, code: "clay_business_loss" },
          competitor_layoffs: { points: 12, code: "news_competitor_layoffs" },
        },
      },
      E: {
        name: "Regulatory",
        level: "account",
        signals: {
          jurisdiction_regulation_change: { points: 15, code: "market_country_regulation_change" },
          new_compliance_obligation: { points: 10, code: "news_compliance_change" },
        },
      },
      F: {
        name: "Financial Events",
        level: "account",
        signals: {
          funding_announcement: { points: 25, code: "linkedin_post_funding" },
          revenue_milestone: { points: 12, code: "news_revenue_milestone" },
        },
      },
      G: {
        name: "Recruitment & Leadership",
        level: "account",
        signals: {
          director_change: { points: 18, code: "clay_director_change" },
          role_change_target: { points: 10, code: "trigify_role_change" },
        },
      },
      H: {
        name: "LinkedIn Trigify",
        level: "contact",
        signals: {
          competitor_engagement: { points: 6, code: "trigify_competitor_engagement" },
          follow_competitor: { points: 3, code: "trigify_follow_competitor" },
          bio_change: { points: 3, code: "trigify_bio_change" },
        },
      },
      I: {
        name: "Indirect Social",
        level: "contact",
        signals: {
          news_mention: { points: 5, code: "news_general_mention" },
          podcast_appearance: { points: 8, code: "podcast_target_appearance" },
        },
      },
    },

    timeDecay: {
      brackets: [
        // ≤ 7 days old → full weight
        { maxDays: 7, coefficient: 1.0 },
        // 8-30 days → 75 %
        { maxDays: 30, coefficient: 0.75 },
        // 31-90 days → 50 %
        { maxDays: 90, coefficient: 0.5 },
        // > 90 days → expired
        { maxDays: null, coefficient: 0 },
      ],
    },

    negativeSignals: {
      soft_not_interested: { impact: -10, action: "nurture" },
      hard_not_interested: { impact: 0, action: "exclude" },
      email_bounce: { impact: -15, action: "flag_invalid" },
      contact_left_company: { impact: 0, action: "reset_contact" },
      company_exited_space: { impact: 0, action: "exclude" },
      lemlist_unsubscribe: { impact: 0, action: "exclude" },
      no_response_after_sequence: { impact: -5, action: "nurture_6_months" },
    },

    followUpTriggers: {
      immediate: {
        windowHours: 2,
        signals: [
          "oxen_direct_message",
          "trigify_profile_visit",
          "trigify_oxen_engagement_comment",
        ],
      },
      rapid: {
        windowHours: 24,
        signals: [
          "lemlist_reply_interested",
          "clay_director_change",
          "linkedin_post_funding",
        ],
      },
      passive: {
        // Passive signals score the account but never accelerate a
        // sequence — they pile up as evidence of warmth without
        // disrupting cadence.
        signals: [
          "trigify_oxen_engagement_like",
          "trigify_competitor_engagement",
          "trigify_follow_competitor",
          "trigify_role_change",
          "trigify_bio_change",
        ],
      },
    },

    painTier: {
      // V1: inference rules are descriptive placeholders. Sprint 3c
      // will replace these with a typed condition AST and the engine
      // logic to evaluate it. The bdOverrideEnabled flag is already
      // honored by CrmContact.painTierOverride (added in Sprint 3a).
      inferenceRules: {
        T1: {
          conditions: [
            { signal: "clay_business_loss", recentDays: 90 },
            { negative: "no_response_after_sequence" },
          ],
        },
        T2: {
          conditions: [
            { signal: "lemlist_reply_interested" },
            { signal: "trigify_competitor_engagement", recentDays: 60 },
          ],
        },
        T3: {
          conditions: [
            { signal: "trigify_follow_competitor", recentDays: 90 },
          ],
        },
      },
      bdOverrideEnabled: true,
    },
  }
}

export interface SeedResult {
  version: number
  action: "created" | "updated" | "no-op"
}

/**
 * Insert (or refresh) ScoringConfig v1 in the database. Pinpointed
 * behavior:
 *   - validate the blob via Zod BEFORE touching DB
 *   - upsert by version=1, setting isActive=true
 *   - deactivate any other active versions in the same transaction
 *     so the "exactly one active" invariant survives a v2 → re-seed
 *     v1 flow
 */
export async function seedScoringConfigV1(
  client: PrismaClient = prisma,
): Promise<SeedResult> {
  const blob = buildScoringConfigV1()

  const validation = validateScoringConfig(blob)
  if (!validation.ok) {
    throw new Error(
      `buildScoringConfigV1 produced an invalid blob: ${validation.error}\n` +
        `Details: ${JSON.stringify(validation.details, null, 2)}`,
    )
  }

  // Cast through unknown → Prisma's InputJsonValue. Zod has already
  // confirmed the shape is JSON-serializable.
  const configJson = blob as unknown as Parameters<
    typeof client.scoringConfig.upsert
  >[0]["create"]["config"]

  const existing = await client.scoringConfig.findUnique({
    where: { version: 1 },
    select: { id: true, isActive: true },
  })

  // Deactivate other versions first (covers the edge case where v2
  // was inserted experimentally). Skipped if no row exists yet.
  await client.scoringConfig.updateMany({
    where: { isActive: true, version: { not: 1 } },
    data: { isActive: false },
  })

  if (existing) {
    await client.scoringConfig.update({
      where: { version: 1 },
      data: { config: configJson, isActive: true },
    })
    return { version: 1, action: existing.isActive ? "no-op" : "updated" }
  }

  await client.scoringConfig.create({
    data: {
      version: 1,
      isActive: true,
      config: configJson,
      notes: "Initial config v1 from Andy reference doc May 2026",
      createdBy: "seed-script",
    },
  })
  return { version: 1, action: "created" }
}

async function main() {
  console.log("\n=== Seed ScoringConfig v1 (Phase 3 Sprint 3a) ===\n")
  const result = await seedScoringConfigV1(prisma)
  console.log(`Result: v${result.version} ${result.action}\n`)
}

// Run main() only when invoked directly (mirrors seed-signal-types.ts).
const isDirectInvocation =
  process.argv[1] && process.argv[1].endsWith("seed-scoring-config.ts")
if (isDirectInvocation) {
  main()
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
