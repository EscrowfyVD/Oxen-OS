// Backfill Company.acquisitionSource for the EXISTING Apify-captured prospects
// (Apify PR3c-b — the pipeline-UI source marker). One-time, IDEMPOTENT,
// apify-linked-ONLY.
//
// For each Company whose acquisitionSource IS NULL and that is traceable to an
// Apify capture via ProcessedSignal.accountId, set acquisitionSource from the
// EARLIEST apify ProcessedSignal's signalCategory (the capturing actor):
//   crunchbase-f -> 'apify-crunchbase'    jobboard-g -> 'apify-jobboard'
//
// SAFETY:
//   - Only companies with an apify ProcessedSignal are considered — the
//     historical (May) batch and every other company stay NULL, untouched.
//   - Only NULL-source rows are written — idempotent (a re-run marks 0).
//
// PROD WRITE — Vernon runs it (like the seed). DEFAULT = DRY-RUN (reports the
// count, writes nothing). Pass --apply to actually write.
//   npx tsx scripts/db/backfill-company-acquisition-source.ts           # dry-count
//   npx tsx scripts/db/backfill-company-acquisition-source.ts --apply   # write

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const CATEGORY_TO_SOURCE: Record<string, string> = {
  "crunchbase-f": "apify-crunchbase",
  "jobboard-g": "apify-jobboard",
}

export interface BackfillResult {
  apifyLinkedCompanies: number // distinct companies traceable to an apify signal
  wouldMark: number // NULL-source apify companies that WOULD be / WERE marked
  marked: number // actually written (0 in dry-run)
  breakdown: Record<string, number> // wouldMark split by source
  sample: Array<{ name: string; source: string }>
}

// Client is injected so tests pass a mock. Only the 3 methods below are used.
export async function backfillCompanyAcquisitionSource(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: Pick<PrismaClient, "processedSignal" | "company"> | any,
  opts: { apply?: boolean } = {},
): Promise<BackfillResult> {
  const apply = opts.apply === true

  // Earliest apify ProcessedSignal (the capturing actor) per accountId.
  const signals = await client.processedSignal.findMany({
    where: { signalCategory: { in: Object.keys(CATEGORY_TO_SOURCE) }, accountId: { not: null } },
    select: { accountId: true, signalCategory: true, processedAt: true },
    orderBy: { processedAt: "asc" },
  })
  const sourceByCompany = new Map<string, string>()
  for (const s of signals) {
    if (!s.accountId || !s.signalCategory) continue
    if (sourceByCompany.has(s.accountId)) continue // earliest wins (a company's original capture)
    const src = CATEGORY_TO_SOURCE[s.signalCategory]
    if (src) sourceByCompany.set(s.accountId, src)
  }
  const apifyCompanyIds = [...sourceByCompany.keys()]

  // Only the still-NULL ones (idempotent — already-marked rows are skipped).
  const targets: Array<{ id: string; name: string }> =
    apifyCompanyIds.length === 0
      ? []
      : await client.company.findMany({
          where: { id: { in: apifyCompanyIds }, acquisitionSource: null },
          select: { id: true, name: true },
        })

  const breakdown: Record<string, number> = {}
  for (const t of targets) {
    const src = sourceByCompany.get(t.id)!
    breakdown[src] = (breakdown[src] ?? 0) + 1
  }

  let marked = 0
  if (apply) {
    for (const t of targets) {
      await client.company.update({ where: { id: t.id }, data: { acquisitionSource: sourceByCompany.get(t.id)! } })
      marked += 1
    }
  }

  return {
    apifyLinkedCompanies: apifyCompanyIds.length,
    wouldMark: targets.length,
    marked,
    breakdown,
    sample: targets.slice(0, 15).map((t) => ({ name: t.name, source: sourceByCompany.get(t.id)! })),
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const res = await backfillCompanyAcquisitionSource(prisma, { apply })
  console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY-RUN", ...res }, null, 2))
  if (!apply) console.log("\nDRY-RUN — no writes. Re-run with --apply to mark the above.")
  else console.log(`\nAPPLIED — marked ${res.marked} companies.`)
}

// Only run when executed directly (not when imported by the test).
if (process.argv[1] && process.argv[1].endsWith("backfill-company-acquisition-source.ts")) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
