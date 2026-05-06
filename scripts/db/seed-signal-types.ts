// Seed script for SignalTypeRegistry (Sprint S1 batch 1).
//
// Run AFTER the `add_signal_universal_ingestion` migration is applied
// (Railway runs `prisma migrate deploy` automatically on push; the
// seed itself must be triggered manually or via a deploy step).
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
// 7 seeds:
//   - 4 canonical signal types (Vernon Sprint S1 spec)
//   - 3 placeholder entries used by the legacy webhooks
//     (clay/trigify/n8n) until those routes are rewired to use the
//     canonical codes — to be deprecated in a follow-up Sprint S1 batch.

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
// Webhook back-compat placeholders (Sprint S1 batch 1)
// ─────────────────────────────────────────────────────────────────────
// These 3 entries exist solely so the 3 legacy IntentSignal-creating
// webhooks (clay/trigify/n8n) can attach their signals to a registry
// FK without knowing about the canonical codes above. They are
// scheduled for deprecation in a follow-up Sprint S1 batch where each
// route will be rewired to use the canonical signal type codes.
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
    code: "trigify_intent_signal",
    label: "Trigify intent signal (placeholder)",
    description:
      "Placeholder for the legacy /api/webhooks/trigify route — to be deprecated when individual signal types are mapped to canonical codes.",
    defaultPoints: 15,
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

const ALL_SEEDS: SeedEntry[] = [...CANONICAL_SEEDS, ...PLACEHOLDER_SEEDS]

export async function seedSignalTypes(
  client: PrismaClient = prisma,
): Promise<{ upserted: number; codes: string[] }> {
  const codes: string[] = []
  for (const seed of ALL_SEEDS) {
    await client.signalTypeRegistry.upsert({
      where: { code: seed.code },
      create: { ...seed, isActive: true },
      // Empty update preserves operator tweaks across re-runs (see
      // file-level comment for rationale).
      update: {},
    })
    codes.push(seed.code)
  }
  return { upserted: codes.length, codes }
}

async function main() {
  console.log("\n=== SignalTypeRegistry seed (Sprint S1 batch 1) ===\n")
  const result = await seedSignalTypes(prisma)
  console.log(`Upserted ${result.upserted} entries:`)
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
