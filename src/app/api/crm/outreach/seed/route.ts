import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePageAccess } from "@/lib/admin"

interface SeedDomain {
  domain: string
  mailbox: string
  owner: string
}

const SEED_DOMAINS: SeedDomain[] = [
  { domain: "getoxen.com", mailbox: "andy@getoxen.com", owner: "Andy" },
  { domain: "oxengroup.com", mailbox: "andy@oxengroup.com", owner: "Andy" },
  { domain: "joinoxen.com", mailbox: "paullouis@joinoxen.com", owner: "Paul Louis" },
  { domain: "oxenpartners.com", mailbox: "paullouis@oxenpartners.com", owner: "Paul Louis" },
]

// POST /api/crm/outreach/seed — seed initial domains (idempotent)
export async function POST() {
  const { error } = await requirePageAccess("crm")
  if (error) return error

  try {
    let seeded = 0

    for (const seed of SEED_DOMAINS) {
      await prisma.outreachDomain.upsert({
        where: { domain: seed.domain },
        update: {}, // No update if already exists — idempotent
        create: {
          domain: seed.domain,
          owner: seed.owner,
          mailbox: seed.mailbox,
          provider: "google_workspace",
          status: "warmup",
          warmupStartDate: new Date(),
          spfValid: false,
          dkimValid: false,
          dmarcValid: false,
        },
      })
      seeded++
    }

    return NextResponse.json({ seeded })
  } catch (err) {
    console.error("[Outreach Seed]", err)
    return NextResponse.json({ error: "Failed to seed domains" }, { status: 500 })
  }
}
