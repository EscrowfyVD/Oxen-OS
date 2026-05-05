// Drop test seeds before Clay import (PRD-001 D2 decision, Vernon 2026-05-05).
//
// USAGE: npx tsx scripts/db/cleanup-seed-contacts.ts
//
// SAFEGUARD: refuses to delete if count > 50 (defensive — production
// should never have so few seeds, anything > 50 means we're about to
// delete real data and need manual override).
//
// SCOPE:
// 1. Delete all CrmContact rows (cascade deletes Activities, IntentSignals,
//    CrmTasks, etc. via Prisma `onDelete: Cascade` relations)
// 2. Delete all Company rows if also <= 50 (orphaned post-contact-cleanup)
//
// NOT RUN automatically — operator must invoke explicitly. Snapshot of
// state expected to be captured via scripts/db/check-counts.ts BEFORE
// running this.

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const SAFEGUARD_LIMIT = 50

async function main() {
  console.log("\n=== Clay seed cleanup (PRD-001 D2) ===\n")

  // 1. Inspect current state
  const contactCount = await prisma.crmContact.count()
  const companyCount = await prisma.company.count()

  console.log(`Current state:`)
  console.log(`  CrmContacts: ${contactCount}`)
  console.log(`  Companies:   ${companyCount}\n`)

  if (contactCount === 0 && companyCount === 0) {
    console.log("✅ DB already clean. Nothing to do.")
    return
  }

  // 2. Safeguard
  if (contactCount > SAFEGUARD_LIMIT) {
    console.error(
      `❌ Refusing to delete ${contactCount} CrmContacts (safeguard limit: ${SAFEGUARD_LIMIT}).`,
    )
    console.error(
      `   Edit SAFEGUARD_LIMIT in this script if you really mean to delete this many rows.`,
    )
    process.exit(1)
  }

  // 3. Delete CrmContacts (cascades via schema relations)
  if (contactCount > 0) {
    console.log(`Deleting ${contactCount} CrmContacts...`)
    const deletedContacts = await prisma.crmContact.deleteMany({})
    console.log(`✅ Deleted ${deletedContacts.count} CrmContacts`)
  }

  // 4. Delete orphaned Companies (only if also under safeguard)
  if (companyCount > 0) {
    if (companyCount > SAFEGUARD_LIMIT) {
      console.error(
        `❌ Refusing to delete ${companyCount} Companies (safeguard limit: ${SAFEGUARD_LIMIT}).`,
      )
      process.exit(1)
    }
    console.log(`Deleting ${companyCount} Companies...`)
    const deletedCompanies = await prisma.company.deleteMany({})
    console.log(`✅ Deleted ${deletedCompanies.count} Companies`)
  }

  console.log("\n=== Cleanup complete ===\n")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
