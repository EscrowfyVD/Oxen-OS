// Backfill SignalTypeRegistry intentCategory / signalLevel / triggerType
// for the 14 codes seeded across Sprint S1 + Sprint Trigify Phase 2A.
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
// Plus one explicit recalibration:
//   - clay_business_loss.defaultPoints  10 → 4 (per Andy — negative
//     financial event, ambiguous intent, low confidence ; revisit
//     after one outbound cycle)
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
//   - trigify_role_change → Cat H (NOT Cat G). Cat G is reserved for
//     compliance/finance infrastructure hiring (e.g. "hired a Head of
//     KYC") which we don't yet detect — a future PredictLeads/Apify
//     source. A bare role change is treated as a LinkedIn engagement
//     signal (Cat H, contact-level).
//   - clay_director_change → Cat H account-level. Leadership transition
//     IS an account-level event (the director is the company's), not
//     infrastructure build. Distinct from Cat G hiring signals.
//   - Cat H is now mixed-level (most codes contact-level, but
//     clay_director_change is account-level) — explicitly carried in
//     SignalTypeRegistry.signalLevel.
//   - Cat G remains empty in V1 — Vernon's call. Tests assert this
//     (no row should land in Cat G).
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
    triggerType: "rapid",
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
  },
  {
    code: "clay_business_loss",
    intentCategory: "F",
    signalLevel: "account",
    triggerType: "passive",
    // Recalibrated 10 → 4 per Andy. Single explicit defaultPoints
    // change in this backfill.
    defaultPoints: 4,
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
    triggerType: "passive",
  },
  {
    code: "clay_director_change",
    intentCategory: "H",
    signalLevel: "account",
    triggerType: "rapid",
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
