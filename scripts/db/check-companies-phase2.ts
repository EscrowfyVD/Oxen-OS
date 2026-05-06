// Sanity check Company state after Phase 2 G1-T1 import.
// Read-only. Safe to run anytime.
//
// Usage: npx tsx scripts/db/check-companies-phase2.ts
//
// Verifies:
//   - Total Company counts (overall, G1-T1, clay-sourced)
//   - Distribution by country / industry / companySize for G1
//   - Field population sanity (non-null counts on key fields)

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface CountRow {
  count: bigint
}

interface BreakdownRow {
  key: string | null
  n: bigint
}

interface SanityRow {
  has_name: bigint
  has_domain: bigint
  has_country: bigint
  has_industry: bigint
  has_size: bigint
  has_linkedin: bigint
  has_segment: bigint
  has_enrichedat: bigint
}

async function main() {
  console.log("\n=== Phase 2 Company import — verification ===\n")

  // ── Total counts ──────────────────────────────────────────────────
  const totalAll = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "Company"`,
  )
  const totalG1T1 = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "Company" WHERE "group" = 'G1' AND "painTier" = 'T1'`,
  )
  const totalClay = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "Company" WHERE "enrichmentSource" = 'clay'`,
  )

  console.log("--- Total counts ---")
  console.log(`Company total              : ${totalAll[0].count}`)
  console.log(`Company G1 + T1            : ${totalG1T1[0].count}`)
  console.log(`Company enrichmentSource=clay : ${totalClay[0].count}`)

  // ── Distribution par pays (G1) ────────────────────────────────────
  const byCountry = await prisma.$queryRawUnsafe<BreakdownRow[]>(
    `SELECT country AS key, COUNT(*)::bigint AS n FROM "Company" WHERE "group" = 'G1' GROUP BY country ORDER BY n DESC`,
  )
  console.log("\n--- Distribution par pays (G1) ---")
  for (const r of byCountry) {
    console.log(`  ${(r.key ?? "(null)").padEnd(40)} ${r.n}`)
  }

  // ── Distribution par industry (G1) ────────────────────────────────
  const byIndustry = await prisma.$queryRawUnsafe<BreakdownRow[]>(
    `SELECT industry AS key, COUNT(*)::bigint AS n FROM "Company" WHERE "group" = 'G1' GROUP BY industry ORDER BY n DESC`,
  )
  console.log("\n--- Distribution par industry (G1) ---")
  for (const r of byIndustry) {
    console.log(`  ${(r.key ?? "(null)").padEnd(60)} ${r.n}`)
  }

  // ── Distribution par companySize (G1) ─────────────────────────────
  const bySize = await prisma.$queryRawUnsafe<BreakdownRow[]>(
    `SELECT "companySize" AS key, COUNT(*)::bigint AS n FROM "Company" WHERE "group" = 'G1' GROUP BY "companySize" ORDER BY n DESC`,
  )
  console.log("\n--- Distribution par companySize (G1) ---")
  for (const r of bySize) {
    console.log(`  ${(r.key ?? "(null)").padEnd(40)} ${r.n}`)
  }

  // ── Sanity check : field population (G1) ──────────────────────────
  const sanity = await prisma.$queryRawUnsafe<SanityRow[]>(
    `SELECT
       COUNT(*) FILTER (WHERE name IS NOT NULL)::bigint              AS has_name,
       COUNT(*) FILTER (WHERE domain IS NOT NULL)::bigint            AS has_domain,
       COUNT(*) FILTER (WHERE country IS NOT NULL)::bigint           AS has_country,
       COUNT(*) FILTER (WHERE industry IS NOT NULL)::bigint          AS has_industry,
       COUNT(*) FILTER (WHERE "companySize" IS NOT NULL)::bigint     AS has_size,
       COUNT(*) FILTER (WHERE "linkedinUrl" IS NOT NULL)::bigint     AS has_linkedin,
       COUNT(*) FILTER (WHERE "clayTableSegment" IS NOT NULL)::bigint AS has_segment,
       COUNT(*) FILTER (WHERE "enrichedAt" IS NOT NULL)::bigint      AS has_enrichedat
     FROM "Company"
     WHERE "group" = 'G1'`,
  )
  const s = sanity[0]
  const totalG1Bigint = s.has_name // proxy for total G1 (name is required)
  // But to be precise, recompute:
  const totalG1 = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "Company" WHERE "group" = 'G1'`,
  )
  const tot = totalG1[0].count
  // BigInt literals (0n) require ES2020+ target; tsconfig is ES2017, so
  // use BigInt(0) for compatibility.
  const pct = (n: bigint) =>
    tot > BigInt(0)
      ? `${((Number(n) / Number(tot)) * 100).toFixed(1)}%`
      : "0%"

  console.log(`\n--- Sanity check : field population (G1, total=${tot}) ---`)
  console.log(`  name             : ${s.has_name.toString().padStart(6)} (${pct(s.has_name)})`)
  console.log(`  domain           : ${s.has_domain.toString().padStart(6)} (${pct(s.has_domain)})`)
  console.log(`  country          : ${s.has_country.toString().padStart(6)} (${pct(s.has_country)})`)
  console.log(`  industry         : ${s.has_industry.toString().padStart(6)} (${pct(s.has_industry)})`)
  console.log(`  companySize      : ${s.has_size.toString().padStart(6)} (${pct(s.has_size)})`)
  console.log(`  linkedinUrl      : ${s.has_linkedin.toString().padStart(6)} (${pct(s.has_linkedin)})`)
  console.log(`  clayTableSegment : ${s.has_segment.toString().padStart(6)} (${pct(s.has_segment)})`)
  console.log(`  enrichedAt       : ${s.has_enrichedat.toString().padStart(6)} (${pct(s.has_enrichedat)})`)

  // Silence unused-var lint: totalG1Bigint is just a proxy reference.
  void totalG1Bigint

  console.log("\n=== End ===\n")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
