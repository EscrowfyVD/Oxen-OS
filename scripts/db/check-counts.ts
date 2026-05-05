// Sanity check DB state. Useful before/after PRD-001 sprints. Read-only.
//
// Usage: npx tsx scripts/db/check-counts.ts
//
// Reports CrmContact / IntentSignal / scoring foundations state.
// Run before/after each PRD-001 sprint to track migration progress
// and detect data drift.

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("\n=== DB sanity check for PRD-001 mapping ===\n")

  // 1. Total CrmContacts
  const totalContacts = await prisma.crmContact.count()
  console.log(`Total CrmContacts:                     ${totalContacts}`)

  // 2. Total IntentSignals
  const totalSignals = await prisma.intentSignal.count()
  console.log(`Total IntentSignals:                   ${totalSignals}`)

  // 3. CrmContacts sans vertical (empty array — String[] default {})
  const noVertical = await prisma.crmContact.count({
    where: { vertical: { isEmpty: true } },
  })
  console.log(
    `CrmContacts sans vertical:             ${noVertical} (${pct(noVertical, totalContacts)})`,
  )

  // 4. CrmContacts en stage "new_lead" (default — jamais avancé dans pipeline)
  const onlyNewLead = await prisma.crmContact.count({
    where: { lifecycleStage: "new_lead" },
  })
  const nullLifecycle = await prisma.crmContact.count({
    where: { lifecycleStage: { equals: "" } },
  })
  console.log(
    `CrmContacts en stage "new_lead" (default, jamais avancé): ${onlyNewLead} (${pct(onlyNewLead, totalContacts)})`,
  )
  console.log(
    `CrmContacts avec lifecycleStage vide:  ${nullLifecycle} (${pct(nullLifecycle, totalContacts)})`,
  )

  // 5. CrmContacts sans icpScore (= 0 ou null) — Q1 audit
  const noIcpScore = await prisma.crmContact.count({
    where: { OR: [{ icpScore: 0 }, { icpScore: null }] },
  })
  const withIcpScore = await prisma.crmContact.count({
    where: { icpScore: { gt: 0 } },
  })
  console.log(
    `CrmContacts sans icpScore (=0 ou null): ${noIcpScore} (${pct(noIcpScore, totalContacts)})`,
  )
  console.log(
    `CrmContacts avec icpScore > 0:         ${withIcpScore} (${pct(withIcpScore, totalContacts)})`,
  )

  // 6. CrmContacts avec relationshipScore > 0 — Q4 audit
  const withRelScore = await prisma.crmContact.count({
    where: { relationshipScore: { gt: 0 } },
  })
  console.log(
    `CrmContacts avec relationshipScore > 0: ${withRelScore} (${pct(withRelScore, totalContacts)})`,
  )

  // Bonus : breakdown lifecycleStage
  console.log("\n--- Breakdown lifecycleStage ---")
  const stages = await prisma.crmContact.groupBy({
    by: ["lifecycleStage"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  })
  for (const s of stages) {
    console.log(`  ${(s.lifecycleStage || "(null)").padEnd(25)} ${s._count.id}`)
  }

  // Bonus : breakdown sources IntentSignal
  if (totalSignals > 0) {
    console.log("\n--- Breakdown IntentSignal sources ---")
    const sources = await prisma.intentSignal.groupBy({
      by: ["source"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    })
    for (const s of sources) {
      console.log(`  ${(s.source || "(null)").padEnd(25)} ${s._count.id}`)
    }
  }

  console.log("\n=== End ===\n")
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%"
  return `${((n / total) * 100).toFixed(1)}%`
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

// ──────────────────────────────────────────────────────────────────────
// Snapshot history — track DB state before/after each PRD-001 sprint
// ──────────────────────────────────────────────────────────────────────
//
// Snapshot 2026-05-01 — pre-Sprint S0 (PRD-001 mapping audit baseline)
// ─────────────────────────────────────────────────────────────────────
//   Total CrmContacts:                     9    (test seeds, blank slate)
//   Total IntentSignals:                   0    (clean migration possible)
//   CrmContacts sans vertical:             5    (55.6%)
//   CrmContacts en stage "new_lead":       9    (100%, jamais avancé)
//   CrmContacts sans icpScore:             9    (100%, foundations unused)
//   CrmContacts avec icpScore > 0:         0    (0%)
//   CrmContacts avec relationshipScore > 0: 0   (0%)
//
// Implication : ICP/Intent foundations exist in schema but are dead code in
// production. PRD-001 enters a quasi-blank slate — migration risk minimal.
