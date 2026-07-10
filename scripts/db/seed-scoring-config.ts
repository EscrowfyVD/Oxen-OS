// Seed script for ScoringConfig v1 + v2 (Phase 3 Sprint 3a B2 / Sprint 3d).
//
// Run AFTER the `phase3_scoring_foundation` migration is applied
// (Railway runs `prisma migrate deploy` on push; the seed must be
// triggered manually or via a deploy step).
//
// Usage: npx tsx scripts/db/seed-scoring-config.ts
//   → seeds v1 (preserved, inactive) then v2 (active). v2 is the
//     ScoringConfig v2 reconciliation to Andy's doc (May 2026).
//
// Idempotency:
//   - Upsert by `version`. Re-running this script converges to the same
//     end state — v1 + v2 rows present, v2 active — with no drift
//     (mirrors the seed-signal-types pattern).
//   - The canonical edit path is "ship a new version + flip isActive":
//     edit `buildScoringConfigV2()` (never mutate a live DB row), or add
//     `buildScoringConfigV3()` for the next bump. v1 stays frozen.
//   - Each seed fn deactivates every OTHER version so the "exactly one
//     active" invariant survives any insertion order. main() seeds v1
//     then v2, so the committed end state is always v2-active.
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

/**
 * Build the canonical v2 config blob — the ScoringConfig v2
 * reconciliation to Andy's scoring doc (May 2026, Sprint 3d).
 *
 * v2 is defined as a delta over v1 (`structuredClone` + targeted
 * overrides) so the diff reads as exactly "what changed vs v1" and
 * nothing silently drifts in the ~260 untouched lines. v1 stays frozen
 * and reproducible via `buildScoringConfigV1()`; `seedScoringConfigV2()`
 * preserves the v1 DB row as inactive (audit history, doc §13.3).
 *
 * Deltas (all pinned to Andy's doc):
 *   - icpFactors.intermediaryType — 6-group model: the primary (tier-1)
 *     whitelist becomes G1–G6 only. G7A/G7B are dropped from the
 *     scoring whitelist. The enum *values* are retired in a separate
 *     migration PR; here we only stop tier-1-crediting them. A contact
 *     still carrying G7A/G7B (none in prod today) falls to `secondary`
 *     (non-null group → secondary points) rather than primary.
 *   - icpFactors.companySize — brackets realigned:
 *       ideal  20–500 emp / $2M+    = 10
 *       viable  5–19 emp / $500K–2M =  7  (was 6)
 *       edge   <5 OR >500 emp       =  3
 *     The "<5 OR >500" two-tailed edge can't be one contiguous bracket,
 *     so edgeCases.employeesMax=null makes it the catch-all under
 *     compute-icp-score's first-match-wins: ideal/viable are checked
 *     first, so everything else — both the <5 and the >500 tails —
 *     lands in edge. (In v1, >500-employee accounts matched no bracket
 *     and scored 0; v2 fixes that to 3.)
 *   - followUpTriggers — trigify_role_change AND
 *     trigify_competitor_engagement move passive → rapid (doc §8.3).
 *     trigify_oxen_engagement_comment is already in `immediate` here
 *     (v1); it's the registry/backfill that realigns to match.
 *
 * NOTE — point recalibrations (linkedin_post_funding 30→8,
 * clay_director_change 20→6) do NOT live in this blob. computeIntentScore
 * reads points off the ingested IntentSignal row (stamped from
 * SignalTypeRegistry.defaultPoints at ingest), not config.intentCategories.
 * Those changes live in backfill-signal-types-categories.ts.
 */
export function buildScoringConfigV2(): ScoringConfigBlob {
  const blob = structuredClone(buildScoringConfigV1())

  // 6-group model — drop G7A/G7B from the tier-1 whitelist.
  blob.icpFactors.intermediaryType.tiers.primary.groups = [
    "G1",
    "G2",
    "G3",
    "G4",
    "G5",
    "G6",
  ]

  // companySize brackets realigned to Andy doc (May 2026).
  blob.icpFactors.companySize.brackets.ideal = {
    points: 10,
    employeesMin: 20,
    employeesMax: 500,
    revenueMin: 2_000_000,
  }
  blob.icpFactors.companySize.brackets.viable = {
    points: 7,
    employeesMin: 5,
    employeesMax: 20,
    revenueMin: 500_000,
  }
  blob.icpFactors.companySize.brackets.edgeCases = {
    points: 3,
    employeesMin: 1,
    employeesMax: null, // catch-all tail: <5 (fails ideal/viable) AND >500
    revenueMin: 0,
  }

  // Follow-up trigger reclassifications (doc §8.3): role_change and
  // competitor_engagement graduate passive → rapid. comment is already
  // in `immediate` (v1) — only the registry realigns there.
  blob.followUpTriggers.passive.signals =
    blob.followUpTriggers.passive.signals.filter(
      (code) =>
        code !== "trigify_role_change" &&
        code !== "trigify_competitor_engagement",
    )
  blob.followUpTriggers.rapid.signals.push(
    "trigify_competitor_engagement",
    "trigify_role_change",
  )

  return blob
}

/**
 * Build the canonical v3 config blob — v2 + the Apify PR3c-b `enrichment`
 * block (the enrichment-sweep params, runtime-editable by Andy in ≤60s).
 *
 * v3 = `structuredClone(v2)` + the single additive `enrichment` key, so the
 * diff reads as exactly "v2 plus enrichment" and nothing in the ~260
 * untouched lines drifts. v2 stays frozen + reproducible; seedScoringConfigV3
 * preserves v1 + v2 as inactive rows (audit history).
 *
 * IMPORTANT — byte-identical scoring: gate1Threshold: 10 is the EXACT old
 * `COMPANY_ENRICH_THRESHOLD` const (recompute-company-score, #32). Seeding
 * v3 changes NO scoring behaviour — the company crossing still fires at 10.
 * gate1MinSignals / caps / titles are seeded but have no consumer until the
 * pass-3 sweep (slice 4). Andy edits any of these in the DB row; the ≤60s
 * config-loader TTL picks it up with no redeploy.
 */
export function buildScoringConfigV3(): ScoringConfigBlob {
  const blob = structuredClone(buildScoringConfigV2())

  blob.enrichment = {
    // = the old COMPANY_ENRICH_THRESHOLD const → NOOP on default (byte-identical).
    gate1Threshold: 10,
    gate1MinSignals: 2,
    // Safety breaker, not a budget: recon showed real volume ~4-8/mo → ~40-75x headroom.
    baseEnrichmentCap: 300,
    // RESERVED — phone is a later slice; param only, not wired.
    phoneRevealCap: 100,
    // DELIVERY GATE — seeded TRUE so slice-4 ships NO-SPEND. The pass-3 sweep
    // runs the gate/cap/ordering and LOGS what it would do, but makes zero
    // Apollo calls and zero writes. Going live = a DELIBERATE, SEPARATE edit:
    // set enrichment.dryRun=false on the active ScoringConfig (re-seed with this
    // flipped, or edit the DB row) AFTER reading a dry-run report on real
    // captures. The ≤60s config-loader TTL picks it up with no redeploy.
    dryRun: true,
    // Compliance/finance-hiring oriented (the apify_g Job Board signal). Andy
    // tunes per-vertical later; editable without redeploy.
    titles: {
      decisionMaker: [
        "Chief Compliance Officer",
        "Head of Compliance",
        "MLRO",
        "Money Laundering Reporting Officer",
        "Chief Risk Officer",
        "General Counsel",
        "Head of Legal",
        "Chief Financial Officer",
        "Head of Finance",
      ],
      operational: [
        "Compliance Officer",
        "Compliance Manager",
        "AML Officer",
        "AML Analyst",
        "KYC Analyst",
        "Compliance Analyst",
        "Risk Analyst",
      ],
    },
  }

  return blob
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

/**
 * Insert (or refresh) ScoringConfig v2 and make it the active config.
 * Mirrors seedScoringConfigV1's invariant handling:
 *   - validate the blob via Zod BEFORE touching DB
 *   - deactivate every other version (incl. v1) so "exactly one active"
 *     holds with v2 as the active config
 *   - upsert v2 with isActive=true
 * v1 is preserved as an inactive row (audit history, doc §13.3) — never
 * deleted.
 */
export async function seedScoringConfigV2(
  client: PrismaClient = prisma,
): Promise<SeedResult> {
  const blob = buildScoringConfigV2()

  const validation = validateScoringConfig(blob)
  if (!validation.ok) {
    throw new Error(
      `buildScoringConfigV2 produced an invalid blob: ${validation.error}\n` +
        `Details: ${JSON.stringify(validation.details, null, 2)}`,
    )
  }

  const configJson = blob as unknown as Parameters<
    typeof client.scoringConfig.upsert
  >[0]["create"]["config"]

  const existing = await client.scoringConfig.findUnique({
    where: { version: 2 },
    select: { id: true, isActive: true },
  })

  // Deactivate every other version (v1 + any experimental rows) so the
  // "exactly one active" invariant holds with v2 as the active config.
  await client.scoringConfig.updateMany({
    where: { isActive: true, version: { not: 2 } },
    data: { isActive: false },
  })

  if (existing) {
    await client.scoringConfig.update({
      where: { version: 2 },
      data: { config: configJson, isActive: true },
    })
    return { version: 2, action: existing.isActive ? "no-op" : "updated" }
  }

  await client.scoringConfig.create({
    data: {
      version: 2,
      isActive: true,
      config: configJson,
      notes:
        "v2 reconciliation to Andy scoring doc (May 2026): 6-group model " +
        "(intermediaryType primary G1-G6), companySize realign, " +
        "role_change + competitor_engagement -> rapid. Paired with backfill " +
        "point recals (linkedin_post_funding 30->8, clay_director_change " +
        "20->6) + comment->immediate on the registry.",
      createdBy: "seed-script",
    },
  })
  return { version: 2, action: "created" }
}

/**
 * Insert (or refresh) ScoringConfig v3 and make it the active config.
 * Mirrors seedScoringConfigV2's invariant handling (validate → deactivate
 * every other version → upsert v3 active). v1 + v2 preserved as inactive
 * rows (audit history). v3 = v2 + the enrichment block (Apify PR3c-b).
 */
export async function seedScoringConfigV3(
  client: PrismaClient = prisma,
): Promise<SeedResult> {
  const blob = buildScoringConfigV3()

  const validation = validateScoringConfig(blob)
  if (!validation.ok) {
    throw new Error(
      `buildScoringConfigV3 produced an invalid blob: ${validation.error}\n` +
        `Details: ${JSON.stringify(validation.details, null, 2)}`,
    )
  }

  const configJson = blob as unknown as Parameters<
    typeof client.scoringConfig.upsert
  >[0]["create"]["config"]

  const existing = await client.scoringConfig.findUnique({
    where: { version: 3 },
    select: { id: true, isActive: true },
  })

  // Deactivate every other version (v1 + v2 + any experimental rows) so the
  // "exactly one active" invariant holds with v3 as the active config.
  await client.scoringConfig.updateMany({
    where: { isActive: true, version: { not: 3 } },
    data: { isActive: false },
  })

  if (existing) {
    await client.scoringConfig.update({
      where: { version: 3 },
      data: { config: configJson, isActive: true },
    })
    return { version: 3, action: existing.isActive ? "no-op" : "updated" }
  }

  await client.scoringConfig.create({
    data: {
      version: 3,
      isActive: true,
      config: configJson,
      notes:
        "v3 = v2 + Apify PR3c-b enrichment block (gate1Threshold 10 = the " +
        "old COMPANY_ENRICH_THRESHOLD const, NOOP on default; gate1MinSignals " +
        "2, baseEnrichmentCap 300, phoneRevealCap 100 reserved, compliance " +
        "title lists). Runtime-editable by Andy (<=60s TTL, no redeploy).",
      createdBy: "seed-script",
    },
  })
  return { version: 3, action: "created" }
}

async function main() {
  // Seed v1, then v2, then v3 — each deactivates the others, so the committed
  // end state is exactly one active = v3 (the enrichment-block config). v1 + v2
  // are preserved as inactive audit-history rows.
  console.log("\n=== Seed ScoringConfig (Phase 3) ===\n")
  const v1 = await seedScoringConfigV1(prisma)
  console.log(`Result: v${v1.version} ${v1.action}`)
  const v2 = await seedScoringConfigV2(prisma)
  console.log(`Result: v${v2.version} ${v2.action}`)
  const v3 = await seedScoringConfigV3(prisma)
  console.log(`Result: v${v3.version} ${v3.action} (now active)\n`)
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
