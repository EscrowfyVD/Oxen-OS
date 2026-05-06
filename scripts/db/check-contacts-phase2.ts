// Sanity check CrmContact state after Phase 2 People (Clay) import.
// Read-only. Safe to run anytime.
//
// Usage: npx tsx scripts/db/check-contacts-phase2.ts
//
// Verifies:
//   - Total CrmContact counts (overall, G1-T1)
//   - Persona distribution (DM/OP)
//   - Country distribution (verifies the 3-step resolution chain)
//   - Country null count (post inheritance fallback should be near 0)
//   - dealOwner distribution (random ~50/50 Andy / Paul Garreau)
//   - Field coverage sanity check on key fields
//
// Note: schema uses `dealOwner: String?` (the BD's Employee.name like
// "Andy Dessy"), NOT `dealOwnerId` — assignRandomBD writes the name,
// not the foreign key.

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
  has_firstname: bigint
  has_email: bigint
  has_jobtitle: bigint
  has_persona: bigint
  has_country: bigint
  has_company: bigint
  has_owner: bigint
}

async function main() {
  console.log("\n=== Phase 2 People import — verification ===\n")

  // ── Total counts ──────────────────────────────────────────────────
  const totalAll = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "CrmContact"`,
  )
  const totalG1T1 = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "CrmContact" WHERE "group" = 'G1' AND "painTier" = 'T1'`,
  )
  const totalG1 = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "CrmContact" WHERE "group" = 'G1'`,
  )

  console.log("--- Total counts ---")
  console.log(`CrmContact total           : ${totalAll[0].count}`)
  console.log(`CrmContact G1              : ${totalG1[0].count}`)
  console.log(`CrmContact G1 + T1         : ${totalG1T1[0].count}`)

  const tot = totalG1[0].count
  const pct = (n: bigint) =>
    tot > BigInt(0)
      ? `${((Number(n) / Number(tot)) * 100).toFixed(1)}%`
      : "0%"

  // ── Persona distribution (G1) ─────────────────────────────────────
  const byPersona = await prisma.$queryRawUnsafe<BreakdownRow[]>(
    `SELECT persona AS key, COUNT(*)::bigint AS n FROM "CrmContact" WHERE "group" = 'G1' GROUP BY persona ORDER BY n DESC`,
  )
  console.log("\n--- Persona distribution (G1) ---")
  for (const r of byPersona) {
    console.log(`  ${(r.key ?? "(null)").padEnd(20)} ${r.n.toString().padStart(6)} (${pct(r.n)})`)
  }

  // ── Country distribution (G1) ─────────────────────────────────────
  const byCountry = await prisma.$queryRawUnsafe<BreakdownRow[]>(
    `SELECT country AS key, COUNT(*)::bigint AS n FROM "CrmContact" WHERE "group" = 'G1' GROUP BY country ORDER BY n DESC`,
  )
  console.log("\n--- Country distribution (G1) ---")
  for (const r of byCountry) {
    console.log(`  ${(r.key ?? "(null)").padEnd(40)} ${r.n.toString().padStart(6)} (${pct(r.n)})`)
  }

  const nullCountry = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "CrmContact" WHERE "group" = 'G1' AND country IS NULL`,
  )
  console.log(
    `\n  Country = NULL count       : ${nullCountry[0].count} (${pct(nullCountry[0].count)})`,
  )

  // ── dealOwner distribution (G1) ───────────────────────────────────
  // Schema field is `dealOwner: String?` (BD's name), not `dealOwnerId`.
  const byOwner = await prisma.$queryRawUnsafe<BreakdownRow[]>(
    `SELECT "dealOwner" AS key, COUNT(*)::bigint AS n FROM "CrmContact" WHERE "group" = 'G1' GROUP BY "dealOwner" ORDER BY n DESC`,
  )
  console.log("\n--- dealOwner distribution (G1) ---")
  for (const r of byOwner) {
    console.log(`  ${(r.key ?? "(null)").padEnd(30)} ${r.n.toString().padStart(6)} (${pct(r.n)})`)
  }

  // ── Sanity check : field coverage (G1) ────────────────────────────
  const sanity = await prisma.$queryRawUnsafe<SanityRow[]>(
    `SELECT
       COUNT(*) FILTER (WHERE "firstName" IS NOT NULL AND "firstName" != '')::bigint AS has_firstname,
       COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::bigint              AS has_email,
       COUNT(*) FILTER (WHERE "jobTitle" IS NOT NULL)::bigint                         AS has_jobtitle,
       COUNT(*) FILTER (WHERE persona IS NOT NULL)::bigint                            AS has_persona,
       COUNT(*) FILTER (WHERE country IS NOT NULL)::bigint                            AS has_country,
       COUNT(*) FILTER (WHERE "companyId" IS NOT NULL)::bigint                        AS has_company,
       COUNT(*) FILTER (WHERE "dealOwner" IS NOT NULL)::bigint                        AS has_owner
     FROM "CrmContact"
     WHERE "group" = 'G1'`,
  )
  const s = sanity[0]
  console.log(`\n--- Field coverage (G1, total=${tot}) ---`)
  console.log(`  firstName        : ${s.has_firstname.toString().padStart(6)} (${pct(s.has_firstname)})`)
  console.log(`  email            : ${s.has_email.toString().padStart(6)} (${pct(s.has_email)})`)
  console.log(`  jobTitle         : ${s.has_jobtitle.toString().padStart(6)} (${pct(s.has_jobtitle)})`)
  console.log(`  persona          : ${s.has_persona.toString().padStart(6)} (${pct(s.has_persona)})`)
  console.log(`  country          : ${s.has_country.toString().padStart(6)} (${pct(s.has_country)})`)
  console.log(`  companyId        : ${s.has_company.toString().padStart(6)} (${pct(s.has_company)})`)
  console.log(`  dealOwner        : ${s.has_owner.toString().padStart(6)} (${pct(s.has_owner)})`)

  console.log("\n=== End ===\n")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
