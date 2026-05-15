// Seed script for SignalTypeRegistry (Sprint S1 + Sprint Trigify Phase 2A).
//
// Run AFTER the relevant migrations are applied (Railway runs `prisma
// migrate deploy` automatically on push; the seed itself must be
// triggered manually or via a deploy step).
//
// Usage: npx tsx scripts/db/seed-signal-types.ts
//
// The script is fully idempotent — each entry is upserted by `code`,
// so running it multiple times is safe and produces the same final
// state. Existing entries are NOT overwritten if their `code` already
// exists; `update: {}` is intentional to preserve any operator-tweaked
// values (defaultPoints, decayDays, etc.) from drifting back to the
// seeded defaults on re-run. Operators can edit registry rows directly
// in DB; reseeding will not undo their changes.
//
// 14 seeds:
//   - 4 canonical signal types (Vernon Sprint S1 spec)
//   - 7 Trigify signal types (Sprint Trigify Phase 2A spec)
//   - 2 placeholder entries used by the legacy clay/n8n webhooks
//     until those routes are rewired to use the canonical codes
//   - 1 deprecated entry (trigify_intent_signal) kept active=false so
//     existing IntentSignal rows referencing it stay valid but no new
//     ingestion can use it (replaced by 7 canonical trigify_* codes).

import { PrismaClient, type Prisma } from "@prisma/client"

const prisma = new PrismaClient()

interface SeedEntry {
  code: string
  label: string
  description: string
  defaultPoints: number
  decayDays: number
  decayCurve: Prisma.SignalTypeRegistryCreateInput["decayCurve"]
  category: Prisma.SignalTypeRegistryCreateInput["category"]
}

// ─────────────────────────────────────────────────────────────────────
// Canonical signal types (Vernon Sprint S1 batch 1 spec)
// ─────────────────────────────────────────────────────────────────────
const CANONICAL_SEEDS: SeedEntry[] = [
  {
    code: "clay_business_loss",
    label: "Clay — Active Business Loss",
    description:
      "Company is signaling distress (e.g. consecutive losses, layoffs). Strong intent for restructuring / advisory services.",
    defaultPoints: 10,
    decayDays: 90,
    decayCurve: "LINEAR",
    category: "INTENT",
  },
  {
    code: "clay_director_change",
    label: "Clay — Director Change",
    description:
      "A new director was appointed at the target company. New decision-makers often re-evaluate vendor relationships in their first 90 days.",
    defaultPoints: 20,
    decayDays: 60,
    decayCurve: "LINEAR",
    category: "INTENT",
  },
  {
    code: "linkedin_post_funding",
    label: "LinkedIn — Funding Round Announcement",
    description:
      "Target company posted about a funding round. High-intensity intent (treasury allocation, new hires, geo expansion). Decays exponentially because the window of opportunity closes fast.",
    defaultPoints: 30,
    decayDays: 30,
    decayCurve: "EXPONENTIAL",
    category: "INTENT",
  },
  {
    code: "market_country_regulation_change",
    label: "Market — Country Regulation Change",
    description:
      "A jurisdiction enacted regulation impacting offshore structures (e.g. new substance requirements, reporting obligations, tax treaty change). All G1-G5 leads in that country see a temporary score boost.",
    defaultPoints: 50,
    decayDays: 180,
    decayCurve: "STEP",
    category: "MARKET",
  },
]

// ─────────────────────────────────────────────────────────────────────
// Trigify signal types (Sprint Trigify Phase 2A spec)
// ─────────────────────────────────────────────────────────────────────
// 7 canonical codes that replace the trigify_intent_signal placeholder.
// Each maps to one signal_type value the Trigify webhook may receive.
// See SIGNAL_TYPE_MAPPING in src/app/api/webhooks/trigify/route.ts.
const TRIGIFY_SEEDS: SeedEntry[] = [
  {
    code: "trigify_oxen_engagement_comment",
    label: "Trigify — Oxen engagement (comment)",
    description:
      "A LinkedIn user commented on an Oxen-owned post (corporate page or partner profile). Strong intent — they invested effort beyond a like.",
    defaultPoints: 10,
    decayDays: 30,
    decayCurve: "EXPONENTIAL",
    category: "INTENT",
  },
  {
    code: "trigify_oxen_engagement_like",
    label: "Trigify — Oxen engagement (like)",
    description:
      "A LinkedIn user liked an Oxen-owned post. Weak but actionable intent — low-friction interaction.",
    defaultPoints: 5,
    decayDays: 30,
    decayCurve: "EXPONENTIAL",
    category: "INTENT",
  },
  {
    code: "trigify_profile_visit",
    label: "Trigify — Profile visit",
    description:
      "Target visited a tracked Oxen profile (Andy / Paul / corporate). High-intent hot signal — visitor self-selected. Short decay because the window of warmth is small.",
    defaultPoints: 10,
    decayDays: 7,
    decayCurve: "STEP",
    category: "INTENT",
  },
  {
    code: "trigify_competitor_engagement",
    label: "Trigify — Competitor engagement",
    description:
      "Target engaged with a competitor's post (like or comment). Indicates active interest in the space — opportunistic outreach window.",
    defaultPoints: 6,
    decayDays: 60,
    decayCurve: "LINEAR",
    category: "INTENT",
  },
  {
    code: "trigify_follow_competitor",
    label: "Trigify — Follow competitor page",
    description:
      "Target started following a competitor's company page. Passive interest signal — useful for ICP enrichment, low immediate urgency.",
    defaultPoints: 3,
    decayDays: 90,
    decayCurve: "LINEAR",
    category: "INTENT",
  },
  {
    code: "trigify_role_change",
    label: "Trigify — Role change",
    description:
      "Target changed job title or employer. Decision-maker transitions often re-open vendor evaluation — classic 90-day window.",
    defaultPoints: 6,
    decayDays: 90,
    decayCurve: "LINEAR",
    category: "INTENT",
  },
  {
    code: "trigify_bio_change",
    label: "Trigify — Bio change",
    description:
      "Target updated their LinkedIn bio / headline / about section. Weak signal — possibly hinting at a transition or repositioning.",
    defaultPoints: 3,
    decayDays: 90,
    decayCurve: "LINEAR",
    category: "INTENT",
  },
]

// ─────────────────────────────────────────────────────────────────────
// Webhook back-compat placeholders (Sprint S1 batch 1)
// ─────────────────────────────────────────────────────────────────────
// These 2 entries exist solely so the legacy IntentSignal-creating
// webhooks (clay/n8n) can attach their signals to a registry FK without
// knowing about the canonical codes above. Scheduled for deprecation
// in a follow-up batch where each route will be rewired to use the
// canonical signal type codes.
//
// `trigify_intent_signal` was originally part of this list but was
// promoted to DEPRECATED_SEEDS below in Sprint Trigify Phase 2A once
// the trigify webhook was rewired to the 7 canonical trigify_* codes.
//
// Do NOT use these codes for new code paths.
const PLACEHOLDER_SEEDS: SeedEntry[] = [
  {
    code: "clay_legacy_intent",
    label: "Clay legacy intent signal (placeholder)",
    description:
      "Placeholder for the legacy /api/webhooks/clay route — to be deprecated in a follow-up Sprint S1 batch when this route is rewired to use canonical codes.",
    defaultPoints: 10,
    decayDays: 90,
    decayCurve: "LINEAR",
    category: "INTENT",
  },
  {
    code: "n8n_external_signal",
    label: "n8n external automation signal (placeholder)",
    description:
      "Placeholder for the generic /api/webhooks/n8n create_signal action — to be deprecated when each n8n workflow uses a canonical registry code.",
    defaultPoints: 10,
    decayDays: 90,
    decayCurve: "LINEAR",
    category: "INTENT",
  },
]

// ─────────────────────────────────────────────────────────────────────
// Deprecated seeds (Sprint Trigify Phase 2A)
// ─────────────────────────────────────────────────────────────────────
// Entries kept in the registry so historical IntentSignal rows that
// reference them stay valid (FK preserved), but isActive=false so the
// signal-ingestion library refuses new ingestions via these codes.
//
// Re-running the seed will FORCE isActive=false even if an operator
// has manually re-activated the row — this is the one case where we
// intentionally override operator tweaks, because re-enabling a
// deprecated placeholder is almost always a mistake.
const DEPRECATED_SEEDS: SeedEntry[] = [
  {
    code: "trigify_intent_signal",
    label: "Trigify intent signal (deprecated placeholder)",
    description:
      "DEPRECATED — replaced by 7 canonical trigify_* codes in Sprint Trigify Phase 2A. Kept inactive so historical IntentSignal rows referencing it stay valid; new ingestions go through SIGNAL_TYPE_MAPPING in src/app/api/webhooks/trigify/route.ts.",
    defaultPoints: 15,
    decayDays: 90,
    decayCurve: "LINEAR",
    category: "INTENT",
  },
]

const ACTIVE_SEEDS: SeedEntry[] = [
  ...CANONICAL_SEEDS,
  ...TRIGIFY_SEEDS,
  ...PLACEHOLDER_SEEDS,
]

export async function seedSignalTypes(
  client: PrismaClient = prisma,
): Promise<{ upserted: number; codes: string[] }> {
  const codes: string[] = []
  for (const seed of ACTIVE_SEEDS) {
    await client.signalTypeRegistry.upsert({
      where: { code: seed.code },
      create: { ...seed, isActive: true },
      // Empty update preserves operator tweaks across re-runs (see
      // file-level comment for rationale).
      update: {},
    })
    codes.push(seed.code)
  }
  for (const seed of DEPRECATED_SEEDS) {
    await client.signalTypeRegistry.upsert({
      where: { code: seed.code },
      create: { ...seed, isActive: false },
      // Force isActive=false on every run — see DEPRECATED_SEEDS
      // section comment for rationale.
      update: { isActive: false },
    })
    codes.push(seed.code)
  }
  return { upserted: codes.length, codes }
}

async function main() {
  console.log("\n=== SignalTypeRegistry seed ===\n")
  console.log(
    `Active: ${ACTIVE_SEEDS.length} (canonical + Trigify + placeholders)`,
  )
  console.log(`Deprecated: ${DEPRECATED_SEEDS.length} (forced isActive=false)`)
  const result = await seedSignalTypes(prisma)
  console.log(`\nUpserted ${result.upserted} entries:`)
  for (const code of result.codes) {
    console.log(`  - ${code}`)
  }
  console.log("\n=== End ===\n")
}

// Only run main() when invoked directly via `npx tsx`. When imported
// from a test file, the test exercises seedSignalTypes() against a
// mocked client instead.
const isDirectInvocation =
  process.argv[1] && process.argv[1].endsWith("seed-signal-types.ts")
if (isDirectInvocation) {
  main()
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
