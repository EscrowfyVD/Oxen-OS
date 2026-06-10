// Backfill SignalTypeRegistry intentCategory / signalLevel / triggerType
// for the codes seeded across Sprint S1 + Sprint Trigify Phase 2A + Apify
// PR3b (apify_f → Cat F, apify_g → Cat G).
//
// Sprint 3a B3 (Phase 3 Scoring). Deferred from Sprint 3a Phase A
// (commit 8ad6274) pending Andy's per-code A-I mapping validation —
// received 2026-05-15 Slack, applied here.
//
// Schema fields populated:
//   - intentCategory  ("A".."I" — Andy's taxonomy)
//   - signalLevel     ("contact" | "account")
//   - triggerType     ("immediate" | "rapid" | "passive")
//
// Point recalibrations (defaultPoints) — pinned to Andy's doc:
//   - clay_business_loss     10 → 4  (Sprint 3a — negative financial
//     event, ambiguous intent, low confidence ; revisit after one
//     outbound cycle)
//   - linkedin_post_funding  30 → 8  (Sprint 3d ScoringConfig v2 — a
//     funding post is account-level warmth, not a buying signal; 30
//     over-weighted it vs the Cat F intent band)
//   - clay_director_change   20 → 6  (Sprint 3d ScoringConfig v2 —
//     leadership transition is a moderate account-level event, Cat H
//     §4.8; 20 over-weighted it ~3x)
//
// Trigger reclassifications (triggerType, registry side) — Sprint 3d:
//   - trigify_oxen_engagement_comment  rapid → immediate (doc §8.3 — a
//     substantive comment on an Oxen post is high-intent; config
//     followUpTriggers already had it in `immediate`, this realigns the
//     registry/canonical source to match)
//   - trigify_role_change              passive → rapid    (doc §8.3 — a
//     target's role change is a 24h-window signal; moved in BOTH the
//     registry here AND config.followUpTriggers in seed-scoring-config)
//
// Deliberately NOT touched here (Sprint 3d scoping decisions):
//   - trigify_competitor_engagement — registry stays `rapid` (already
//     doc-§8.3-correct). The drift was in config (it sat in `passive`);
//     fixed there in the v2 blob — registry needs no change.
//   - market_country_regulation_change.defaultPoints stays 50 — dormant
//     (category=MARKET → MarketSignal → excluded from individual scoring
//     by construction). Re-point deferred to PRD-008.
//
// And 3 placeholders deactivated (kept in DB so their FK-bearing
// IntentSignals remain valid — `isActive=false` is the soft-retire
// flag, mirrors the SP S1 placeholder pattern):
//   - trigify_intent_signal
//   - clay_legacy_intent
//   - n8n_external_signal
//
// Andy clarifications worth pinning here so a future reader doesn't
// re-litigate:
//   - trigify_oxen_engagement_* → Cat A — the TARGET is Oxen (not the
//     LinkedIn platform). Cat H is for engagement with a competitor /
//     third-party post, Cat A is for engagement with an Oxen-owned post.
//   - trigify_role_change → Cat H (NOT Cat G). Cat G is for
//     compliance/finance infrastructure hiring (e.g. "hired a Head of
//     KYC") — detected since Apify PR3b via the Job Board actor (apify_g).
//     A bare LinkedIn role change is still a Cat H contact-level
//     engagement signal, distinct from a Cat G hiring posting.
//   - clay_director_change → Cat H account-level. Leadership transition
//     IS an account-level event (the director is the company's), not
//     infrastructure build. Distinct from Cat G hiring signals.
//   - Cat H is now mixed-level (most codes contact-level, but
//     clay_director_change is account-level) — explicitly carried in
//     SignalTypeRegistry.signalLevel.
//   - Cat G was reserved-empty in V1 — populated since Apify PR3b by
//     apify_g (the "future PredictLeads/Apify source" foreseen above).
//     Tests assert Cat G holds exactly apify_g.
//
// Idempotency: re-running this script is safe. Every code is updated
// to its canonical mapping each run — values don't drift on re-runs
// (unlike the `update: {}` no-op pattern used by seed-signal-types.ts,
// here we INTENTIONALLY overwrite to keep DB == canonical mapping).

import { PrismaClient, type Prisma } from "@prisma/client"

const prisma = new PrismaClient()

export interface SignalCategoryMapping {
  code: string
  /** Andy's A-I taxonomy. Independent of the existing SignalCategory
   *  enum (INTENT|MARKET scope, orthogonal semantics) — both coexist. */
  intentCategory: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"
  signalLevel: "contact" | "account"
  triggerType: "immediate" | "rapid" | "passive"
  /** Set ONLY when an explicit recalibration is intended. Omit to
   *  preserve the seeded defaultPoints. */
  defaultPoints?: number
}

// ─────────────────────────────────────────────────────────────────────
// Active codes — Andy-validated mapping (Slack 2026-05-15)
// ─────────────────────────────────────────────────────────────────────
//
// Order kept by intentCategory then by source for readability — has
// no functional impact, just makes the diff scannable.

export const MAPPING: SignalCategoryMapping[] = [
  // ─── Cat A — Direct Oxen engagement (3 codes, all contact-level) ──
  {
    code: "trigify_oxen_engagement_comment",
    intentCategory: "A",
    signalLevel: "contact",
    // Sprint 3d ScoringConfig v2 — rapid → immediate (see header).
    triggerType: "immediate",
  },
  {
    code: "trigify_oxen_engagement_like",
    intentCategory: "A",
    signalLevel: "contact",
    triggerType: "passive",
  },
  {
    code: "trigify_profile_visit",
    intentCategory: "A",
    signalLevel: "contact",
    triggerType: "immediate",
  },

  // ─── Cat E — Regulatory (1 code, account-level) ───────────────────
  // The underlying SignalCategory enum is MARKET (orthogonal scope
  // dimension); intentCategory="E" is the SP15-003 A-I taxonomy. Both
  // coexist on the same row by design.
  {
    code: "market_country_regulation_change",
    intentCategory: "E",
    signalLevel: "account",
    triggerType: "passive",
  },

  // ─── Cat F — Financial (2 codes, account-level) ───────────────────
  {
    code: "linkedin_post_funding",
    intentCategory: "F",
    signalLevel: "account",
    triggerType: "rapid",
    // Sprint 3d ScoringConfig v2 — recalibrated 30 → 8 (see header).
    defaultPoints: 8,
  },
  {
    code: "clay_business_loss",
    intentCategory: "F",
    signalLevel: "account",
    triggerType: "passive",
    // Recalibrated 10 → 4 per Andy (Sprint 3a). One of 3 point
    // recalibrations now — see header (linkedin_post_funding=8,
    // clay_director_change=6 are the other two).
    defaultPoints: 4,
  },
  {
    code: "apify_f",
    intentCategory: "F",
    signalLevel: "account",
    // Apify PR3b — Crunchbase funding, same class as linkedin_post_funding.
    // Account-level + score-only in PR3b (no follow-up bucket yet →
    // trigger-drift SCORE_ONLY_EXEMPT). Points from the seed (8); no override.
    triggerType: "rapid",
  },

  // ─── Cat G — Recruitment / infra hiring (1 code, account-level) ───
  // Cat G was reserved-empty in V1 for "a future PredictLeads/Apify source"
  // (see header) — Apify PR3b IS that source. apify_g (job-board
  // compliance/finance hire) is the first Cat G code. Score-only (no
  // follow-up bucket → trigger-drift SCORE_ONLY_EXEMPT); points from the
  // seed (6, provisional, anchored to clay_director_change).
  {
    code: "apify_g",
    intentCategory: "G",
    signalLevel: "account",
    triggerType: "passive",
  },

  // ─── Cat H — LinkedIn signals, mixed-level (5 codes) ──────────────
  // Most are contact-level, but clay_director_change is account-level
  // (Vernon Q to Andy: "is a director change about the contact who
  // moved or about the company that has a new director?" — Andy:
  // about the company. Account-level.)
  {
    code: "trigify_competitor_engagement",
    intentCategory: "H",
    signalLevel: "contact",
    triggerType: "rapid",
  },
  {
    code: "trigify_follow_competitor",
    intentCategory: "H",
    signalLevel: "contact",
    triggerType: "passive",
  },
  {
    code: "trigify_bio_change",
    intentCategory: "H",
    signalLevel: "contact",
    triggerType: "passive",
  },
  {
    code: "trigify_role_change",
    intentCategory: "H",
    signalLevel: "contact",
    // Sprint 3d ScoringConfig v2 — passive → rapid (see header). Moved
    // in config.followUpTriggers (seed-scoring-config) too.
    triggerType: "rapid",
  },
  {
    code: "clay_director_change",
    intentCategory: "H",
    signalLevel: "account",
    triggerType: "rapid",
    // Sprint 3d ScoringConfig v2 — recalibrated 20 → 6 (see header).
    defaultPoints: 6,
  },
]

// ─────────────────────────────────────────────────────────────────────
// Placeholders to deactivate (kept in DB for FK integrity — see
// IntentSignal.signalTypeId, onDelete: Restrict)
// ─────────────────────────────────────────────────────────────────────

export const PLACEHOLDERS_TO_DEACTIVATE = [
  "trigify_intent_signal",
  "clay_legacy_intent",
  "n8n_external_signal",
]

// ─────────────────────────────────────────────────────────────────────
// Main backfill entry point
// ─────────────────────────────────────────────────────────────────────

export interface BackfillResult {
  appliedCount: number
  deactivatedCount: number
}

export async function backfillSignalTypesCategories(
  client: PrismaClient = prisma,
): Promise<BackfillResult> {
  console.log(`\nApplying ${MAPPING.length} mappings...`)
  for (const m of MAPPING) {
    const update: Prisma.SignalTypeRegistryUpdateInput = {
      intentCategory: m.intentCategory,
      signalLevel: m.signalLevel,
      triggerType: m.triggerType,
    }
    if (m.defaultPoints !== undefined) {
      update.defaultPoints = m.defaultPoints
    }
    await client.signalTypeRegistry.update({
      where: { code: m.code },
      data: update,
    })
    const pointsSuffix = m.defaultPoints !== undefined ? ` (points: ${m.defaultPoints})` : ""
    console.log(`  ✓ ${m.code} → ${m.intentCategory}/${m.signalLevel}/${m.triggerType}${pointsSuffix}`)
  }

  console.log(`\nDeactivating ${PLACEHOLDERS_TO_DEACTIVATE.length} placeholders...`)
  for (const code of PLACEHOLDERS_TO_DEACTIVATE) {
    await client.signalTypeRegistry.update({
      where: { code },
      data: { isActive: false },
    })
    console.log(`  ✗ ${code} → isActive=false`)
  }

  // Defensive summary read so prod operators see the resulting shape
  // immediately. Skipped silently if the test mock doesn't stub it.
  try {
    const summary = await client.signalTypeRegistry.groupBy({
      by: ["intentCategory"],
      where: { isActive: true },
      _count: { code: true },
      orderBy: { intentCategory: "asc" },
    })
    console.log("\nFinal summary (active codes by intentCategory):")
    for (const row of summary) {
      const cat = row.intentCategory ?? "(NULL)"
      console.log(`  Cat ${cat}: ${row._count.code}`)
    }
  } catch (err) {
    // groupBy is optional — test mocks may not stub it.
    void err
  }

  return {
    appliedCount: MAPPING.length,
    deactivatedCount: PLACEHOLDERS_TO_DEACTIVATE.length,
  }
}

async function main() {
  console.log("\n=== Backfill SignalTypeRegistry intentCategory (Sprint 3a B3) ===")
  const result = await backfillSignalTypesCategories(prisma)
  console.log(`\nBackfill complete: ${result.appliedCount} mapped, ${result.deactivatedCount} deactivated.\n`)
}

// Run main() only when invoked directly (mirrors seed-signal-types.ts +
// seed-scoring-config.ts conventions).
const isDirectInvocation =
  process.argv[1] && process.argv[1].endsWith("backfill-signal-types-categories.ts")
if (isDirectInvocation) {
  main()
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
